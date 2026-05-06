const pool = require("../config/db");

async function logActivity(actorId, actionType, details = null) {
  try {
    await pool.query(
      `INSERT INTO recent_activity (actor_id, action_type, details)
       VALUES ($1, $2, $3)`,
      [actorId || null, actionType, details]
    );
  } catch (err) {
    console.error("Failed to log activity:", err.message);
  }
}

module.exports = { logActivity };

