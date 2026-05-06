const pool = require("../config/db");

async function createOtpVerification(facultyUserId, mobileNumber, otpCode) {
  await pool.query(
    `INSERT INTO otp_verifications (faculty_user_id, mobile_number, otp_code, expiry_time)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [facultyUserId, mobileNumber, otpCode]
  );
}

async function findValidOtp(facultyUserId, otpCode) {
  const result = await pool.query(
    `SELECT * FROM otp_verifications
     WHERE faculty_user_id = $1
       AND otp_code = $2
       AND is_used = FALSE
       AND expiry_time > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [facultyUserId, otpCode]
  );
  return result.rows[0] || null;
}

async function markOtpUsed(id) {
  await pool.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [id]);
}

async function invalidateActiveOtps(facultyUserId) {
  await pool.query(
    `UPDATE otp_verifications
     SET is_used = TRUE
     WHERE faculty_user_id = $1
       AND is_used = FALSE`,
    [facultyUserId]
  );
}

module.exports = {
  createOtpVerification,
  findValidOtp,
  markOtpUsed,
  invalidateActiveOtps,
};
