require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

async function run() {
  const schemaPath = path.join(__dirname, "..", "src", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  try {
    await pool.query(schemaSql);
    console.log("Database schema initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize database schema.", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

