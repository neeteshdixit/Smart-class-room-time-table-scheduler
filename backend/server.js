const shouldLoadDotenv =
  process.env.NODE_ENV !== "production" && String(process.env.RENDER || "").toLowerCase() !== "true";

if (shouldLoadDotenv) {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
}
const app = require("./src/app");
const pool = require("./src/config/db");
const { initializeSchema } = require("./src/db/initializeSchema");

const PORT = Number(process.env.PORT) || 5000;

function getDatabaseHostLabel() {
  try {
    const url = new URL(String(process.env.DATABASE_URL || ""));
    return `${url.hostname}:${url.port || "5432"}`;
  } catch (err) {
    return "missing_or_invalid_DATABASE_URL";
  }
}

async function start() {
  try {
    await pool.query("SELECT 1");
    await initializeSchema(pool, { log: false });
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(
      `Failed to connect to PostgreSQL. Check DATABASE_URL (host=${getDatabaseHostLabel()}).`,
      err?.message || err
    );
    process.exit(1);
  }
}

start();
