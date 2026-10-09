import "dotenv/config";
import bcrypt from "bcryptjs";

import pool from "../src/db/pool.js";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const name = String(process.env.ADMIN_NAME || "Administrator").trim();

function problemWith(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Set ADMIN_EMAIL in backend/.env to a valid email.";
  if (password.length < 8 || password.length > 72 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
    return "Set ADMIN_PASSWORD in backend/.env: 8 to 72 characters with a letter and a number.";
  }
  return "";
}

const problem = problemWith(email, password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const hashedPassword = await bcrypt.hash(password, 10);
const [rows] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);

if (rows.length > 0) {
  await pool.execute(
    `UPDATE users
     SET role = 'admin', password = ?, is_active = TRUE, token_version = token_version + 1
     WHERE email = ?`,
    [hashedPassword, email]
  );
  console.log(`${email} is an admin. Its password was set from ADMIN_PASSWORD.`);
} else {
  await pool.execute(
    "INSERT INTO users (name, email, password, role, default_interests) VALUES (?, ?, ?, 'admin', '[]')",
    [name, email, hashedPassword]
  );
  console.log(`Admin account created: ${email}`);
}

await pool.end();
