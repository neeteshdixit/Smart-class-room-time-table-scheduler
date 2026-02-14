require("dotenv").config();
const app = require("./src/app");
const pool = require("./src/config/db");

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await pool.query("SELECT 1");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to PostgreSQL. Check DATABASE_URL.", err.message);
    process.exit(1);
  }
}

start();

