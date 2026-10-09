import express from "express";
import { randomUUID } from "crypto";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loadTrip,
  organiserOnly,
  stillPlanning,
  sameId,
} from "../middleware/tripAccess.js";

const router = express.Router();

router.use(requireAuth);

function cleanTitle(body) {
  const title = String(body.title || "").trim();
  return title === "" ? null : title;
}

function checkTripForm(body) {
  if (String(body.title || "").trim().length > 120) {
    return "Trip name must be 120 characters or fewer.";
  }

  if (!body.startLocation || !body.startLocation.trim()) {
    return "Starting location is required.";
  }

  if (!body.startDate || !body.endDate) {
    return "Start and end dates are required.";
  }

  if (body.endDate < body.startDate) {
    return "End date must be on or after start date.";
  }

  if (!(Number(body.budget) > 0)) {
    return "Budget must be greater than 0.";
  }

  if (
    !(Number(body.travellers) >= 1 &&
      Number(body.travellers) <= 50)
  ) {
    return "Travellers must be between 1 and 50.";
  }

  if (
    !body.preferenceText ||
    body.preferenceText.trim().length < 10
  ) {
    return "Preferences must be at least 10 characters.";
  }

  return "";
}

async function getMembers(tripId) {
  const [members] = await pool.execute(
    `SELECT users.id, users.name, users.email
     FROM trip_members
     JOIN users ON users.id = trip_members.user_id
     WHERE trip_members.trip_id = ?
     ORDER BY users.id`,
    [tripId]
  );

  return members;
}

router.get("/", async (req, res, next) => {
  try {
    const [trips] = await pool.execute(
      `SELECT trips.*
       FROM trips
       JOIN trip_members
         ON trip_members.trip_id = trips.id
       WHERE trip_members.user_id = ?
       ORDER BY trips.created_at DESC`,
      [req.user.id]
    );

    for (const trip of trips) {
      trip.members = await getMembers(trip.id);
    }

    res.json(trips);
  } catch (error) {
    next(error);
  }
});

router.get("/invitations", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         invitations.id AS invitation_id,
         invitations.status AS invitation_status,
         trips.id,
         trips.title,
         trips.destination,
         trips.start_location,
         trips.start_date,
         trips.end_date,
         users.name AS owner_name
       FROM invitations
       JOIN trips
         ON trips.id = invitations.trip_id
       JOIN users
         ON users.id = trips.owner_id
       WHERE invitations.user_id = ?
         AND invitations.status = 'pending'`,
      [req.user.id]
    );

    const invitations = rows.map((row) => ({
      ...row,
      owner: {
        name: row.owner_name,
      },
    }));

    res.json(invitations);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const problem = checkTripForm(req.body);

    if (problem) {
      return res.status(400).json({
        message: problem,
      });
    }

    const id = randomUUID();

    const type =
      req.body.tripType === "group"
        ? "group"
        : "solo";

    const destination = req.body.destination
      ? req.body.destination.trim()
      : null;

    await pool.execute(
      `INSERT INTO trips
       (
         id,
         title,
         owner_id,
         type,
         destination,
         start_location,
         start_date,
         end_date,
         budget,
         travellers,
         preference_text,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning')`,
      [
        id,
        cleanTitle(req.body),
        req.user.id,
        type,
        destination,
        req.body.startLocation.trim(),
        req.body.startDate,
        req.body.endDate,
        Number(req.body.budget),
        Number(req.body.travellers),
        req.body.preferenceText.trim(),
      ]
    );

    await pool.execute(
      `INSERT INTO trip_members
       (trip_id, user_id)
       VALUES (?, ?)`,
      [id, req.user.id]
    );

    await pool.execute(
      `INSERT INTO preferences
       (
         trip_id,
         user_id,
         interests,
         pace,
         notes,
         must_do,
         deal_breakers
       )
       VALUES (?, ?, ?, ?, ?, '[]', '[]')`,
      [
        id,
        req.user.id,
        JSON.stringify(
          readJSON(req.user.default_interests, [])
        ),
        req.user.default_pace || "balanced",
        req.body.preferenceText.trim(),
      ]
    );

    const [rows] = await pool.execute(
      "SELECT * FROM trips WHERE id = ?",
      [id]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", loadTrip, async (req, res, next) => {
  try {
    const trip = req.trip;

    const [owners] = await pool.execute(
      `SELECT id, name, email
       FROM users
       WHERE id = ?`,
      [trip.owner_id]
    );

    const [invites] = await pool.execute(
      `SELECT
         invitations.status,
         users.id,
         users.name,
         users.email
       FROM invitations
       JOIN users
         ON users.id = invitations.user_id
       WHERE invitations.trip_id = ?`,
      [trip.id]
    );

    res.json({
      ...trip,
      members: await getMembers(trip.id),
      owner: owners[0] || null,
      invitations: invites.map((invite) => ({
        status: invite.status,
        user: {
          id: invite.id,
          name: invite.name,
          email: invite.email,
        },
      })),
      is_organiser: req.isOrganiser,
    });
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      const problem = checkTripForm(req.body);

      if (problem) {
        return res.status(400).json({
          message: problem,
        });
      }

      const trip = req.trip;
      const destination = req.body.destination ? req.body.destination.trim() : null;

      const detailsChanged =
        (trip.destination || null) !== destination ||
        trip.start_location !== req.body.startLocation.trim() ||
        String(trip.start_date) !== String(req.body.startDate) ||
        String(trip.end_date) !== String(req.body.endDate) ||
        Number(trip.budget) !== Number(req.body.budget) ||
        Number(trip.travellers) !== Number(req.body.travellers) ||
        trip.preference_text !== req.body.preferenceText.trim();

      if (!detailsChanged) {
        await pool.execute("UPDATE trips SET title = ? WHERE id = ?", [cleanTitle(req.body), trip.id]);
        const [rows] = await pool.execute("SELECT * FROM trips WHERE id = ?", [trip.id]);
        return res.json({ ...rows[0], message: "Trip name saved. The itinerary was kept." });
      }

      await pool.execute(
        `UPDATE trips
         SET
           title = ?,
           destination = ?,
           start_location = ?,
           start_date = ?,
           end_date = ?,
           budget = ?,
           travellers = ?,
           preference_text = ?,
           status = 'planning',
           itinerary = NULL,
           generation_error = NULL
         WHERE id = ?`,
        [
          cleanTitle(req.body),
          destination,
          req.body.startLocation.trim(),
          req.body.startDate,
          req.body.endDate,
          Number(req.body.budget),
          Number(req.body.travellers),
          req.body.preferenceText.trim(),
          req.trip.id,
        ]
      );

      await pool.execute(
        "DELETE FROM conflicts WHERE trip_id = ?",
        [req.trip.id]
      );

      const [rows] = await pool.execute(
        "SELECT * FROM trips WHERE id = ?",
        [req.trip.id]
      );

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  loadTrip,
  organiserOnly,
  async (req, res, next) => {
    try {
      await pool.execute(
        "DELETE FROM trips WHERE id = ?",
        [req.trip.id]
      );

      res.json({
        message: "Trip deleted.",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/invite",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      const trip = req.trip;

      if (trip.type !== "group") {
        return res.status(400).json({
          message: "Only group trips can have members.",
        });
      }

      if (trip.itinerary) {
        return res.status(400).json({
          message:
            "You can't invite people after the plan is generated.",
        });
      }

      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          message: "Email is required.",
        });
      }

      const [users] = await pool.execute(
        `SELECT *
         FROM users
         WHERE email = ?
           AND is_active = TRUE`,
        [email]
      );

      const user = users[0];

      if (!user) {
        return res.status(404).json({
          message:
            "No user found with that email. Ask them to register first.",
        });
      }

      if (
        trip.members.some((member) =>
          sameId(member.id, user.id)
        )
      ) {
        return res.status(400).json({
          message: "This person is already on the trip.",
        });
      }

      const [pending] = await pool.execute(
        `SELECT id
         FROM invitations
         WHERE trip_id = ?
           AND user_id = ?
           AND status = 'pending'`,
        [trip.id, user.id]
      );

      if (pending.length > 0) {
        return res.status(400).json({
          message: "This person already has an invitation.",
        });
      }

      await pool.execute(
        `INSERT INTO invitations
         (trip_id, user_id)
         VALUES (?, ?)`,
        [trip.id, user.id]
      );

      res.json({
        message: `Invitation sent to ${user.name}.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id/invitation",
  async (req, res, next) => {
    try {
      const [trips] = await pool.execute(
        "SELECT * FROM trips WHERE id = ?",
        [req.params.id]
      );

      const trip = trips[0];

      if (!trip) {
        return res.status(404).json({
          message: "Trip not found.",
        });
      }

      const [invites] = await pool.execute(
        `SELECT *
         FROM invitations
         WHERE trip_id = ?
           AND user_id = ?
           AND status = 'pending'`,
        [trip.id, req.user.id]
      );

      const invitation = invites[0];

      if (!invitation) {
        return res.status(404).json({
          message: "You have no pending invitation for this trip.",
        });
      }

      if (req.body.action === "accept") {
        if (trip.status !== "planning") {
          return res.status(400).json({
            message:
              "This trip is no longer accepting members.",
          });
        }

        await pool.execute(
          `INSERT IGNORE INTO trip_members
           (trip_id, user_id)
           VALUES (?, ?)`,
          [trip.id, req.user.id]
        );

        await pool.execute(
          `INSERT IGNORE INTO preferences
           (
             trip_id,
             user_id,
             interests,
             pace,
             notes,
             must_do,
             deal_breakers
           )
           VALUES (?, ?, ?, ?, '', '[]', '[]')`,
          [
            trip.id,
            req.user.id,
            JSON.stringify(
              readJSON(req.user.default_interests, [])
            ),
            req.user.default_pace || "balanced",
          ]
        );

        await pool.execute(
          `UPDATE invitations
           SET status = 'accepted'
           WHERE id = ?`,
          [invitation.id]
        );

        return res.json({
          message: "You joined the trip successfully.",
        });
      }

      if (req.body.action === "decline") {
        await pool.execute(
          `UPDATE invitations
           SET status = 'declined'
           WHERE id = ?`,
          [invitation.id]
        );

        return res.json({
          message: "Invitation declined.",
        });
      }

      return res.status(400).json({
        message: "Action must be accept or decline.",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/members/:userId",
  loadTrip,
  organiserOnly,
  stillPlanning,
  async (req, res, next) => {
    try {
      const userId = req.params.userId;

      if (sameId(req.trip.owner_id, userId)) {
        return res.status(400).json({
          message: "The organiser can't be removed.",
        });
      }

      const [members] = await pool.execute(
        `SELECT user_id
         FROM trip_members
         WHERE trip_id = ?
           AND user_id = ?`,
        [req.trip.id, userId]
      );

      if (members.length === 0) {
        return res.status(404).json({
          message: "This user is not a member of the trip.",
        });
      }

      await pool.execute(
        `DELETE FROM trip_members
         WHERE trip_id = ?
           AND user_id = ?`,
        [req.trip.id, userId]
      );

      await pool.execute(
        `DELETE FROM preferences
         WHERE trip_id = ?
           AND user_id = ?`,
        [req.trip.id, userId]
      );

      await pool.execute(
        `UPDATE invitations
         SET status = 'removed'
         WHERE trip_id = ?
           AND user_id = ?
           AND status = 'accepted'`,
        [req.trip.id, userId]
      );

      res.json({
        message: "Member removed.",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id/complete",
  loadTrip,
  organiserOnly,
  async (req, res, next) => {
    try {
      if (req.trip.status !== "finalised") {
        return res.status(400).json({
          message:
            "Only a finalised trip can be marked completed.",
        });
      }

      await pool.execute(
        `UPDATE trips
         SET status = 'completed'
         WHERE id = ?`,
        [req.trip.id]
      );

      res.json({
        message:
          "Trip marked as completed. Members can now review the destination.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
