import express from "express";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loadTrip,
  sameId,
} from "../middleware/tripAccess.js";

const router = express.Router();

router.use(requireAuth);

const PACES = [
  "relaxed",
  "balanced",
  "packed",
];

function cleanList(list) {
  const result = [];

  if (!Array.isArray(list)) {
    return result;
  }

  for (const item of list) {
    const text = String(item).trim();

    if (
      text !== "" &&
      !result.includes(text)
    ) {
      result.push(text);
    }
  }

  return result.slice(0, 15);
}

export function toPreference(row) {
  return {
    user_id: row.user_id,

    interests: readJSON(
      row.interests,
      []
    ),

    pace: row.pace,

    budget_contribution:
      row.budget_contribution,

    must_do: readJSON(
      row.must_do,
      []
    ),

    deal_breakers: readJSON(
      row.deal_breakers,
      []
    ),

    notes: row.notes || "",
  };
}

export function isFilledIn(pref) {
  return (
    pref.interests.length > 0 ||
    pref.must_do.length > 0 ||
    pref.notes.trim() !== ""
  );
}

router.get(
  "/:id/preferences",
  loadTrip,
  async (req, res, next) => {
    try {
      const trip = req.trip;

      const [rows] =
        await pool.execute(
          `SELECT *
           FROM preferences
           WHERE trip_id = ?`,
          [trip.id]
        );

      const prefs =
        rows.map(toPreference);

      const people =
        trip.members.map((member) => {
          const pref =
            prefs.find(
              (p) =>
                sameId(
                  p.user_id,
                  member.id
                )
            );

          return {
            id: member.id,

            name: member.name,

            is_me: sameId(
              member.id,
              req.user.id
            ),

            submitted: pref
              ? isFilledIn(pref)
              : false,

            preference:
              pref || null,
          };
        });

      const locked =
        Boolean(trip.itinerary) ||
        trip.status === "finalised" ||
        trip.status === "completed";

      res.json({
        people,

        locked,

        is_organiser:
          req.isOrganiser,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id/preferences/me",
  loadTrip,
  async (req, res, next) => {
    try {
      const trip = req.trip;

      if (
        trip.itinerary ||
        trip.status === "finalised" ||
        trip.status === "completed"
      ) {
        return res.status(400).json({
          message:
            "The plan has been generated, so preferences are locked.",
        });
      }

      const {
        interests,
        pace,
        budget_contribution,
        must_do,
        deal_breakers,
        notes,
      } = req.body;

      if (!PACES.includes(pace)) {
        return res.status(400).json({
          message:
            "Pace must be relaxed, balanced or packed.",
        });
      }

      if (
        Number(budget_contribution) < 0
      ) {
        return res.status(400).json({
          message:
            "Budget contribution must be 0 or more.",
        });
      }

      const data = {
        interests:
          cleanList(interests),

        pace,

        budget_contribution:
          Number(budget_contribution) || 0,

        must_do:
          cleanList(must_do),

        deal_breakers:
          cleanList(deal_breakers),

        notes:
          String(notes || "")
            .trim()
            .slice(0, 1000),
      };

      if (
        data.interests.length === 0 &&
        data.must_do.length === 0 &&
        data.notes === ""
      ) {
        return res.status(400).json({
          message:
            "Add at least one interest, a must-do, or a description.",
        });
      }

      await pool.execute(
        `INSERT INTO preferences
         (
           trip_id,
           user_id,
           interests,
           pace,
           budget_contribution,
           must_do,
           deal_breakers,
           notes
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)

         ON DUPLICATE KEY UPDATE
           interests =
             VALUES(interests),

           pace =
             VALUES(pace),

           budget_contribution =
             VALUES(budget_contribution),

           must_do =
             VALUES(must_do),

           deal_breakers =
             VALUES(deal_breakers),

           notes =
             VALUES(notes)`,
        [
          trip.id,

          req.user.id,

          JSON.stringify(
            data.interests
          ),

          data.pace,

          data.budget_contribution,

          JSON.stringify(
            data.must_do
          ),

          JSON.stringify(
            data.deal_breakers
          ),

          data.notes,
        ]
      );

      res.json({
        message:
          "Preferences saved.",

        preference:
          data,
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
