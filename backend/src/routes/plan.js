import express from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loadTrip,
  organiserOnly,
  stillPlanning,
  sameId,
} from "../middleware/tripAccess.js";
import {
  generatePlan,
  countDays,
  recalcCosts,
} from "../services/aiPlanner.js";
import {
  toPreference,
  isFilledIn,
} from "./preferences.js";

const router = express.Router();

router.use(requireAuth);

function byTime(a, b) {
  return String(a.time || "").localeCompare(String(b.time || ""));
}

async function getMembersForAI(trip) {
  const [rows] = await pool.execute(
    "SELECT * FROM preferences WHERE trip_id = ?",
    [trip.id]
  );

  const preferences = rows.map(toPreference);
  const members = [];

  for (const member of trip.members) {
    const preference = preferences.find((item) =>
      sameId(item.user_id, member.id)
    );

    if (!preference || !isFilledIn(preference)) {
      return null;
    }

    members.push({
      key: `m${members.length + 1}`,
      userId: member.id,
      name: member.name,
      pref: preference,
    });
  }

  return members;
}

async function saveGeneratedPlan(trip, result) {
  await pool.execute(
    `UPDATE trips
     SET itinerary = ?,
         status = 'planning',
         generation_error = NULL
     WHERE id = ?`,
    [JSON.stringify(recalcCosts(result.itinerary)), trip.id]
  );

  await pool.execute(
    "DELETE FROM conflicts WHERE trip_id = ?",
    [trip.id]
  );

  for (const conflict of result.conflicts || []) {
    const [saved] = await pool.execute(
      `INSERT INTO conflicts
       (trip_id, description, reasoning, options)
       VALUES (?, ?, ?, ?)`,
      [
        trip.id,
        conflict.description,
        conflict.reasoning,
        JSON.stringify(conflict.options),
      ]
    );

    for (const userId of conflict.affected_members || []) {
      await pool.execute(
        `INSERT IGNORE INTO conflict_members
         (conflict_id, user_id)
         VALUES (?, ?)`,
        [saved.insertId, userId]
      );
    }
  }
}

async function generate(req, res, next) {
  try {
    const trip = req.trip;

    if (trip.itinerary) {
      return res.status(400).json({
        message: "An itinerary already exists. Use the retry or redesign option.",
      });
    }

    if (countDays(trip) > 30) {
      return res.status(400).json({
        message: "A trip can be at most 30 days long.",
      });
    }

    const [pending] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM invitations
       WHERE trip_id = ?
         AND status = 'pending'`,
      [trip.id]
    );

    if (Number(pending[0].total) > 0) {
      return res.status(400).json({
        message: "Some invited people haven't joined yet. Wait for them to accept or decline first.",
      });
    }

    const members = await getMembersForAI(trip);

    if (!members) {
      return res.status(400).json({
        message: "Everyone on the trip must add their preferences first.",
      });
    }

    try {
      const result = await generatePlan(trip, members);

      await saveGeneratedPlan(trip, result);

      let message = "Itinerary generated.";

      if (result.conflicts?.length > 0) {
        message =
          `Itinerary generated. ${result.conflicts.length} clash(es) need a vote.`;
      }

      return res.json({
        ...trip,
        itinerary: result.itinerary,
        status: "planning",
        conflict_count: result.conflicts?.length || 0,
        generation_error: null,
        message,
      });
    } catch (error) {
      await pool.execute(
        `UPDATE trips
         SET status = 'generation_failed',
             generation_error = ?
         WHERE id = ?`,
        [error.message, trip.id]
      );

      return res.status(502).json({
        message: "Itinerary generation failed. Please try again.",
        status: "generation_failed",
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
}

router.post(
  "/:id/generate",
  loadTrip,
  organiserOnly,
  stillPlanning,
  generate
);

router.post(
  "/:id/retry",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      if (req.trip.itinerary) {
        return res.status(400).json({
          message: "An itinerary already exists.",
        });
      }

      return generate(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/redo-day",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      const trip = req.trip;
      const dayNumber = Number(req.body.day);
      const wish = String(req.body.instructions || "")
        .trim()
        .slice(0, 300);

      if (!trip.itinerary) {
        return res.status(400).json({
          message: "Generate the itinerary first.",
        });
      }

      if (
        !Number.isInteger(dayNumber) ||
        dayNumber < 1 ||
        dayNumber > trip.itinerary.days.length
      ) {
        return res.status(400).json({
          message: "Choose a valid day.",
        });
      }

      const members = await getMembersForAI(trip);

      if (!members) {
        return res.status(400).json({
          message: "Everyone on the trip must add their preferences first.",
        });
      }

      const instructions =
        `Only day ${dayNumber} is being redesigned. ` +
        `Change for day ${dayNumber}: ${wish || "make it different"}`;

      const result = await generatePlan(trip, members, instructions);
      const newDay = result.itinerary.days[dayNumber - 1];

      if (!newDay) {
        return res.status(502).json({
          message: "The AI did not return the requested day.",
        });
      }

      trip.itinerary.days[dayNumber - 1] = newDay;

      await pool.execute(
        "UPDATE trips SET itinerary = ? WHERE id = ?",
        [JSON.stringify(recalcCosts(trip.itinerary)), trip.id]
      );

      return res.json({
        message: `Day ${dayNumber} has been redesigned.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

function findActivity(trip, req, res) {
  const dayIndex = Number(req.params.day);
  const activityIndex = Number(req.params.index);

  const day = trip.itinerary?.days?.[dayIndex];
  const activity = day?.activities?.[activityIndex];

  if (!activity) {
    res.status(404).json({
      message: "Activity not found.",
    });
    return null;
  }

  return { day, activity };
}

router.put(
  "/:id/activities/:day/:index",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      if (!req.trip.itinerary) {
        return res.status(400).json({
          message: "Generate the itinerary first.",
        });
      }

      const found = findActivity(req.trip, req, res);
      if (!found) return;

      const { time, title, description, estimated_cost } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          message: "The activity needs a name.",
        });
      }

      if (
        estimated_cost === "" ||
        estimated_cost == null ||
        !Number.isFinite(Number(estimated_cost)) ||
        Number(estimated_cost) < 0
      ) {
        return res.status(400).json({
          message: "Cost must be 0 or more.",
        });
      }

      found.activity.time = time || "";
      found.activity.title = title.trim();
      found.activity.description = description || "";
      found.activity.estimated_cost = Number(estimated_cost);

      found.day.activities.sort(byTime);

      await pool.execute(
        "UPDATE trips SET itinerary = ? WHERE id = ?",
        [JSON.stringify(recalcCosts(req.trip.itinerary)), req.trip.id]
      );

      return res.json({ message: "Activity updated." });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/activities/:day/:index",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      if (!req.trip.itinerary) {
        return res.status(400).json({
          message: "Generate the itinerary first.",
        });
      }

      const found = findActivity(req.trip, req, res);
      if (!found) return;

      found.day.activities.splice(Number(req.params.index), 1);

      await pool.execute(
        "UPDATE trips SET itinerary = ? WHERE id = ?",
        [JSON.stringify(recalcCosts(req.trip.itinerary)), req.trip.id]
      );

      return res.json({ message: "Activity removed." });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/activities/:day/:index/move",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      if (!req.trip.itinerary) {
        return res.status(400).json({
          message: "Generate the itinerary first.",
        });
      }

      const found = findActivity(req.trip, req, res);
      if (!found) return;

      const destinationDayNumber = Number(req.body.toDay);
      const destinationDay =
        req.trip.itinerary.days[destinationDayNumber - 1];

      if (!destinationDay) {
        return res.status(400).json({
          message: "Choose a valid day.",
        });
      }

      found.day.activities.splice(Number(req.params.index), 1);
      destinationDay.activities.push(found.activity);
      destinationDay.activities.sort(byTime);

      await pool.execute(
        "UPDATE trips SET itinerary = ? WHERE id = ?",
        [JSON.stringify(recalcCosts(req.trip.itinerary)), req.trip.id]
      );

      return res.json({
        message: `Activity moved to day ${destinationDayNumber}.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/finalise",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      if (!req.trip.itinerary) {
        return res.status(400).json({
          message: "Generate the itinerary first.",
        });
      }

      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS open
         FROM conflicts
         WHERE trip_id = ?
           AND resolved = FALSE`,
        [req.trip.id]
      );

      const open = Number(rows[0].open);

      if (open > 0) {
        return res.status(400).json({
          message:
            `${open} clash(es) still need a decision before finalising.`,
        });
      }

      await pool.execute(
        "UPDATE trips SET status = 'finalised' WHERE id = ?",
        [req.trip.id]
      );

      return res.json({
        message: "The plan is finalised.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
