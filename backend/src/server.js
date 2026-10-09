import "dotenv/config";
import express from "express";
import cors from "cors";

import pool from "./db/pool.js";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import preferenceRoutes from "./routes/preferences.js";
import planRoutes from "./routes/plan.js";
import voteRoutes from "./routes/votes.js";
import budgetRoutes from "./routes/budget.js";
import destinationRoutes from "./routes/destinations.js";
import adminRoutes from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";
import downloadRoutes from "./routes/download.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("JWT_SECRET in backend/.env is missing or shorter than 16 characters.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);

app.use("/api/trips", tripRoutes);
app.use("/api/trips", preferenceRoutes);
app.use("/api/trips", planRoutes);
app.use("/api/trips", voteRoutes);
app.use("/api/trips", budgetRoutes);

app.use("/api/destinations", destinationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trips", downloadRoutes);
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use(errorHandler);

async function start() {
  try {
    await pool.query("SELECT 1");

    console.log("MySQL connected successfully.");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
}

start();
