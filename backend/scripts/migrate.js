import "dotenv/config";

import pool from "../src/db/pool.js";

async function hasColumn(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].total) > 0;
}

async function addColumn(table, column, definition) {
  if (await hasColumn(table, column)) {
    console.log(`  ${table}.${column} already exists`);
    return false;
  }
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  added ${table}.${column}`);
  return true;
}

console.log("Updating the database...");

await addColumn("trips", "title", "VARCHAR(120) NULL AFTER id");

await addColumn("destinations", "images", "JSON NULL");
const addedTier = await addColumn(
  "destinations",
  "cost_tier",
  "VARCHAR(20) NOT NULL DEFAULT 'mid-range'"
);

if (addedTier) {
  await pool.query(
    `UPDATE destinations
     SET cost_tier = CASE
       WHEN average_cost <= 5000 THEN 'budget'
       WHEN average_cost <= 15000 THEN 'mid-range'
       ELSE 'luxury'
     END`
  );
  console.log("  set cost tiers for existing destinations");
}

console.log("Done.");
await pool.end();
