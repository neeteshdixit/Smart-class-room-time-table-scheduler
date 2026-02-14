const pool = require("../config/db");

async function invalidateActiveResetTokens(facultyUserId) {
  await pool.query(
    `UPDATE password_reset_tokens
     SET is_used = TRUE
     WHERE faculty_user_id = $1
       AND is_used = FALSE`,
    [facultyUserId]
  );
}

async function createPasswordResetToken(facultyUserId, email, resetTokenHash) {
  await pool.query(
    `INSERT INTO password_reset_tokens (faculty_user_id, email, reset_token_hash, expiry_time)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [facultyUserId, email.toLowerCase(), resetTokenHash]
  );
}

async function findValidPasswordResetToken(facultyUserId, resetTokenHash) {
  const result = await pool.query(
    `SELECT *
     FROM password_reset_tokens
     WHERE faculty_user_id = $1
       AND reset_token_hash = $2
       AND is_used = FALSE
       AND expiry_time > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [facultyUserId, resetTokenHash]
  );
  return result.rows[0] || null;
}

async function markPasswordResetTokenUsed(id) {
  await pool.query(
    `UPDATE password_reset_tokens
     SET is_used = TRUE
     WHERE id = $1`,
    [id]
  );
}

module.exports = {
  invalidateActiveResetTokens,
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
};

