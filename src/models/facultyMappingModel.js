const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

async function addFacultyDepartments(facultyUserId, departmentIds, db) {
  const conn = getDb(db);
  if (!departmentIds.length) return;

  await conn.query(
    `INSERT INTO faculty_departments (faculty_user_id, department_id)
     SELECT $1, UNNEST($2::int[])
     ON CONFLICT (faculty_user_id, department_id) DO NOTHING`,
    [facultyUserId, departmentIds]
  );
}

async function addFacultyUserSubjects(facultyUserId, subjectIds, db) {
  const conn = getDb(db);
  if (!subjectIds.length) return;

  await conn.query(
    `INSERT INTO faculty_subjects (faculty_user_id, subject_id)
     SELECT $1, UNNEST($2::int[])
     ON CONFLICT (faculty_user_id, subject_id) WHERE faculty_user_id IS NOT NULL DO NOTHING`,
    [facultyUserId, subjectIds]
  );
}

module.exports = {
  addFacultyDepartments,
  addFacultyUserSubjects,
};

