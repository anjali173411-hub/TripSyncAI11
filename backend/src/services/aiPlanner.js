import axios from "axios";

const MAX_TRIES = 3;
const TIME_LIMIT = Number(process.env.AI_TIMEOUT_MS || 90000);

export function countDays(trip) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / oneDay) + 1;
}

// Every calendar date of the trip, e.g. ["2026-10-14", "2026-10-15", ...].
export function tripDates(trip) {
  const dates = [];
  const start = new Date(`${String(trip.start_date).slice(0, 10)}T00:00:00Z`);
  for (let i = 0; i < countDays(trip); i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

const MIN_ACTIVITIES_PER_DAY = 3;

function isCost(value) {
  return typeof value === "number" && value >= 0;
}

export function recalcCosts(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days)) return itinerary;

  let activitiesTotal = 0;
  for (const day of itinerary.days) {
    for (const activity of day.activities || []) {
      activitiesTotal += Number(activity.estimated_cost) || 0;
    }
  }

  const breakdown = { ...(itinerary.cost_breakdown || {}) };
  breakdown.activities = activitiesTotal;

  itinerary.cost_breakdown = breakdown;
  itinerary.total_estimated_cost = Object.values(breakdown).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );
  return itinerary;
}

async function askAI(path, body, check) {
  let hadTimeout = false;

  for (let tryNumber = 1; tryNumber <= MAX_TRIES; tryNumber++) {
    try {
      console.log(`AI request attempt ${tryNumber}/${MAX_TRIES}`);

      const response = await axios.post(
        `${process.env.AI_SERVICE_URL}${path}`,
        body,
        { timeout: TIME_LIMIT }
      );

      const problem = check(response.data);

      if (problem === "") {
        console.log("AI response received and validated.");
        return response.data;
      }

      console.log(`AI response is invalid: ${problem}`);
    } catch (error) {
      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        hadTimeout = true;
      }

      console.log(
        `AI attempt ${tryNumber} failed:`,
        error.code || error.message
      );

      if (error.response) {
        console.log("AI service status:", error.response.status);
        console.log("AI service response:", error.response.data);
      }
    }

    if (tryNumber < MAX_TRIES) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  if (hadTimeout) {
    throw new Error(
      "The AI took too long to respond. Please try again later."
    );
  }

  throw new Error(
    "The AI could not create a valid answer. Please try again."
  );
}

export async function generatePlan(trip, members, instructions = "") {
  const days = countDays(trip);
  const dates = tripDates(trip);
  const keys = members.map((m) => m.key);
  const isGroup = trip.type === "group";

  const body = {
    destination: trip.destination || "",
    start_location: trip.start_location,
    start_date: trip.start_date,
    end_date: trip.end_date,
    days: days,
    budget: trip.budget,
    travellers: trip.travellers,
    is_group: isGroup,
    instructions: instructions,
    members: members.map((m) => ({
      key: m.key,
      name: m.name,
      interests: m.pref.interests,
      pace: m.pref.pace,
      budget_contribution: m.pref.budget_contribution,
      must_do: m.pref.must_do,
      deal_breakers: m.pref.deal_breakers,
      notes: m.pref.notes,
    })),
  };

  function checkPlan(plan) {
    if (!plan || !plan.summary) return "Missing summary";
    if (!isCost(plan.total_estimated_cost)) return "Missing total cost";
    if (!plan.cost_breakdown) return "Missing cost breakdown";
    if (!Array.isArray(plan.days) || plan.days.length !== days) {
      return `Expected ${days} days`;
    }
    for (const day of plan.days) {
      if (!Array.isArray(day.activities) || day.activities.length < MIN_ACTIVITIES_PER_DAY) {
        return `Day ${day.date || "?"} has fewer than ${MIN_ACTIVITIES_PER_DAY} activities`;
      }
      for (const activity of day.activities) {
        if (!activity.title) return "An activity has no title";
        if (!isCost(activity.estimated_cost)) return "An activity has a bad cost";
        const matched = activity.matched_members || [];
        if (!matched.every((key) => keys.includes(key))) return "Unknown member key";
      }
    }
    const conflicts = plan.conflicts || [];
    if (!isGroup && conflicts.length > 0) return "A solo trip cannot have conflicts";
    for (const conflict of conflicts) {
      if (!conflict.description) return "A conflict has no description";
      const affected = conflict.affected_members || [];
      if (affected.length < 2 || !affected.every((key) => keys.includes(key))) {
        return "A conflict needs at least 2 real members";
      }
      if (!Array.isArray(conflict.options) || conflict.options.length < 1 || conflict.options.length > 3) {
        return "A conflict needs 1 to 3 options";
      }
    }
    return "";
  }

  const plan = await askAI("/plan", body, checkPlan);

  function keysToIds(list) {
    return (list || []).map((key) => members.find((m) => m.key === key).userId);
  }

  return {
    itinerary: {
      destination: plan.destination || trip.destination,
      summary: plan.summary,
      total_estimated_cost: plan.total_estimated_cost,
      cost_breakdown: plan.cost_breakdown,
      days: plan.days.map((day, index) => ({
        day: index + 1,
        date: dates[index],
        title: day.title,
        activities: day.activities.map((a) => ({
          time: a.time || "",
          title: a.title,
          description: a.description || "",
          location: a.location || "",
          estimated_cost: a.estimated_cost,
          matched_members: keysToIds(a.matched_members),
        })),
      })),
    },
    conflicts: (plan.conflicts || []).map((c) => ({
      description: c.description,
      reasoning: c.reasoning || "",
      affected_members: keysToIds(c.affected_members),
      options: c.options.map((o) => ({
        text: o.text,
        rationale: o.rationale || "",
        adds_activity: Boolean(o.adds_activity),
        day: o.day || 1,
        time: o.time || "",
        title: o.title || "",
        description: o.description || "",
        estimated_cost: isCost(o.estimated_cost) ? o.estimated_cost : 0,
      })),
    })),
  };
}

export async function getBudgetTips(trip, summary, preferences) {
  const activities = [];
  (trip.itinerary?.days || []).forEach((day, dayIndex) => {
    (day.activities || []).forEach((a, index) => {
      activities.push({
        id: `d${dayIndex + 1}-a${index}`,
        day: dayIndex + 1,
        index: index,
        title: a.title,
        cost: Number(a.estimated_cost) || 0,
      });
    });
  });

  const byCategory = {};
  for (const [name, values] of Object.entries(summary.by_category)) {
    byCategory[name] = { plan: values.plan, planned: values.planned, actual: values.actual };
  }

  const body = {
    destination: trip.destination || "",
    budget: trip.budget,
    planned_total: summary.planned,
    actual_total: summary.actual,
    planned_percent: summary.planned_percent,
    actual_percent: summary.actual_percent,
    by_category: byCategory,
    preferences: preferences,
    activities: activities.map(({ id, day, title, cost }) => ({ id, day, title, cost })),
  };

  function checkTips(answer) {
    if (!answer || !answer.summary) return "Missing summary";
    if (!Array.isArray(answer.suggestions) || answer.suggestions.length === 0) return "No suggestions";
    for (const tip of answer.suggestions) {
      if (!tip.suggestion) return "A tip is empty";
      if (!isCost(tip.estimated_saving)) return "A tip has a bad saving";
    }
    return "";
  }

  const answer = await askAI("/budget-tips", body, checkTips);

  answer.suggestions = answer.suggestions.map((tip) => {
    const activity = activities.find((a) => a.id === tip.activity_id);
    const newCost = Number(tip.new_cost);
    if (!activity || !isCost(newCost) || newCost >= activity.cost) {
      return { suggestion: tip.suggestion, category: tip.category, estimated_saving: tip.estimated_saving, change: null };
    }
    return {
      suggestion: tip.suggestion,
      category: tip.category,
      estimated_saving: activity.cost - newCost,
      change: {
        day: activity.day,
        index: activity.index,
        current_title: activity.title,
        current_cost: activity.cost,
        new_title: String(tip.new_title || "").trim() || activity.title,
        new_cost: newCost,
      },
    };
  });

  return answer;
}
