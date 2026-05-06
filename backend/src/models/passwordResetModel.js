const pool = require("../config/db");

async function cleanupExpiredResetOtps() {
  await pool.query(
    `DELETE FROM password_reset_otps
     WHERE expiry_time <= NOW()`
  );
}

async function deleteResetOtpsByUser(userId) {
  await pool.query(
    `DELETE FROM password_reset_otps
     WHERE user_id = $1`,
    [userId]
  );
}

async function createPasswordResetOtp(userId, email, otpCode, expiryMinutes = 5) {
  const result = await pool.query(
    `INSERT INTO password_reset_otps (user_id, email, otp_code, expiry_time)
     VALUES ($1, LOWER($2), $3, NOW() + ($4 * INTERVAL '1 minute'))
     RETURNING id, user_id, email, otp_code, expiry_time, attempt_count, is_verified, created_at`,
    [userId, email, otpCode, expiryMinutes]
  );
  return result.rows[0];
}

async function findLatestActiveResetOtpByEmail(email) {
  const result = await pool.query(
    `SELECT *
     FROM password_reset_otps
     WHERE LOWER(email) = LOWER($1)
       AND is_verified = FALSE
       AND expiry_time > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function incrementResetOtpAttempt(id) {
  const result = await pool.query(
    `UPDATE password_reset_otps
     SET attempt_count = attempt_count + 1
     WHERE id = $1
     RETURNING attempt_count`,
    [id]
  );
  return result.rows[0] || null;
}

async function markResetOtpVerified(id) {
  await pool.query(
    `UPDATE password_reset_otps
     SET is_verified = TRUE
     WHERE id = $1`,
    [id]
  );
}

async function findLatestVerifiedResetOtpByEmail(email) {
  const result = await pool.query(
    `SELECT *
     FROM password_reset_otps
     WHERE LOWER(email) = LOWER($1)
       AND is_verified = TRUE
       AND expiry_time > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function deleteResetOtpById(id) {
  await pool.query(
    `DELETE FROM password_reset_otps
     WHERE id = $1`,
    [id]
  );
}

module.exports = {
  cleanupExpiredResetOtps,
  deleteResetOtpsByUser,
  createPasswordResetOtp,
  findLatestActiveResetOtpByEmail,
  incrementResetOtpAttempt,
  markResetOtpVerified,
  findLatestVerifiedResetOtpByEmail,
  deleteResetOtpById,
};
