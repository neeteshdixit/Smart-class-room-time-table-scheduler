const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildCodeBase(name, fallback, maxLength) {
  const cleaned = normalizeName(name)
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  let base = "";
  if (parts.length > 1) {
    base = parts.map((part) => part.charAt(0)).join("");
    if (base.length < 3) {
      base = parts.join("");
    }
  } else if (parts.length === 1) {
    base = parts[0];
  }

  base = base.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!base) base = fallback;

  return base.slice(0, maxLength);
}

function buildAcademicYearLabel() {
  const startYear = new Date().getUTCFullYear();
  const endYear = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYear}`;
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

async function findDepartmentByName(departmentName, db) {
  const conn = getDb(db);
  const normalized = normalizeName(departmentName);
  if (!normalized) return null;

  const result = await conn.query(
    `SELECT id, department_name, department_code
     FROM departments
     WHERE LOWER(department_name) = LOWER($1)
     ORDER BY id
     LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function createDepartmentByName(departmentName, db) {
  const conn = getDb(db);
  const normalized = normalizeName(departmentName);
  const codeBase = buildCodeBase(normalized, "DEPT", 25);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const trimmedBase = codeBase.slice(0, Math.max(1, 25 - suffix.length));
    const departmentCode = `${trimmedBase}${suffix}`;

    const result = await conn.query(
      `INSERT INTO departments (department_name, department_code)
       VALUES ($1, $2)
       ON CONFLICT (department_code) DO NOTHING
       RETURNING id, department_name, department_code`,
      [normalized, departmentCode]
    );

    if (result.rowCount > 0) {
      return result.rows[0];
    }
  }

  throw new Error("Unable to generate a unique department code.");
}

async function findOrCreateDepartmentByName(departmentName, db) {
  const existing = await findDepartmentByName(departmentName, db);
  if (existing) return existing;
  const created = await createDepartmentByName(departmentName, db);
  return created;
}

async function findSubjectByName(subjectName, db) {
  const conn = getDb(db);
  const normalized = normalizeName(subjectName);
  if (!normalized) return null;

  const result = await conn.query(
    `SELECT id, subject_name, subject_code
     FROM subjects
     WHERE LOWER(subject_name) = LOWER($1)
     ORDER BY id
     LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function findDepartmentById(departmentId, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, department_name
     FROM departments
     WHERE id = $1
     LIMIT 1`,
    [departmentId]
  );
  return result.rows[0] || null;
}

async function getDepartmentSemesterId(departmentId, db) {
  const conn = getDb(db);

  const directSemester = await conn.query(
    `SELECT s.id
     FROM semesters s
     JOIN branches b ON b.id = s.branch_id
     WHERE b.department_id = $1
     ORDER BY s.id
     LIMIT 1`,
    [departmentId]
  );
  if (directSemester.rowCount > 0) {
    return directSemester.rows[0].id;
  }

  const anySemester = await conn.query(
    `SELECT id
     FROM semesters
     ORDER BY id
     LIMIT 1`
  );
  if (anySemester.rowCount > 0) {
    return anySemester.rows[0].id;
  }

  const department = await findDepartmentById(departmentId, conn);
  if (!department) {
    throw new Error("Unable to create subject because the related department was not found.");
  }

  const existingBranch = await conn.query(
    `SELECT id
     FROM branches
     WHERE department_id = $1
     ORDER BY id
     LIMIT 1`,
    [departmentId]
  );

  let branchId = existingBranch.rows[0]?.id || null;
  if (!branchId) {
    const branchName = `${department.department_name} General`;
    const branchCodeBase = buildCodeBase(`${department.department_name} GEN`, "BR", 25);

    for (let attempt = 0; attempt < 1000 && !branchId; attempt += 1) {
      const suffix = attempt === 0 ? "" : String(attempt + 1);
      const trimmedBase = branchCodeBase.slice(0, Math.max(1, 25 - suffix.length));
      const branchCode = `${trimmedBase}${suffix}`;

      const insertedBranch = await conn.query(
        `INSERT INTO branches (branch_name, branch_code, department_id, program_type)
         VALUES ($1, $2, $3, 'UG')
         ON CONFLICT (branch_code) DO NOTHING
         RETURNING id`,
        [branchName, branchCode, departmentId]
      );

      if (insertedBranch.rowCount > 0) {
        branchId = insertedBranch.rows[0].id;
      }
    }
  }

  if (!branchId) {
    throw new Error("Unable to create a default branch for subject mapping.");
  }

  const insertedSemester = await conn.query(
    `INSERT INTO semesters (semester_number, academic_year, branch_id)
     VALUES (1, $1, $2)
     RETURNING id`,
    [buildAcademicYearLabel(), branchId]
  );

  return insertedSemester.rows[0].id;
}

async function createSubjectByName(subjectName, departmentId, db) {
  const conn = getDb(db);
  const normalized = normalizeName(subjectName);

  if (!departmentId) {
    throw new Error("At least one department is required before creating new subjects.");
  }

  const semesterId = await getDepartmentSemesterId(departmentId, conn);
  const codeBase = buildCodeBase(normalized, "SUB", 40);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const trimmedBase = codeBase.slice(0, Math.max(1, 40 - suffix.length));
    const subjectCode = `${trimmedBase}${suffix}`;

    const result = await conn.query(
      `INSERT INTO subjects (subject_name, subject_code, department_id, semester_id, subject_type)
       VALUES ($1, $2, $3, $4, 'Theory')
       ON CONFLICT (subject_code) DO NOTHING
       RETURNING id, subject_name, subject_code`,
      [normalized, subjectCode, departmentId, semesterId]
    );

    if (result.rowCount > 0) {
      return result.rows[0];
    }
  }

  throw new Error("Unable to generate a unique subject code.");
}

async function findOrCreateSubjectByName(subjectName, departmentId, db) {
  const existing = await findSubjectByName(subjectName, db);
  if (existing) return existing;
  const created = await createSubjectByName(subjectName, departmentId, db);
  return created;
}

module.exports = {
  listDepartments,
  listSubjects,
  getDepartmentsByIds,
  getSubjectsByIds,
  findOrCreateDepartmentByName,
  findOrCreateSubjectByName,
};
