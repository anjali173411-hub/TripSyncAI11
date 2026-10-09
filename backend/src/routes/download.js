import express from "express";
import PDFDocument from "pdfkit";

import pool, { readJSON } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { connectMongo, savePDF } from "../db/mongo.js";
import { recalcCosts } from "../services/aiPlanner.js";

function rupees(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

const router = express.Router();

router.get("/:id/download", requireAuth, async (req, res, next) => {
try {
const [rows] = await pool.execute(
"SELECT * FROM trips WHERE id = ?",
[req.params.id]
);

const trip = rows[0];

if (!trip) {
  return res.status(404).json({
    message: "Trip not found",
  });
}

const [members] = await pool.execute(
  `SELECT user_id
   FROM trip_members
   WHERE trip_id = ? AND user_id = ?`,
  [trip.id, req.user.id]
);

if (members.length === 0) {
  return res.status(403).json({
    message: "You are not a member of this trip.",
  });
}

if (!trip.itinerary) {
  return res.status(400).json({
    message: "There is no itinerary to download yet.",
  });
}

const itinerary = recalcCosts(readJSON(trip.itinerary, {}));

const pdf = new PDFDocument();
const chunks = [];

pdf.on("data", (chunk) => {
  chunks.push(chunk);
});

const pdfFinished = new Promise((resolve, reject) => {
  pdf.on("end", resolve);
  pdf.on("error", reject);
});

pdf.fontSize(20).text("TripSync AI - Travel Itinerary");
if (trip.title) {
  pdf.fontSize(15).text(trip.title);
}
pdf.moveDown();

pdf.fontSize(12).text(`Destination: ${trip.destination || "Not specified"}`);
pdf.text(`Start location: ${trip.start_location}`);
pdf.text(`Dates: ${trip.start_date} to ${trip.end_date}`);
pdf.text(`Travellers: ${trip.travellers}`);
pdf.text(`Budget: ${rupees(trip.budget)}`);

pdf.moveDown();

if (itinerary.summary) {
  pdf.fontSize(14).text("Trip Summary");
  pdf.fontSize(11).text(itinerary.summary);
  pdf.moveDown();
}

pdf.fontSize(14).text("Estimated Cost");
pdf.fontSize(11);
for (const [category, value] of Object.entries(itinerary.cost_breakdown || {})) {
  pdf.text(`${category}: ${rupees(value)}`);
}
pdf.text(`Total: ${rupees(itinerary.total_estimated_cost)}`);
pdf.moveDown();

for (const day of itinerary.days || []) {
  pdf.fontSize(15).text(`Day ${day.day}: ${day.title || ""}`);

  if (day.date) {
    pdf.fontSize(10).text(`Date: ${day.date}`);
  }

  pdf.moveDown(0.5);

  for (const activity of day.activities || []) {
    pdf.fontSize(12).text(
      `${activity.time || ""} - ${activity.title || "Activity"}`
    );

    if (activity.description) {
      pdf.fontSize(10).text(activity.description);
    }

    pdf.fontSize(10).text(
      `Estimated cost: ${rupees(activity.estimated_cost)}`
    );

    pdf.moveDown(0.5);
  }

  pdf.moveDown();
}

pdf.end();

await pdfFinished;

const pdfData = Buffer.concat(chunks);

const fileName = `tripsync-itinerary-${trip.id}.pdf`;

try {
  await connectMongo();
  await savePDF({ trip, user: req.user, itinerary, fileName, pdfData });
} catch (error) {
  console.error("MongoDB save failed:", error.message);
  return res.status(503).json({
    message: "Couldn't save the PDF to MongoDB. Check that MongoDB is running and MONGO_URI is correct.",
  });
}

res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  `attachment; filename="${fileName}"`
);

res.send(pdfData);

} catch (error) {
next(error);
}
});

export default router;
