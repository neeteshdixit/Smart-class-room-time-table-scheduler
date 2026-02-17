const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

async function findDuplicateByFacultyEmailMobile(facultyId, email, mobileNumber, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT faculty_id, email, mobile_number
     FROM faculty_users
     WHERE faculty_id = $1 OR email = $2 OR mobile_number = $3
     LIMIT 1`,
    [facultyId, email.toLowerCase(), mobileNumber]
  );
  return result.rows[0] || null;
}

async function countAdmins(db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT COUNT(*)::int AS total
     FROM faculty_users
     WHERE LOWER(role) = 'admin'`
  );
  return result.rows[0].total;
}

async function createFacultyUser(payload, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `INSERT INTO faculty_users
    (faculty_id, full_name, department, designation, email, mobile_number, password_hash, gender, dob, qualification,
     experience_years, address, joining_date, profile_photo_url, role, employee_type, office_location)
    VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id, faculty_id, full_name, email, mobile_number, role, created_at`,
    [
      payload.faculty_id,
      payload.full_name,
      payload.department,
      payload.designation,
      payload.email.toLowerCase(),
      payload.mobile_number,
      payload.password_hash,
      payload.gender,
      payload.dob,
      payload.qualification,
      payload.experience_years,
      payload.address,
      payload.joining_date,
      payload.profile_photo_url || null,
      payload.role,
      payload.employee_type || "Permanent",
      payload.office_location || null,
    ]
  );
  return result.rows[0];
}

async function findByIdentifier(identifier) {
  const result = await pool.query(
    `SELECT * FROM faculty_users
     WHERE LOWER(faculty_id) = LOWER($1) OR LOWER(email) = LOWER($1) OR mobile_number = $1
     LIMIT 1`,
    [identifier.trim()]
  );
  return result.rows[0] || null;
}

async function findBasicById(id) {
  const result = await pool.query(
    `SELECT id, faculty_id, full_name, department, designation, email, mobile_number, role
     FROM faculty_users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findAuthById(id, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, faculty_id, full_name, email, role, password_hash
     FROM faculty_users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM faculty_users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email.trim()]
  );
  return result.rows[0] || null;
}

async function findByEmailOrFacultyId(identifier) {
  const value = String(identifier || "").trim();
  const result = await pool.query(
    `SELECT *
     FROM faculty_users
     WHERE LOWER(email) = LOWER($1) OR LOWER(faculty_id) = LOWER($1)
     LIMIT 1`,
    [value]
  );
  return result.rows[0] || null;
}

async function updatePasswordHash(id, passwordHash) {
  await pool.query(
    `UPDATE faculty_users
     SET password_hash = $1
     WHERE id = $2`,
    [passwordHash, id]
  );
}

async function updateLastLogin(id) {
  await pool.query(`UPDATE faculty_users SET last_login = NOW() WHERE id = $1`, [id]);
}

async function deleteUserById(id, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `DELETE FROM faculty_users
     WHERE id = $1
     RETURNING id, faculty_id, full_name, email, role`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  findDuplicateByFacultyEmailMobile,
  countAdmins,
  createFacultyUser,
  findByIdentifier,
  findBasicById,
  findAuthById,
  findByEmail,
  findByEmailOrFacultyId,
  updatePasswordHash,
  updateLastLogin,
  deleteUserById,
};
