const fs = require("fs");
const path = require("path");

let initPromise = null;

function readSchemaSql() {
  const schemaPath = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

async function initializeSchema(pool, { log = true } = {}) {
  if (!initPromise) {
    initPromise = (async () => {
      const schemaSql = readSchemaSql();
      await pool.query(schemaSql);
      if (log) {
        console.log("Database schema initialized successfully.");
      }
    })();
  }

  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

module.exports = { initializeSchema };
