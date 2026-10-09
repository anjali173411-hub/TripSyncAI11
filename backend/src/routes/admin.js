import express from "express";

import pool from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { sameId } from "../middleware/tripAccess.js";
import { updateAverageRating } from "./destinations.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

async function count(sql) {
  const [rows] = await pool.query(sql);
  return Number(rows[0].total);
}

router.get("/stats", async (req, res, next) => {
  try {
    const [popular] = await pool.query(
      `SELECT COALESCE(destination, 'Not chosen') AS name, COUNT(*) AS count
       FROM trips
       GROUP BY COALESCE(destination, 'Not chosen')
       ORDER BY count DESC
       LIMIT 5`
    );

    const [groupSize] = await pool.query(
      `SELECT COALESCE(ROUND(AVG(member_count), 1), 0) AS average
       FROM (
         SELECT COUNT(*) AS member_count
         FROM trip_members
         JOIN trips ON trips.id = trip_members.trip_id
         WHERE trips.type = 'group'
         GROUP BY trip_members.trip_id
       ) AS sizes`
    );

    res.json({
      total_users: await count(
        "SELECT COUNT(*) AS total FROM users"
      ),

      active_users: await count(
        "SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE"
      ),

      total_trips: await count(
        "SELECT COUNT(*) AS total FROM trips"
      ),

      solo_trips: await count(
        "SELECT COUNT(*) AS total FROM trips WHERE type = 'solo'"
      ),

      group_trips: await count(
        "SELECT COUNT(*) AS total FROM trips WHERE type = 'group'"
      ),

      average_group_size: Number(groupSize[0].average),

      popular_destinations: popular.map((p) => ({
        name: p.name,
        count: Number(p.count),
      })),

      total_destinations: await count(
        "SELECT COUNT(*) AS total FROM destinations"
      ),

      total_reviews: await count(
        "SELECT COUNT(*) AS total FROM reviews"
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         users.id,
         users.name,
         users.email,
         users.role,
         users.is_active,
         users.created_at,
         COUNT(DISTINCT trip_members.trip_id) AS trip_count,
         COUNT(DISTINCT owned.id) AS organised_count
       FROM users
       LEFT JOIN trip_members ON trip_members.user_id = users.id
       LEFT JOIN trips AS owned ON owned.owner_id = users.id
       GROUP BY users.id
       ORDER BY users.created_at DESC, users.id DESC`
    );

    const users = rows.map((u) => ({
      ...u,
      trip_count: Number(u.trip_count),
      organised_count: Number(u.organised_count),
      isActive: Boolean(u.is_active),
    }));

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/trips", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         trips.id,
         trips.title,
         trips.type,
         trips.destination,
         trips.start_location,
         trips.start_date,
         trips.end_date,
         trips.budget,
         trips.status,
         trips.itinerary IS NOT NULL AS has_itinerary,
         trips.created_at,
         owner.id AS organiser_id,
         owner.name AS organiser_name,
         owner.email AS organiser_email,
         (SELECT COUNT(*) FROM trip_members WHERE trip_members.trip_id = trips.id) AS member_count
       FROM trips
       JOIN users AS owner ON owner.id = trips.owner_id
       ORDER BY trips.created_at DESC`
    );

    const trips = rows.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      destination: t.destination,
      start_location: t.start_location,
      start_date: t.start_date,
      end_date: t.end_date,
      budget: Number(t.budget),
      status: t.status,
      has_itinerary: Boolean(t.has_itinerary),
      created_at: t.created_at,
      member_count: Number(t.member_count),
      organiser: {
        id: t.organiser_id,
        name: t.organiser_name,
        email: t.organiser_email,
      },
    }));

    res.json(trips);
  } catch (error) {
    next(error);
  }
});

router.put("/users/:userId/active", async (req, res, next) => {
  try {
    if (sameId(req.params.userId, req.user.id)) {
      return res.status(400).json({
        message: "You can't deactivate your own account.",
      });
    }

    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE id = ?",
      [req.params.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const isActive = Boolean(req.body.isActive);

    if (isActive) {
      await pool.execute(
        "UPDATE users SET is_active = TRUE WHERE id = ?",
        [req.params.userId]
      );
    } else {
      await pool.execute(
        `UPDATE users
         SET is_active = FALSE,
             token_version = token_version + 1
         WHERE id = ?`,
        [req.params.userId]
      );
    }

    res.json({
      message: isActive
        ? "User reactivated."
        : "User deactivated.",
    });
  } catch (error) {
    next(error);
  }
});

const COST_TIERS = ["budget", "mid-range", "luxury"];
const MAX_IMAGES = 6;

function cleanImages(images) {
  const list = Array.isArray(images) ? images : String(images || "").split(/[\n,]+/);
  const result = [];
  for (const item of list) {
    const link = String(item).trim();
    if (link && !result.includes(link)) result.push(link);
  }
  return result;
}

function checkDestination(body) {
  if (!body.name || !body.name.trim()) {
    return "Name is required.";
  }

  if (Number(body.average_cost) < 0) {
    return "Average cost must be 0 or more.";
  }

  if (!COST_TIERS.includes(body.cost_tier)) {
    return "Choose a cost tier: budget, mid-range or luxury.";
  }

  const images = cleanImages(body.images);
  if (images.length > MAX_IMAGES) {
    return `Add at most ${MAX_IMAGES} pictures.`;
  }
  if (images.some((link) => !/^https?:\/\/\S+$/i.test(link) || link.length > 500)) {
    return "Each picture must be a web link starting with http:// or https://.";
  }

  return "";
}

function destinationValues(body) {
  return [
    body.name.trim(),
    String(body.region || "").trim(),
    String(body.description || "").trim(),
    Number(body.average_cost) || 0,
    body.cost_tier,
    JSON.stringify(cleanImages(body.images)),
  ];
}

router.post("/destinations", async (req, res, next) => {
  try {
    const problem = checkDestination(req.body);

    if (problem) {
      return res.status(400).json({
        message: problem,
      });
    }

    await pool.execute(
      `INSERT INTO destinations
       (name, region, description, average_cost, cost_tier, images)
       VALUES (?, ?, ?, ?, ?, ?)`,
      destinationValues(req.body)
    );

    res.status(201).json({
      message: "Destination added.",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/destinations/:destId", async (req, res, next) => {
  try {
    const problem = checkDestination(req.body);

    if (problem) {
      return res.status(400).json({
        message: problem,
      });
    }

    const [result] = await pool.execute(
      `UPDATE destinations
       SET name = ?,
           region = ?,
           description = ?,
           average_cost = ?,
           cost_tier = ?,
           images = ?
       WHERE id = ?`,
      [
        ...destinationValues(req.body),
        req.params.destId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Destination not found.",
      });
    }

    res.json({
      message: "Destination updated.",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/destinations/:destId", async (req, res, next) => {
  try {
    await pool.execute(
      "DELETE FROM destinations WHERE id = ?",
      [req.params.destId]
    );

    res.json({
      message: "Destination deleted.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reviews", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT reviews.*,
              users.name AS user_name,
              destinations.name AS destination_name
       FROM reviews
       JOIN users
         ON users.id = reviews.user_id
       JOIN destinations
         ON destinations.id = reviews.destination_id
       ORDER BY reviews.created_at DESC,
                reviews.id DESC`
    );

    const reviews = rows.map((r) => ({
      _id: r.id,
      rating: r.rating,
      comment: r.comment,
      visible: Boolean(r.visible),

      user: {
        name: r.user_name,
      },

      destination: {
        name: r.destination_name,
      },
    }));

    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/reviews/:reviewId/visible",
  async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM reviews WHERE id = ?",
        [req.params.reviewId]
      );

      const review = rows[0];

      if (!review) {
        return res.status(404).json({
          message: "Review not found.",
        });
      }

      const visible = Boolean(req.body.visible);

      await pool.execute(
        "UPDATE reviews SET visible = ? WHERE id = ?",
        [visible, review.id]
      );

      await updateAverageRating(review.destination_id);

      res.json({
        message: visible
          ? "Review shown."
          : "Review hidden.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
