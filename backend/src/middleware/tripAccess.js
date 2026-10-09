import pool from "../db/pool.js";
import { readJSON } from "../db/pool.js";
import { recalcCosts } from "../services/aiPlanner.js";

export function sameId(a, b) {
  return String(a) === String(b);
}

export async function loadTrip(req, res, next) {
  try {
    const [tripRows] = await pool.execute(
      "SELECT * FROM trips WHERE id = ?",
      [req.params.id]
    );

    const trip = tripRows[0];

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    trip.itinerary = recalcCosts(
      readJSON(trip.itinerary, null)
    );

    const [members] = await pool.execute(
      `SELECT
         users.id,
         users.name,
         users.email
       FROM trip_members
       JOIN users
         ON users.id = trip_members.user_id
       WHERE trip_members.trip_id = ?
       ORDER BY users.id`,
      [trip.id]
    );

    trip.members = members;

    if (!members.some((member) => sameId(member.id, req.user.id))) {
      return res.status(403).json({
        message: "You are not a member of this trip.",
      });
    }

    req.isOrganiser = sameId(
      trip.owner_id,
      req.user.id
    );

    req.trip = trip;

    next();

  } catch (error) {
    next(error);
  }
}

export function organiserOnly(req, res, next) {
  if (!req.isOrganiser) {
    return res.status(403).json({
      message:
        "Only the trip organiser can do this.",
    });
  }

  next();
}

export function stillPlanning(req, res, next) {

  if (
    req.trip.status === "finalised" ||
    req.trip.status === "completed"
  ) {
    return res.status(400).json({
      message:
        "This trip is no longer in the planning state.",
    });
  }

  next();
}
