const { Pool } = require("pg");

function firstNonEmpty(values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}


function buildConnectionStringFromParts() {
  const host = String(process.env.PGHOST || "").trim();
  const port = String(process.env.PGPORT || "5432").trim();
  const database = String(process.env.PGDATABASE || "").trim();
  const user = String(process.env.PGUSER || "").trim();
  const password = String(process.env.PGPASSWORD || "").trim();

  if (!host || !database || !user) {
    return "";
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const authPart = password ? `${encodedUser}:${encodedPassword}` : encodedUser;
  return `postgresql://${authPart}@${host}:${port}/${database}`;
}

const resolvedConnectionString = firstNonEmpty([
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.INTERNAL_DATABASE_URL,
  buildConnectionStringFromParts(),
]);

if (!resolvedConnectionString) {
  throw new Error(
    "PostgreSQL connection is not configured. Set DATABASE_URL in Render (recommended) or set PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD."
  );
}

const pool = new Pool({
  connectionString: resolvedConnectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL client error", err);
});

module.exports = pool;
