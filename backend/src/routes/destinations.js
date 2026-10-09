import express from "express";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { sameId } from "../middleware/tripAccess.js";

const router = express.Router();
router.use(requireAuth);

export async function updateAverageRating(destinationId) {
  await pool.execute(
    `UPDATE destinations
     SET average_rating = (
       SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM reviews
       WHERE destination_id = ? AND visible = TRUE
     )
     WHERE id = ?`,
    [destinationId, destinationId]
  );
}

async function hasCompletedTrip(userId, destinationName) {
  const [rows] = await pool.execute(
    `SELECT trips.id
     FROM trips
     JOIN trip_members ON trip_members.trip_id = trips.id
     WHERE trip_members.user_id = ?
       AND trips.status = 'completed'
       AND LOWER(TRIM(trips.destination)) = LOWER(TRIM(?))`,
    [userId, destinationName]
  );
  return rows.length > 0;
}

async function alreadyReviewed(userId, destinationId) {
  const [rows] = await pool.execute("SELECT id FROM reviews WHERE destination_id = ? AND user_id = ?", [
    destinationId,
    userId,
  ]);
  return rows.length > 0;
}

function withImages(destination) {
  return { ...destination, images: readJSON(destination.images, []) };
}

router.get("/", async (req, res, next) => {
  try {
    const search = "%" + (req.query.search || "") + "%";
    const tier = ["budget", "mid-range", "luxury"].includes(req.query.tier) ? req.query.tier : null;
    const [destinations] = await pool.execute(
      `SELECT *, id AS _id FROM destinations
       WHERE name LIKE ? ${tier ? "AND cost_tier = ?" : ""}
       ORDER BY name`,
      tier ? [search, tier] : [search]
    );
    res.json(destinations.map(withImages));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT *, id AS _id FROM destinations WHERE id = ?", [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: "Destination not found." });
    }
    const destination = withImages(rows[0]);

    const [reviewRows] = await pool.execute(
      `SELECT reviews.*, users.name AS user_name
       FROM reviews
       JOIN users ON users.id = reviews.user_id
       WHERE reviews.destination_id = ? AND reviews.visible = TRUE
       ORDER BY reviews.created_at DESC`,
      [destination.id]
    );
    const reviews = reviewRows.map((r) => ({
      _id: r.id,
      rating: r.rating,
      comment: r.comment,
      user: { id: r.user_id, name: r.user_name },
    }));

    const completed = await hasCompletedTrip(req.user.id, destination.name);
    const reviewed = await alreadyReviewed(req.user.id, destination.id);

    res.json({
      destination,
      reviews,
      can_review: completed && !reviewed,
      my_user_id: req.user.id,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reviews", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM destinations WHERE id = ?", [req.params.id]);
    const destination = rows[0];
    if (!destination) {
      return res.status(404).json({ message: "Destination not found." });
    }

    const rating = Number(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ message: "Rating must be from 1 to 5." });
    }
    if (!(await hasCompletedTrip(req.user.id, destination.name))) {
      return res.status(403).json({ message: "You can review a place after completing a trip there." });
    }
    if (await alreadyReviewed(req.user.id, destination.id)) {
      return res.status(400).json({ message: "You have already reviewed this place." });
    }

    await pool.execute("INSERT INTO reviews (destination_id, user_id, rating, comment) VALUES (?, ?, ?, ?)", [
      destination.id,
      req.user.id,
      rating,
      String(req.body.comment || "").trim().slice(0, 1000),
    ]);
    await updateAverageRating(destination.id);

    res.status(201).json({ message: "Thanks for your review." });
  } catch (error) {
    next(error);
  }
});

router.delete("/reviews/:reviewId", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM reviews WHERE id = ?", [req.params.reviewId]);
    const review = rows[0];
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }
    if (!sameId(review.user_id, req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own review." });
    }

    await pool.execute("DELETE FROM reviews WHERE id = ?", [review.id]);
    await updateAverageRating(review.destination_id);
    res.json({ message: "Review deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
