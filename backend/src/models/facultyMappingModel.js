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

  try {
    await conn.query(
      `INSERT INTO faculty_subjects (faculty_user_id, subject_id)
       SELECT $1, UNNEST($2::int[])
       ON CONFLICT (faculty_user_id, subject_id) WHERE faculty_user_id IS NOT NULL DO NOTHING`,
      [facultyUserId, subjectIds]
    );
  } catch (err) {
    // Fallback for older schemas that do not yet have the expected unique index.
    if (err.code !== "42P10") {
      throw err;
    }

    await conn.query(
      `INSERT INTO faculty_subjects (faculty_user_id, subject_id)
       SELECT $1, src.subject_id
       FROM UNNEST($2::int[]) AS src(subject_id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM faculty_subjects fs
         WHERE fs.faculty_user_id = $1
           AND fs.subject_id = src.subject_id
       )`,
      [facultyUserId, subjectIds]
    );
  }
}

async function findFacultyUserSubjectByName(subjectName, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, subject_name
     FROM faculty_user_subjects
     WHERE LOWER(subject_name) = LOWER($1)
     LIMIT 1`,
    [subjectName]
  );
  return result.rows[0] || null;
}

async function createFacultyUserSubject(subjectName, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `INSERT INTO faculty_user_subjects (subject_name)
     VALUES ($1)
     RETURNING id, subject_name`,
    [subjectName]
  );
  return result.rows[0];
}

async function findOrCreateFacultyUserSubject(subjectName, db) {
  const existing = await findFacultyUserSubjectByName(subjectName, db);
  if (existing) return existing;

  try {
    return await createFacultyUserSubject(subjectName, db);
  } catch (err) {
    if (err.code === "23505") {
      const row = await findFacultyUserSubjectByName(subjectName, db);
      if (row) return row;
    }
    throw err;
  }
}

async function addFacultyUserManualSubjects(facultyUserId, subjectNames, db) {
  const conn = getDb(db);
  if (!subjectNames.length) return [];

  const subjectRows = [];
  for (const subjectName of subjectNames) {
    const subject = await findOrCreateFacultyUserSubject(subjectName, conn);
    subjectRows.push(subject);
  }

  const subjectIds = [...new Set(subjectRows.map((row) => row.id))];
  await conn.query(
    `INSERT INTO faculty_user_subject_mappings (faculty_user_id, subject_id)
     SELECT $1, UNNEST($2::int[])
     ON CONFLICT (faculty_user_id, subject_id) DO NOTHING`,
    [facultyUserId, subjectIds]
  );

  return subjectRows;
}

module.exports = {
  addFacultyDepartments,
  addFacultyUserSubjects,
  addFacultyUserManualSubjects,
};
