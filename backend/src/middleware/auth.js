import jwt from "jsonwebtoken";
import pool from "../db/pool.js";

export async function requireAuth(req, res, next) {
  try {
    
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Please log in first." });
    }
    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Your session has expired. Please log in again." });
    }

    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [decoded.userId]);
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Please log in again." });
    }

    if (decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({ message: "You have been logged out. Please log in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}
