const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

async function listDepartments(db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, department_name, department_code
     FROM departments
     ORDER BY department_name`
  );
  return result.rows;
}

async function listSubjects(db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, subject_name, subject_code
     FROM subjects
     ORDER BY subject_name`
  );
  return result.rows;
}

async function getDepartmentsByIds(ids, db) {
  const conn = getDb(db);
  if (!ids.length) return [];
  const result = await conn.query(
    `SELECT id, department_name
     FROM departments
     WHERE id = ANY($1::int[])`,
    [ids]
  );
  return result.rows;
}

async function getSubjectsByIds(ids, db) {
  const conn = getDb(db);
  if (!ids.length) return [];
  const result = await conn.query(
    `SELECT id, subject_name
     FROM subjects
     WHERE id = ANY($1::int[])`,
    [ids]
  );
  return result.rows;
}

module.exports = {
  listDepartments,
  listSubjects,
  getDepartmentsByIds,
  getSubjectsByIds,
};

