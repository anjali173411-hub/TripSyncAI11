import express from "express";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loadTrip,
  organiserOnly,
  stillPlanning,
  sameId,
} from "../middleware/tripAccess.js";
import { recalcCosts } from "../services/aiPlanner.js";

const router = express.Router();

router.use(requireAuth);

async function applyOption(trip, conflict, optionIndex) {
  const option = conflict.options[optionIndex];

  if (!option.adds_activity || !trip.itinerary) {
    return;
  }

  const day =
    trip.itinerary.days[option.day - 1] ||
    trip.itinerary.days[0];

  day.activities.push({
    time: option.time,
    title: option.title || option.text,
    description: option.description || "",
    location: "",
    estimated_cost: option.estimated_cost || 0,
    matched_members: conflict.affected_members.map(
      (member) => member.id
    ),
  });

  day.activities.sort((a, b) =>
    String(a.time).localeCompare(String(b.time))
  );

  await pool.execute(
    `UPDATE trips
     SET itinerary = ?
     WHERE id = ?`,
    [
      JSON.stringify(recalcCosts(trip.itinerary)),
      trip.id,
    ]
  );
}

async function getConflict(conflictId, tripId) {
  const [rows] = await pool.execute(
    `SELECT *
     FROM conflicts
     WHERE id = ?
       AND trip_id = ?`,
    [conflictId, tripId]
  );

  const conflict = rows[0];

  if (!conflict) {
    return null;
  }

  const [members] = await pool.execute(
    `SELECT users.id, users.name
     FROM conflict_members
     JOIN users
       ON users.id = conflict_members.user_id
     WHERE conflict_members.conflict_id = ?`,
    [conflict.id]
  );

  const [votes] = await pool.execute(
    `SELECT votes.option_index, users.id, users.name
     FROM votes
     JOIN users
       ON users.id = votes.user_id
     WHERE votes.conflict_id = ?`,
    [conflict.id]
  );

  return {
    _id: conflict.id,

    description: conflict.description,

    reasoning: conflict.reasoning,

    options: readJSON(
      conflict.options,
      []
    ),

    resolved: Boolean(
      conflict.resolved
    ),

    selected_option:
      conflict.selected_option,

    custom_resolution:
      conflict.custom_resolution,

    resolved_by:
      conflict.resolved_by,

    affected_members: members,

    votes: votes.map((vote) => ({
      option: vote.option_index,

      user: {
        id: vote.id,
        name: vote.name,
      },
    })),
  };
}

router.get(
  "/:id/votes",
  loadTrip,
  async (req, res, next) => {
    try {
      const [rows] =
        await pool.execute(
          `SELECT id
           FROM conflicts
           WHERE trip_id = ?
           ORDER BY id`,
          [req.trip.id]
        );

      const conflicts = [];

      for (const row of rows) {
        const conflict =
          await getConflict(
            row.id,
            req.trip.id
          );

        const myVote =
          conflict.votes.find(
            (vote) =>
              sameId(
                vote.user.id,
                req.user.id
              )
          );

        conflicts.push({
          ...conflict,

          can_vote:
            !conflict.resolved &&
            conflict.affected_members.some(
              (member) =>
                sameId(
                  member.id,
                  req.user.id
                )
            ),

          my_vote:
            myVote
              ? myVote.option
              : null,
        });
      }

      res.json({
        conflicts,

        is_organiser:
          req.isOrganiser,

        trip_status:
          req.trip.status,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/votes/:voteId",
  loadTrip,
  stillPlanning,
  async (req, res, next) => {
    try {
      const conflict =
        await getConflict(
          req.params.voteId,
          req.trip.id
        );

      if (!conflict) {
        return res.status(404).json({
          message: "Clash not found.",
        });
      }

      if (conflict.resolved) {
        return res.status(400).json({
          message:
            "This clash has already been decided.",
        });
      }

      const isMember =
        conflict.affected_members.some(
          (member) =>
            sameId(
              member.id,
              req.user.id
            )
        );

      if (!isMember) {
        return res.status(403).json({
          message:
            "Only the members involved in this clash can vote.",
        });
      }

      const option =
        Number(req.body.option);

      if (
        !(
          option >= 0 &&
          option < conflict.options.length
        )
      ) {
        return res.status(400).json({
          message:
            "Choose a valid option.",
        });
      }

      await pool.execute(
        `INSERT INTO votes
         (
           conflict_id,
           user_id,
           option_index
         )
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           option_index =
           VALUES(option_index)`,
        [
          conflict._id,
          req.user.id,
          option,
        ]
      );

      const [count] =
        await pool.execute(
          `SELECT COUNT(*) AS total
           FROM votes
           WHERE conflict_id = ?
             AND option_index = ?`,
          [
            conflict._id,
            option,
          ]
        );

      const votesForIt =
        Number(count[0].total);

      let message =
        "Vote saved.";

      if (
        votesForIt >
        conflict.affected_members.length / 2
      ) {
        await pool.execute(
          `UPDATE conflicts
           SET
             resolved = TRUE,
             selected_option = ?,
             resolved_by = 'vote'
           WHERE id = ?`,
          [
            option,
            conflict._id,
          ]
        );

        await applyOption(
          req.trip,
          conflict,
          option
        );

        message =
          "Vote saved. A majority agreed, so this option is now locked in.";
      }

      res.json({
        message,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id/votes/:voteId/resolve",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      const conflict =
        await getConflict(
          req.params.voteId,
          req.trip.id
        );

      if (!conflict) {
        return res.status(404).json({
          message:
            "Clash not found.",
        });
      }

      if (conflict.resolved) {
        return res.status(400).json({
          message:
            "This clash has already been decided.",
        });
      }

      const custom =
        String(
          req.body.custom || ""
        ).trim();

      if (custom) {
        await pool.execute(
          `UPDATE conflicts
           SET
             resolved = TRUE,
             custom_resolution = ?,
             resolved_by = 'organiser'
           WHERE id = ?`,
          [
            custom,
            conflict._id,
          ]
        );
      } else {
        const option =
          Number(req.body.option);

        if (
          !(
            option >= 0 &&
            option < conflict.options.length
          )
        ) {
          return res.status(400).json({
            message:
              "Choose an option or write your own decision.",
          });
        }

        await pool.execute(
          `UPDATE conflicts
           SET
             resolved = TRUE,
             selected_option = ?,
             resolved_by = 'organiser'
           WHERE id = ?`,
          [
            option,
            conflict._id,
          ]
        );

        await applyOption(
          req.trip,
          conflict,
          option
        );
      }

      res.json({
        message:
          "Decision saved.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
