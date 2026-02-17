const express = require("express");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { logActivity } = require("../utils/activity");

const router = express.Router();

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}

function ensureAdmin(req, res) {
  if (isAdminRole(req.user?.role)) {
    return true;
  }
  res.status(403).json({ message: "Only admin can perform this action" });
  return false;
}

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildSearchTerm(rawValue) {
  const value = String(rawValue || "").trim();
  return value ? `%${value}%` : "";
}

function asPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

async function listWithPagination({ page, limit, querySql, queryValues, countSql, countValues }) {
  const [result, countResult] = await Promise.all([
    pool.query(querySql, queryValues),
    pool.query(countSql, countValues || queryValues.slice(0, 1)),
  ]);

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
    },
  };
}

router.post("/logout", authRequired, async (req, res, next) => {
  try {
    await logActivity(req.user.userId, "Logout", "User logged out from dashboard");
    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    return next(err);
  }
});

router.get("/activity-log", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT ra.id, ra.actor_id, ra.action_type, ra.details, ra.created_at,
               fu.full_name AS actor_name
        FROM recent_activity ra
        LEFT JOIN faculty_users fu ON fu.id = ra.actor_id
        WHERE ($1 = '' OR ra.action_type ILIKE $1 OR COALESCE(ra.details, '') ILIKE $1 OR COALESCE(fu.full_name, '') ILIKE $1)
        ORDER BY ra.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM recent_activity ra
        LEFT JOIN faculty_users fu ON fu.id = ra.actor_id
        WHERE ($1 = '' OR ra.action_type ILIKE $1 OR COALESCE(ra.details, '') ILIKE $1 OR COALESCE(fu.full_name, '') ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.delete("/activity-log/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const activityId = asPositiveInt(req.params.id, 0);
    if (!activityId) {
      return res.status(400).json({ message: "Invalid activity id" });
    }

    const deleted = await pool.query(
      `DELETE FROM recent_activity
       WHERE id = $1
       RETURNING id`,
      [activityId]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ message: "Activity record not found" });
    }

    return res.json({ message: "Activity deleted successfully", id: deleted.rows[0].id });
  } catch (err) {
    return next(err);
  }
});

router.get("/departments", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT d.id, d.department_name, d.department_code, d.hod_name, d.created_at
        FROM departments d
        WHERE ($1 = '' OR d.department_name ILIKE $1 OR d.department_code ILIKE $1 OR COALESCE(d.hod_name, '') ILIKE $1)
        ORDER BY d.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM departments d
        WHERE ($1 = '' OR d.department_name ILIKE $1 OR d.department_code ILIKE $1 OR COALESCE(d.hod_name, '') ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/departments", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const departmentName = String(req.body.department_name || "").trim();
    const departmentCode = String(req.body.department_code || "").trim();
    const hodName = String(req.body.hod_name || "").trim() || null;

    if (!departmentName || !departmentCode) {
      return res.status(400).json({ message: "Department name and code are required" });
    }

    const duplicateName = await pool.query(
      `SELECT id
       FROM departments
       WHERE LOWER(department_name) = LOWER($1)
       LIMIT 1`,
      [departmentName]
    );

    if (duplicateName.rowCount > 0) {
      return res.status(409).json({ message: "Department already exists" });
    }

    const duplicateCode = await pool.query(
      `SELECT id
       FROM departments
       WHERE LOWER(department_code) = LOWER($1)
       LIMIT 1`,
      [departmentCode]
    );

    if (duplicateCode.rowCount > 0) {
      return res.status(409).json({ message: "Department code already exists" });
    }

    const inserted = await pool.query(
      `INSERT INTO departments (department_name, department_code, hod_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [departmentName, departmentCode, hodName]
    );

    await logActivity(req.user.userId, "Department Added", `department=${departmentName}`);
    return res.status(201).json({ message: "Department added successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Department already exists" });
    }
    return next(err);
  }
});

router.get("/branches", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT b.id, b.branch_name, b.branch_code, b.department_id, b.program_type, b.created_at,
               d.department_name
        FROM branches b
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR b.branch_name ILIKE $1 OR b.branch_code ILIKE $1 OR d.department_name ILIKE $1)
        ORDER BY b.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM branches b
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR b.branch_name ILIKE $1 OR b.branch_code ILIKE $1 OR d.department_name ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/branches", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const branchName = String(req.body.branch_name || "").trim();
    const branchCode = String(req.body.branch_code || "").trim();
    const departmentId = asPositiveInt(req.body.department_id, 0);
    const programType = String(req.body.program_type || "UG").toUpperCase();

    if (!branchName || !branchCode || !departmentId) {
      return res.status(400).json({ message: "Branch name, code and department are required" });
    }

    const department = await pool.query(`SELECT id FROM departments WHERE id = $1`, [departmentId]);
    if (department.rowCount === 0) {
      return res.status(400).json({ message: "Invalid department selected" });
    }

    const duplicateName = await pool.query(
      `SELECT id
       FROM branches
       WHERE department_id = $1
         AND LOWER(branch_name) = LOWER($2)
       LIMIT 1`,
      [departmentId, branchName]
    );

    if (duplicateName.rowCount > 0) {
      return res.status(409).json({ message: "Branch already exists in this department" });
    }

    const duplicateCode = await pool.query(
      `SELECT id
       FROM branches
       WHERE department_id = $1
         AND LOWER(branch_code) = LOWER($2)
       LIMIT 1`,
      [departmentId, branchCode]
    );

    if (duplicateCode.rowCount > 0) {
      return res.status(409).json({ message: "Branch code already exists in this department" });
    }

    const inserted = await pool.query(
      `INSERT INTO branches (branch_name, branch_code, department_id, program_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [branchName, branchCode, departmentId, programType === "PG" ? "PG" : "UG"]
    );

    await logActivity(req.user.userId, "Branch Added", `branch=${branchName}`);
    return res.status(201).json({ message: "Branch added successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Branch already exists in this department" });
    }
    return next(err);
  }
});

router.get("/sections", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT s.id, s.section_name, s.branch_id, s.semester_id, s.student_strength, s.created_at,
               b.branch_name,
               sem.semester_number, sem.academic_year
        FROM sections s
        LEFT JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        WHERE ($1 = '' OR s.section_name ILIKE $1 OR COALESCE(b.branch_name, '') ILIKE $1 OR sem.academic_year ILIKE $1)
        ORDER BY s.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM sections s
        LEFT JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        WHERE ($1 = '' OR s.section_name ILIKE $1 OR COALESCE(b.branch_name, '') ILIKE $1 OR sem.academic_year ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/sections", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const sectionName = String(req.body.section_name || "").trim();
    const branchId = asPositiveInt(req.body.branch_id, 0);
    const semesterId = asPositiveInt(req.body.semester_id, 0);
    const studentStrength = asPositiveInt(req.body.student_strength, 60);

    if (!sectionName || !branchId || !semesterId) {
      return res.status(400).json({ message: "Section name, branch and semester are required" });
    }

    const semester = await pool.query(
      `SELECT id, branch_id
       FROM semesters
       WHERE id = $1`,
      [semesterId]
    );

    if (semester.rowCount === 0) {
      return res.status(400).json({ message: "Invalid semester selected" });
    }

    if (Number(semester.rows[0].branch_id) !== branchId) {
      return res.status(400).json({ message: "Selected semester does not belong to the selected branch" });
    }

    const duplicateSection = await pool.query(
      `SELECT id
       FROM sections
       WHERE branch_id = $1
         AND LOWER(section_name) = LOWER($2)
       LIMIT 1`,
      [branchId, sectionName]
    );

    if (duplicateSection.rowCount > 0) {
      return res.status(409).json({ message: "Section already exists in this branch" });
    }

    const inserted = await pool.query(
      `INSERT INTO sections (section_name, branch_id, semester_id, student_strength)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sectionName, branchId, semesterId, studentStrength]
    );

    await logActivity(req.user.userId, "Section Added", `section=${sectionName}`);
    return res.status(201).json({ message: "Section added successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Section already exists in this branch" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid branch or semester selected" });
    }
    return next(err);
  }
});

router.get("/faculty", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        WITH faculty_view AS (
          SELECT fu.id, fu.faculty_id, fu.full_name, fu.email, fu.mobile_number, fu.created_at,
                 COALESCE(STRING_AGG(DISTINCT d.department_name, ', '), '-') AS departments,
                 COALESCE(STRING_AGG(DISTINCT s.subject_name, ', '), '-') AS subjects
          FROM faculty_users fu
          LEFT JOIN faculty_departments fd ON fd.faculty_user_id = fu.id
          LEFT JOIN departments d ON d.id = fd.department_id
          LEFT JOIN faculty_subjects fs ON fs.faculty_user_id = fu.id
          LEFT JOIN subjects s ON s.id = fs.subject_id
          WHERE LOWER(fu.role) = 'faculty'
          GROUP BY fu.id
        )
        SELECT *
        FROM faculty_view
        WHERE ($1 = '' OR full_name ILIKE $1 OR faculty_id ILIKE $1 OR email ILIKE $1 OR departments ILIKE $1 OR subjects ILIKE $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        WITH faculty_view AS (
          SELECT fu.id, fu.faculty_id, fu.full_name, fu.email, fu.mobile_number, fu.created_at,
                 COALESCE(STRING_AGG(DISTINCT d.department_name, ', '), '-') AS departments,
                 COALESCE(STRING_AGG(DISTINCT s.subject_name, ', '), '-') AS subjects
          FROM faculty_users fu
          LEFT JOIN faculty_departments fd ON fd.faculty_user_id = fu.id
          LEFT JOIN departments d ON d.id = fd.department_id
          LEFT JOIN faculty_subjects fs ON fs.faculty_user_id = fu.id
          LEFT JOIN subjects s ON s.id = fs.subject_id
          WHERE LOWER(fu.role) = 'faculty'
          GROUP BY fu.id
        )
        SELECT COUNT(*)::int AS total
        FROM faculty_view
        WHERE ($1 = '' OR full_name ILIKE $1 OR faculty_id ILIKE $1 OR email ILIKE $1 OR departments ILIKE $1 OR subjects ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.get("/subjects", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT s.id, s.subject_name, s.subject_code, s.subject_type, s.department_id, s.branch_id, s.semester_id, s.created_at,
               d.department_name,
               b.branch_name,
               sem.semester_number, sem.academic_year
        FROM subjects s
        JOIN departments d ON d.id = s.department_id
        JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        WHERE ($1 = '' OR s.subject_name ILIKE $1 OR s.subject_code ILIKE $1 OR d.department_name ILIKE $1 OR b.branch_name ILIKE $1)
        ORDER BY s.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM subjects s
        JOIN departments d ON d.id = s.department_id
        JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        WHERE ($1 = '' OR s.subject_name ILIKE $1 OR s.subject_code ILIKE $1 OR d.department_name ILIKE $1 OR b.branch_name ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/subjects", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const subjectName = String(req.body.subject_name || "").trim();
    const subjectCode = String(req.body.subject_code || "").trim();
    const departmentId = asPositiveInt(req.body.department_id, 0);
    const branchId = asPositiveInt(req.body.branch_id, 0);
    const semesterId = asPositiveInt(req.body.semester_id, 0);
    const subjectType = String(req.body.subject_type || "").trim();
    const theoryHours = asPositiveInt(req.body.theory_hours_per_week, subjectType === "Practical" ? 0 : 3);
    const practicalHours = asPositiveInt(req.body.practical_hours_per_week, subjectType === "Theory" ? 0 : 2);
    const totalHours = asPositiveInt(req.body.total_hours_semester, theoryHours + practicalHours);

    if (!subjectName || !subjectCode || !departmentId || !branchId || !semesterId || !subjectType) {
      return res.status(400).json({
        message: "Subject name, code, department, branch, semester and type are required",
      });
    }

    if (!["Theory", "Practical", "Both"].includes(subjectType)) {
      return res.status(400).json({ message: "Subject type must be Theory, Practical or Both" });
    }

    const branch = await pool.query(
      `SELECT id, department_id
       FROM branches
       WHERE id = $1`,
      [branchId]
    );
    if (branch.rowCount === 0 || Number(branch.rows[0].department_id) !== departmentId) {
      return res.status(400).json({ message: "Selected branch does not belong to selected department" });
    }

    const semester = await pool.query(
      `SELECT id, branch_id
       FROM semesters
       WHERE id = $1`,
      [semesterId]
    );
    if (semester.rowCount === 0 || Number(semester.rows[0].branch_id) !== branchId) {
      return res.status(400).json({ message: "Selected semester does not belong to selected branch" });
    }

    const duplicateCode = await pool.query(
      `SELECT id
       FROM subjects
       WHERE branch_id = $1
         AND LOWER(subject_code) = LOWER($2)
       LIMIT 1`,
      [branchId, subjectCode]
    );
    if (duplicateCode.rowCount > 0) {
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }

    const inserted = await pool.query(
      `INSERT INTO subjects
      (subject_name, subject_code, department_id, branch_id, semester_id, subject_type,
       theory_hours_per_week, practical_hours_per_week, total_hours_semester)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        subjectName,
        subjectCode,
        departmentId,
        branchId,
        semesterId,
        subjectType,
        theoryHours,
        practicalHours,
        totalHours,
      ]
    );

    await logActivity(req.user.userId, "Subject Added", `subject=${subjectName}`);
    return res.status(201).json({ message: "Subject added successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid department, branch or semester selected" });
    }
    return next(err);
  }
});

router.get("/semesters", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT sem.id, sem.semester_number, sem.academic_year, sem.branch_id, sem.created_at,
               b.branch_name,
               d.department_name
        FROM semesters sem
        JOIN branches b ON b.id = sem.branch_id
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR sem.academic_year ILIKE $1 OR b.branch_name ILIKE $1 OR d.department_name ILIKE $1)
        ORDER BY sem.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM semesters sem
        JOIN branches b ON b.id = sem.branch_id
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR sem.academic_year ILIKE $1 OR b.branch_name ILIKE $1 OR d.department_name ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/semesters", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const semesterNumber = asPositiveInt(req.body.semester_number, 0);
    const academicYear = String(req.body.academic_year || "").trim();
    const branchId = asPositiveInt(req.body.branch_id, 0);

    if (!semesterNumber || !academicYear || !branchId) {
      return res.status(400).json({ message: "Semester number, academic year and branch are required" });
    }

    const branch = await pool.query(`SELECT id FROM branches WHERE id = $1`, [branchId]);
    if (branch.rowCount === 0) {
      return res.status(400).json({ message: "Invalid branch selected" });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM semesters
       WHERE branch_id = $1 AND semester_number = $2 AND academic_year = $3
       LIMIT 1`,
      [branchId, semesterNumber, academicYear]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "Semester already exists for this branch and academic year" });
    }

    const inserted = await pool.query(
      `INSERT INTO semesters (semester_number, academic_year, branch_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [semesterNumber, academicYear, branchId]
    );

    await logActivity(req.user.userId, "Semester Added", `semester=${semesterNumber}, year=${academicYear}`);
    return res.status(201).json({ message: "Semester added successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Semester already exists for this branch and academic year" });
    }
    return next(err);
  }
});

module.exports = router;
