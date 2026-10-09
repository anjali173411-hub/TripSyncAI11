import express from "express";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { loadTrip, organiserOnly, stillPlanning, sameId } from "../middleware/tripAccess.js";
import { getBudgetTips, recalcCosts } from "../services/aiPlanner.js";

const router = express.Router();
router.use(requireAuth);

export const CATEGORIES = ["accommodation", "food", "transport", "activities", "miscellaneous"];

const ALIASES = {
  stay: "accommodation",
  hotel: "accommodation",
  activity: "activities",
  misc: "miscellaneous",
};

const WARNING_PERCENT = 80;

function toCategory(name) {
  const clean = String(name || "").trim().toLowerCase();
  return ALIASES[clean] || clean;
}

function percentOf(amount, budget) {
  return budget > 0 ? Math.round((amount / budget) * 100) : 0;
}

function checkExpense(body, trip) {
  if (!CATEGORIES.includes(toCategory(body.category))) return "Choose a category.";
  if (!(Number(body.amount) > 0)) return "Amount must be greater than 0.";
  if (!["planned", "actual"].includes(body.kind)) return "Choose planned or actual.";
  if (body.paid_by && !trip.members.some((m) => sameId(m.id, body.paid_by))) {
    return "The person who paid must be on the trip.";
  }
  return "";
}

async function getExpenses(tripId) {
  const [rows] = await pool.execute(
    `SELECT expenses.*, users.name AS paid_by_name
     FROM expenses
     LEFT JOIN users ON users.id = expenses.paid_by
     WHERE expenses.trip_id = ?
     ORDER BY expenses.created_at DESC, expenses.id DESC`,
    [tripId]
  );

  return rows.map((e) => ({
    _id: e.id,
    category: toCategory(e.category),
    amount: e.amount,
    kind: e.kind,
    description: e.description,
    created_by: e.created_by,
    paid_by_id: e.paid_by,
    paid_by: e.paid_by ? { id: e.paid_by, name: e.paid_by_name } : null,
  }));
}

async function buildSummary(trip) {
  const expenses = await getExpenses(trip.id);
  const [prefs] = await pool.execute("SELECT user_id, budget_contribution FROM preferences WHERE trip_id = ?", [trip.id]);

  const byCategory = {};
  function category(name) {
    if (!byCategory[name]) byCategory[name] = { plan: 0, planned: 0, actual: 0 };
    return byCategory[name];
  }
  CATEGORIES.forEach(category);

  let planTotal = 0;
  if (trip.itinerary) {
    for (const [name, value] of Object.entries(trip.itinerary.cost_breakdown || {})) {
      const amount = Number(value) || 0;
      category(toCategory(name)).plan += amount;
      planTotal += amount;
    }
  }

  let plannedExtras = 0;
  let actual = 0;
  for (const e of expenses) {
    category(e.category)[e.kind] += e.amount;
    if (e.kind === "planned") plannedExtras += e.amount;
    else actual += e.amount;
  }

  const budget = Number(trip.budget) || 0;
  const planned = planTotal + plannedExtras;
  const plannedPercent = percentOf(planned, budget);
  const actualPercent = percentOf(actual, budget);

  const fairShare = actual / trip.members.length;
  const byMember = trip.members.map((member) => {
    const paid = expenses
      .filter((e) => e.kind === "actual" && sameId(e.paid_by_id, member.id))
      .reduce((sum, e) => sum + e.amount, 0);
    const pref = prefs.find((p) => sameId(p.user_id, member.id));
    return {
      id: member.id,
      name: member.name,
      contribution: pref ? Number(pref.budget_contribution) || 0 : 0,
      paid: paid,
      fair_share: Math.round(fairShare),
      balance: Math.round(paid - fairShare),
    };
  });

  return {
    total_budget: budget,

    plan_total: planTotal,
    planned_extras: plannedExtras,
    planned: planned,
    planned_remaining: budget - planned,
    planned_overrun: Math.max(0, planned - budget),
    planned_percent: plannedPercent,

    actual: actual,
    actual_remaining: budget - actual,
    actual_overrun: Math.max(0, actual - budget),
    actual_percent: actualPercent,

    warning_percent: WARNING_PERCENT,
    near_limit: plannedPercent >= WARNING_PERCENT || actualPercent >= WARNING_PERCENT,

    by_category: byCategory,
    by_member: byMember,
    total_contributions: byMember.reduce((sum, m) => sum + m.contribution, 0),
  };
}

router.get("/:id/budget", loadTrip, async (req, res, next) => {
  try {
    const expenses = await getExpenses(req.trip.id);
    const summary = await buildSummary(req.trip);
    res.json({ expenses, summary, categories: CATEGORIES, is_organiser: req.isOrganiser });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/expenses", loadTrip, async (req, res, next) => {
  try {
    const problem = checkExpense(req.body, req.trip);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    const [result] = await pool.execute(
      `INSERT INTO expenses (trip_id, category, amount, kind, paid_by, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.trip.id,
        toCategory(req.body.category),
        Number(req.body.amount),
        req.body.kind,
        req.body.paid_by || req.user.id,
        String(req.body.description || "").trim(),
        req.user.id,
      ]
    );

    res.status(201).json({ message: "Expense added.", _id: result.insertId });
  } catch (error) {
    next(error);
  }
});

async function findExpense(req, res) {
  const [rows] = await pool.execute("SELECT * FROM expenses WHERE id = ? AND trip_id = ?", [
    req.params.expenseId,
    req.trip.id,
  ]);
  const expense = rows[0];
  if (!expense) {
    res.status(404).json({ message: "Expense not found." });
    return null;
  }
  if (!sameId(expense.created_by, req.user.id) && !req.isOrganiser) {
    res.status(403).json({ message: "You can only change expenses you added." });
    return null;
  }
  return expense;
}

router.put("/:id/expenses/:expenseId", loadTrip, async (req, res, next) => {
  try {
    const expense = await findExpense(req, res);
    if (!expense) return;

    const problem = checkExpense(req.body, req.trip);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    await pool.execute(
      "UPDATE expenses SET category = ?, amount = ?, kind = ?, paid_by = ?, description = ? WHERE id = ?",
      [
        toCategory(req.body.category),
        Number(req.body.amount),
        req.body.kind,
        req.body.paid_by || expense.paid_by,
        String(req.body.description || "").trim(),
        expense.id,
      ]
    );

    res.json({ message: "Expense updated." });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/expenses/:expenseId", loadTrip, async (req, res, next) => {
  try {
    const expense = await findExpense(req, res);
    if (!expense) return;

    await pool.execute("DELETE FROM expenses WHERE id = ?", [expense.id]);
    res.json({ message: "Expense deleted." });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/budget/tips", loadTrip, async (req, res, next) => {
  try {
    const summary = await buildSummary(req.trip);

    if (!summary.near_limit) {
      return res.status(400).json({
        message: `Saving tips appear once planned or actual spending reaches ${WARNING_PERCENT}% of the budget.`,
      });
    }

    const [rows] = await pool.execute(
      `SELECT users.name, preferences.interests, preferences.pace, preferences.notes
       FROM preferences
       JOIN users ON users.id = preferences.user_id
       WHERE preferences.trip_id = ?`,
      [req.trip.id]
    );
    const preferences = rows.map((p) => {
      const interests = readJSON(p.interests, []);
      const notes = String(p.notes || "").slice(0, 200);
      return `${p.name}: likes ${interests.join(", ") || "anything"}; pace ${p.pace}${notes ? `; notes: ${notes}` : ""}`;
    });

    try {
      const tips = await getBudgetTips(req.trip, summary, preferences);
      res.json(tips);
    } catch (error) {
      res.status(502).json({ message: error.message });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/:id/budget/apply", loadTrip, organiserOnly, stillPlanning, async (req, res, next) => {
  try {
    const trip = req.trip;
    const { day, index, current_title, new_title, new_cost } = req.body;

    const activity = trip.itinerary?.days?.[Number(day) - 1]?.activities?.[Number(index)];

    if (!activity || activity.title !== current_title) {
      return res.status(409).json({
        message: "That activity has changed since the suggestion was made. Ask for new tips.",
      });
    }

    const cost = Number(new_cost);
    if (!Number.isFinite(cost) || cost < 0 || cost >= Number(activity.estimated_cost)) {
      return res.status(400).json({ message: "The new cost must be lower than the current cost." });
    }

    const title = String(new_title || "").trim().slice(0, 200);
    const saving = Number(activity.estimated_cost) - cost;

    if (title && title !== activity.title) {
      activity.description = `Cheaper option instead of "${activity.title}". ${activity.description || ""}`.trim();
      activity.title = title;
    }
    activity.estimated_cost = cost;

    await pool.execute("UPDATE trips SET itinerary = ? WHERE id = ?", [
      JSON.stringify(recalcCosts(trip.itinerary)),
      trip.id,
    ]);

    res.json({ message: `Applied. Planned costs went down by ₹${saving.toLocaleString("en-IN")}.` });
  } catch (error) {
    next(error);
  }
});

export default router;
