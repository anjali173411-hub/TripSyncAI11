import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Development allows many attempts so repeated testing does not get blocked.
const isDev = process.env.NODE_ENV === "development";
const loginLimit = rateLimit({ max: isDev ? 100 : 10, windowMinutes: 15, message: "Too many login attempts." });
const registerLimit = rateLimit({ max: 50, windowMinutes: 15, message: "Too many sign-ups from this device." });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    defaultPreferences: {
      interests: readJSON(user.default_interests, []),
      pace: user.default_pace,
    },
  };
}

router.post("/register", registerLimit, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Name, email and password must be text." });
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
    }
    if (!EMAIL_PATTERN.test(email.trim()) || email.trim().length > 150) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 72 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
      return res.status(400).json({ message: "Password must be 8 to 72 characters and include a letter and a number." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [existing] = await pool.execute("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password, default_interests) VALUES (?, ?, ?, ?)",
      [name.trim(), cleanEmail, hashedPassword, "[]"]
    );

    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Account created.", user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "This account is inactive." });
    }

    const token = jwt.sign(
      { userId: user.id, tokenVersion: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login successful.", token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, interests, pace } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }
    if (!["relaxed", "balanced", "packed"].includes(pace)) {
      return res.status(400).json({ message: "Pace must be relaxed, balanced or packed." });
    }

    await pool.execute(
      "UPDATE users SET name = ?, default_interests = ?, default_pace = ? WHERE id = ?",
      [name.trim(), JSON.stringify(Array.isArray(interests) ? interests : []), pace, req.user.id]
    );

    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({ message: "Profile saved.", user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await pool.execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [req.user.id]);
    res.json({ message: "Logged out." });
  } catch (error) {
    next(error);
  }
});

export default router;
