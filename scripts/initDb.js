require("dotenv").config();
const pool = require("../backend/src/config/db");
const { initializeSchema } = require("../backend/src/db/initializeSchema");

async function run() {
  try {
    await initializeSchema(pool);
  } catch (err) {
    console.error("Failed to initialize database schema.", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
