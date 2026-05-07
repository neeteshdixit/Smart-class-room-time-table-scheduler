const express = require("express");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { logActivity } = require("../utils/activity");
const authService = require("../services/authService");

const router = express.Router();
const DEFAULT_SLOT_DURATION_MINUTES = 50;
const DEFAULT_WORKING_DAYS = "Mon-Fri";

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

function dashboardAdminRequired(req, res, next) {
  return authRequired(req, res, () => {
    if (!isAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Only admin can access dashboard management APIs." });
    }
    return next();
  });
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

function asNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function parseIdArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
      }
    } catch (err) {
      return [...new Set(value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0))];
    }
  }

  return [];
}

async function validateFacultyUsersForSubject(client, facultyUserIds, departmentId) {
  const normalizedIds = [...new Set(facultyUserIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (!normalizedIds.length) {
    return { ok: false, message: "Assign at least one faculty to this subject" };
  }

  const facultyResult = await client.query(
    `SELECT id, full_name
     FROM faculty_users
     WHERE id = ANY($1::int[])
       AND LOWER(role) = 'faculty'`,
    [normalizedIds]
  );
  if (facultyResult.rowCount !== normalizedIds.length) {
    return { ok: false, message: "One or more selected faculty members are invalid" };
  }

  const departmentResult = await client.query(
    `SELECT DISTINCT faculty_user_id
     FROM faculty_departments
     WHERE department_id = $1
       AND faculty_user_id = ANY($2::int[])`,
    [departmentId, normalizedIds]
  );

  if (departmentResult.rowCount !== normalizedIds.length) {
    const linked = new Set(departmentResult.rows.map((row) => Number(row.faculty_user_id)));
    const missing = facultyResult.rows
      .filter((row) => !linked.has(Number(row.id)))
      .map((row) => row.full_name);
    return {
      ok: false,
      message: `Selected faculty must be assigned to the selected department${missing.length ? `: ${missing.join(", ")}` : ""}`,
    };
  }

  return { ok: true, ids: normalizedIds };
}

async function syncSubjectFacultyMappings(client, subjectId, facultyUserIds) {
  const normalizedIds = [...new Set(facultyUserIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (!normalizedIds.length) {
    return;
  }

  await client.query(
    `DELETE FROM faculty_subjects
     WHERE subject_id = $1
       AND faculty_user_id IS NOT NULL
       AND NOT (faculty_user_id = ANY($2::int[]))`,
    [subjectId, normalizedIds]
  );

  try {
    await client.query(
      `INSERT INTO faculty_subjects (faculty_user_id, subject_id)
       SELECT UNNEST($1::int[]), $2
       ON CONFLICT (faculty_user_id, subject_id) WHERE faculty_user_id IS NOT NULL DO NOTHING`,
      [normalizedIds, subjectId]
    );
  } catch (err) {
    // Fallback for older schemas that do not yet have the expected unique index.
    if (err.code !== "42P10") {
      throw err;
    }

    await client.query(
      `INSERT INTO faculty_subjects (faculty_user_id, subject_id)
       SELECT src.faculty_user_id, $2
       FROM UNNEST($1::int[]) AS src(faculty_user_id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM faculty_subjects fs
         WHERE fs.faculty_user_id = src.faculty_user_id
           AND fs.subject_id = $2
       )`,
      [normalizedIds, subjectId]
    );
  }
}

function normalizeProgramType(value) {
  return String(value || "UG").trim().toUpperCase() === "PG" ? "PG" : "UG";
}

function normalizeSubjectType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "theory") return "Theory";
  if (normalized === "practical") return "Practical";
  if (normalized === "both" || normalized === "theory + practical" || normalized === "theory+practical") {
    return "Theory + Practical";
  }
  return "";
}

function isValidSubjectType(value) {
  return Boolean(normalizeSubjectType(value));
}

function normalizeWorkingDays(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase();

  if (normalized === "MON_FRI" || normalized === "MON-FRI" || normalized === "5") {
    return "MON_FRI";
  }
  if (normalized === "MON_SAT" || normalized === "MON-SAT" || normalized === "6") {
    return "MON_SAT";
  }
  if (normalized === "MON_SUN" || normalized === "MON-SUN" || normalized === "7") {
    return "MON_SUN";
  }
  if (normalized === "TUE_SAT") {
    return "TUE_SAT";
  }
  if (normalized === "CUSTOM" || raw.startsWith("[")) {
    return raw.startsWith("[") ? raw : "CUSTOM";
  }

  return "";
}

function normalizeTimeValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(text);
  if (!match) return "";
  const seconds = match[3] || "00";
  return `${match[1]}:${match[2]}:${seconds}`;
}

function toTimeMinutes(value) {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function validateDepartmentScheduleWindow({
  startTime,
  endTime,
  breakDurationMinutes,
  slotDurationMinutes,
  breakAfterSlotNumber,
}) {
  const startMinutes = toTimeMinutes(startTime);
  const endMinutes = toTimeMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return "Start time and end time must be valid";
  }

  if (endMinutes <= startMinutes) {
    return "End time must be greater than start time";
  }

  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
    return "Slot duration must be a positive integer";
  }

  if (slotDurationMinutes > endMinutes - startMinutes) {
    return "Slot duration is larger than the configured working window";
  }

  if (!Number.isInteger(breakDurationMinutes) || breakDurationMinutes < 0) {
    return "Break duration must be a non-negative integer";
  }

  const totalWindowMinutes = endMinutes - startMinutes;
  if (breakDurationMinutes > totalWindowMinutes) {
    return "Break duration must be within configured working hours";
  }

  if (breakDurationMinutes === 0) {
    if (breakAfterSlotNumber !== null && breakAfterSlotNumber !== undefined) {
      return "Break after slot number should be empty when break duration is 0";
    }
    return "";
  }

  if (!Number.isInteger(breakAfterSlotNumber) || breakAfterSlotNumber <= 0) {
    return "Break after slot number is required when break duration is greater than zero";
  }

  let cursor = startMinutes;
  let slotsCreated = 0;
  let breakApplied = false;

  while (cursor < endMinutes) {
    if (!breakApplied && slotsCreated === breakAfterSlotNumber) {
      if (cursor + breakDurationMinutes > endMinutes) {
        return "Break does not fit inside configured working hours";
      }
      cursor += breakDurationMinutes;
      breakApplied = true;
      continue;
    }

    const remainingMinutes = endMinutes - cursor;
    if (remainingMinutes <= 0) {
      break;
    }

    cursor += Math.min(slotDurationMinutes, remainingMinutes);
    slotsCreated += 1;
  }

  if (slotsCreated === 0) {
    return "Configured timing does not produce any valid slot";
  }

  if (!breakApplied) {
    return "Break after slot number exceeds available slots in the schedule";
  }

  return "";
}

function isForeignKeyViolation(err) {
  return err?.code === "23503";
}

async function resolveDefaultSlotDurationMinutes() {
  try {
    const result = await pool.query(
      `SELECT class_duration_minutes
       FROM scheduling_parameters
       ORDER BY id DESC
       LIMIT 1`
    );
    const configured = asPositiveInt(result.rows[0]?.class_duration_minutes, 0);
    if (configured > 0) {
      return configured;
    }
  } catch (err) {
    // Fall back to static default when scheduling parameters table is unavailable.
  }
  return DEFAULT_SLOT_DURATION_MINUTES;
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
    const refreshToken = authService.readRefreshTokenFromRequest(req);
    const response = await authService.logout({
      refresh_token: refreshToken,
      userId: req.user?.userId,
    });
    const { cookieName, cookieOptions } = authService.getRefreshCookieConfig();
    res.clearCookie(cookieName, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
    });

    if (req.session && typeof req.session.destroy === "function") {
      await new Promise((resolve, reject) =>
        req.session.destroy((err) => (err ? reject(err) : resolve()))
      );
    }
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

// All remaining dashboard data endpoints are admin-only.
router.use(dashboardAdminRequired);

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

router.put("/departments/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const departmentId = asPositiveInt(req.params.id, 0);
    const departmentName = String(req.body.department_name || "").trim();
    const departmentCode = String(req.body.department_code || "").trim();
    const hodName = String(req.body.hod_name || "").trim() || null;

    if (!departmentId) {
      return res.status(400).json({ message: "Invalid department id" });
    }

    if (!departmentName || !departmentCode) {
      return res.status(400).json({ message: "Department name and code are required" });
    }

    const existing = await pool.query(`SELECT id FROM departments WHERE id = $1`, [departmentId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const duplicateName = await pool.query(
      `SELECT id
       FROM departments
       WHERE id <> $1
         AND LOWER(department_name) = LOWER($2)
       LIMIT 1`,
      [departmentId, departmentName]
    );
    if (duplicateName.rowCount > 0) {
      return res.status(409).json({ message: "Department already exists" });
    }

    const duplicateCode = await pool.query(
      `SELECT id
       FROM departments
       WHERE id <> $1
         AND LOWER(department_code) = LOWER($2)
       LIMIT 1`,
      [departmentId, departmentCode]
    );
    if (duplicateCode.rowCount > 0) {
      return res.status(409).json({ message: "Department code already exists" });
    }

    const updated = await pool.query(
      `UPDATE departments
       SET department_name = $1,
           department_code = $2,
           hod_name = $3
       WHERE id = $4
       RETURNING *`,
      [departmentName, departmentCode, hodName, departmentId]
    );

    await logActivity(req.user.userId, "Department Updated", `department=${departmentName}, id=${departmentId}`);
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Department already exists" });
    }
    return next(err);
  }
});

router.delete("/departments/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const departmentId = asPositiveInt(req.params.id, 0);
    if (!departmentId) {
      return res.status(400).json({ message: "Invalid department id" });
    }

    const existing = await pool.query(
      `SELECT id, department_name
       FROM departments
       WHERE id = $1`,
      [departmentId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const dependencyResult = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM branches WHERE department_id = $1) AS has_branches,
         EXISTS(SELECT 1 FROM subjects WHERE department_id = $1) AS has_subjects,
         EXISTS(SELECT 1 FROM laboratories WHERE department_id = $1) AS has_laboratories,
         EXISTS(SELECT 1 FROM faculty WHERE department_id = $1) AS has_faculty`,
      [departmentId]
    );

    const dependency = dependencyResult.rows[0] || {};
    if (dependency.has_branches || dependency.has_subjects || dependency.has_laboratories || dependency.has_faculty) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(`DELETE FROM departments WHERE id = $1`, [departmentId]);
    await logActivity(
      req.user.userId,
      "Department Deleted",
      `department=${existing.rows[0].department_name}, id=${departmentId}`
    );
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }
    return next(err);
  }
});

router.get("/department-schedule-config", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT dsc.id, dsc.department_id, dsc.start_time, dsc.end_time, dsc.slot_duration_minutes,
               dsc.break_duration_minutes, dsc.break_after_slot_number, dsc.working_days, dsc.created_at,
               d.department_name, d.department_code
        FROM department_schedule_config dsc
        JOIN departments d ON d.id = dsc.department_id
        WHERE ($1 = '' OR d.department_name ILIKE $1 OR d.department_code ILIKE $1 OR dsc.working_days ILIKE $1
               OR CAST(dsc.break_after_slot_number AS TEXT) ILIKE $1)
        ORDER BY dsc.id DESC
        LIMIT $2 OFFSET $3
      `,
      queryValues: [q, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM department_schedule_config dsc
        JOIN departments d ON d.id = dsc.department_id
        WHERE ($1 = '' OR d.department_name ILIKE $1 OR d.department_code ILIKE $1 OR dsc.working_days ILIKE $1
               OR CAST(dsc.break_after_slot_number AS TEXT) ILIKE $1)
      `,
      countValues: [q],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.post("/department-schedule-config", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const departmentId = asPositiveInt(req.body.department_id, 0);
    const startTime = normalizeTimeValue(req.body.start_time);
    const endTime = normalizeTimeValue(req.body.end_time);
    let slotDurationMinutes = asPositiveInt(req.body.slot_duration_minutes, 0);
    const rawBreakDuration =
      req.body.break_duration_minutes === undefined || req.body.break_duration_minutes === null
        ? 0
        : asNonNegativeInt(req.body.break_duration_minutes, -1);
    const breakDurationMinutes = rawBreakDuration < 0 ? -1 : rawBreakDuration;
    const breakAfterSlotNumberRaw = req.body.break_after_slot_number;
    const breakAfterSlotNumber =
      breakAfterSlotNumberRaw === undefined || breakAfterSlotNumberRaw === null || breakAfterSlotNumberRaw === ""
        ? null
        : asPositiveInt(breakAfterSlotNumberRaw, 0);
    const workingDays = normalizeWorkingDays(req.body.working_days) || DEFAULT_WORKING_DAYS;

    if (!slotDurationMinutes) {
      slotDurationMinutes = await resolveDefaultSlotDurationMinutes();
    }

    if (
      !departmentId ||
      !startTime ||
      !endTime ||
      !slotDurationMinutes ||
      breakDurationMinutes < 0 ||
      (!workingDays)
    ) {
      return res.status(400).json({
        message: "Department, start time and end time are required",
      });
    }

    const scheduleValidationMessage = validateDepartmentScheduleWindow({
      startTime,
      endTime,
      breakDurationMinutes,
      slotDurationMinutes,
      breakAfterSlotNumber,
    });
    if (scheduleValidationMessage) {
      return res.status(400).json({ message: scheduleValidationMessage });
    }

    const department = await pool.query(`SELECT id FROM departments WHERE id = $1`, [departmentId]);
    if (department.rowCount === 0) {
      return res.status(400).json({ message: "Invalid department selected" });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM department_schedule_config
       WHERE department_id = $1
       LIMIT 1`,
      [departmentId]
    );
    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "Working hours already configured for this department" });
    }

    const inserted = await pool.query(
      `INSERT INTO department_schedule_config
      (department_id, start_time, end_time, slot_duration_minutes, break_duration_minutes, break_after_slot_number, working_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        departmentId,
        startTime,
        endTime,
        slotDurationMinutes,
        breakDurationMinutes,
        breakDurationMinutes > 0 ? breakAfterSlotNumber : null,
        workingDays,
      ]
    );

    await logActivity(
      req.user.userId,
      "Department Schedule Added",
      `department_id=${departmentId}, working_days=${workingDays}`
    );
    return res.status(201).json({ message: "Department schedule saved successfully", data: inserted.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Working hours already configured for this department" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid department selected" });
    }
    return next(err);
  }
});

router.put("/department-schedule-config/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const configId = asPositiveInt(req.params.id, 0);
    if (!configId) {
      return res.status(400).json({ message: "Invalid department schedule id" });
    }

    const existingResult = await pool.query(
      `SELECT id, department_id, start_time, end_time, slot_duration_minutes, break_duration_minutes,
              break_after_slot_number, working_days
       FROM department_schedule_config
       WHERE id = $1`,
      [configId]
    );
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Department schedule not found" });
    }
    const current = existingResult.rows[0];

    const departmentId =
      req.body.department_id === undefined ? Number(current.department_id) : asPositiveInt(req.body.department_id, 0);
    const startTime =
      req.body.start_time === undefined ? normalizeTimeValue(current.start_time) : normalizeTimeValue(req.body.start_time);
    const endTime =
      req.body.end_time === undefined ? normalizeTimeValue(current.end_time) : normalizeTimeValue(req.body.end_time);
    const slotDurationMinutes =
      req.body.slot_duration_minutes === undefined
        ? asPositiveInt(current.slot_duration_minutes, 0)
        : asPositiveInt(req.body.slot_duration_minutes, 0);
    const breakDurationMinutes =
      req.body.break_duration_minutes === undefined
        ? asNonNegativeInt(current.break_duration_minutes, 0)
        : asNonNegativeInt(req.body.break_duration_minutes, -1);
    const breakAfterSlotNumber =
      req.body.break_after_slot_number === undefined
        ? current.break_after_slot_number === null
          ? null
          : asPositiveInt(current.break_after_slot_number, 0)
        : req.body.break_after_slot_number === null || req.body.break_after_slot_number === ""
          ? null
          : asPositiveInt(req.body.break_after_slot_number, 0);
    const workingDays =
      req.body.working_days === undefined
        ? normalizeWorkingDays(current.working_days) || DEFAULT_WORKING_DAYS
        : normalizeWorkingDays(req.body.working_days) || DEFAULT_WORKING_DAYS;

    if (!departmentId || !startTime || !endTime || !slotDurationMinutes || breakDurationMinutes < 0 || !workingDays) {
      return res.status(400).json({
        message: "Department, start time and end time are required",
      });
    }

    const scheduleValidationMessage = validateDepartmentScheduleWindow({
      startTime,
      endTime,
      breakDurationMinutes,
      slotDurationMinutes,
      breakAfterSlotNumber,
    });
    if (scheduleValidationMessage) {
      return res.status(400).json({ message: scheduleValidationMessage });
    }

    const department = await pool.query(`SELECT id FROM departments WHERE id = $1`, [departmentId]);
    if (department.rowCount === 0) {
      return res.status(400).json({ message: "Invalid department selected" });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM department_schedule_config
       WHERE id <> $1
         AND department_id = $2
       LIMIT 1`,
      [configId, departmentId]
    );
    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "Working hours already configured for this department" });
    }

    const updated = await pool.query(
      `UPDATE department_schedule_config
       SET department_id = $1,
           start_time = $2,
           end_time = $3,
           slot_duration_minutes = $4,
           break_duration_minutes = $5,
           break_after_slot_number = $6,
           working_days = $7
       WHERE id = $8
       RETURNING *`,
      [
        departmentId,
        startTime,
        endTime,
        slotDurationMinutes,
        breakDurationMinutes,
        breakDurationMinutes > 0 ? breakAfterSlotNumber : null,
        workingDays,
        configId,
      ]
    );

    await logActivity(
      req.user.userId,
      "Department Schedule Updated",
      `department_id=${departmentId}, id=${configId}`
    );
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Working hours already configured for this department" });
    }
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ message: "Invalid department selected" });
    }
    return next(err);
  }
});

router.delete("/department-schedule-config/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const configId = asPositiveInt(req.params.id, 0);
    if (!configId) {
      return res.status(400).json({ message: "Invalid department schedule id" });
    }

    const existing = await pool.query(
      `SELECT id, department_id
       FROM department_schedule_config
       WHERE id = $1`,
      [configId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Department schedule not found" });
    }

    await pool.query(`DELETE FROM department_schedule_config WHERE id = $1`, [configId]);
    await logActivity(
      req.user.userId,
      "Department Schedule Deleted",
      `department_id=${existing.rows[0].department_id}, id=${configId}`
    );
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    return next(err);
  }
});

router.get("/branches", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const departmentId = asPositiveInt(req.query.department_id, 0);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT b.id, b.branch_name, b.branch_code, b.department_id, b.program_type, b.created_at,
               d.department_name
        FROM branches b
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR b.branch_name ILIKE $1 OR b.branch_code ILIKE $1 OR d.department_name ILIKE $1)
          AND ($2 = 0 OR b.department_id = $2)
        ORDER BY b.id DESC
        LIMIT $3 OFFSET $4
      `,
      queryValues: [q, departmentId, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM branches b
        JOIN departments d ON d.id = b.department_id
        WHERE ($1 = '' OR b.branch_name ILIKE $1 OR b.branch_code ILIKE $1 OR d.department_name ILIKE $1)
          AND ($2 = 0 OR b.department_id = $2)
      `,
      countValues: [q, departmentId],
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

router.put("/branches/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const branchId = asPositiveInt(req.params.id, 0);
    const branchName = String(req.body.branch_name || "").trim();
    const branchCode = String(req.body.branch_code || "").trim();
    const departmentId = asPositiveInt(req.body.department_id, 0);
    const requestedProgramType = String(req.body.program_type || "").trim();

    if (!branchId) {
      return res.status(400).json({ message: "Invalid branch id" });
    }

    if (!branchName || !branchCode || !departmentId) {
      return res.status(400).json({ message: "Branch name, code and department are required" });
    }

    const existing = await pool.query(
      `SELECT id, program_type
       FROM branches
       WHERE id = $1`,
      [branchId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const programType = requestedProgramType
      ? normalizeProgramType(requestedProgramType)
      : String(existing.rows[0].program_type || "UG");

    const department = await pool.query(`SELECT id FROM departments WHERE id = $1`, [departmentId]);
    if (department.rowCount === 0) {
      return res.status(400).json({ message: "Invalid department selected" });
    }

    const duplicateName = await pool.query(
      `SELECT id
       FROM branches
       WHERE id <> $1
         AND department_id = $2
         AND LOWER(branch_name) = LOWER($3)
       LIMIT 1`,
      [branchId, departmentId, branchName]
    );
    if (duplicateName.rowCount > 0) {
      return res.status(409).json({ message: "Branch already exists in this department" });
    }

    const duplicateCode = await pool.query(
      `SELECT id
       FROM branches
       WHERE id <> $1
         AND department_id = $2
         AND LOWER(branch_code) = LOWER($3)
       LIMIT 1`,
      [branchId, departmentId, branchCode]
    );
    if (duplicateCode.rowCount > 0) {
      return res.status(409).json({ message: "Branch code already exists in this department" });
    }

    const updated = await pool.query(
      `UPDATE branches
       SET branch_name = $1,
           branch_code = $2,
           department_id = $3,
           program_type = $4
       WHERE id = $5
       RETURNING *`,
      [branchName, branchCode, departmentId, programType, branchId]
    );

    await logActivity(req.user.userId, "Branch Updated", `branch=${branchName}, id=${branchId}`);
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Branch already exists in this department" });
    }
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ message: "Invalid department selected" });
    }
    return next(err);
  }
});

router.delete("/branches/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const branchId = asPositiveInt(req.params.id, 0);
    if (!branchId) {
      return res.status(400).json({ message: "Invalid branch id" });
    }

    const existing = await pool.query(
      `SELECT id, branch_name
       FROM branches
       WHERE id = $1`,
      [branchId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const dependencyResult = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM semesters WHERE branch_id = $1) AS has_semesters,
         EXISTS(SELECT 1 FROM sections WHERE branch_id = $1) AS has_sections,
         EXISTS(SELECT 1 FROM subjects WHERE branch_id = $1) AS has_subjects`,
      [branchId]
    );
    const dependency = dependencyResult.rows[0] || {};

    if (dependency.has_semesters || dependency.has_sections || dependency.has_subjects) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(`DELETE FROM branches WHERE id = $1`, [branchId]);
    await logActivity(req.user.userId, "Branch Deleted", `branch=${existing.rows[0].branch_name}, id=${branchId}`);
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }
    return next(err);
  }
});

router.get("/sections", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const branchId = asPositiveInt(req.query.branch_id, 0);
    const semesterId = asPositiveInt(req.query.semester_id, 0);

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
          AND ($2 = 0 OR s.branch_id = $2)
          AND ($3 = 0 OR s.semester_id = $3)
        ORDER BY s.id DESC
        LIMIT $4 OFFSET $5
      `,
      queryValues: [q, branchId, semesterId, limit, offset],
      countSql: `
        SELECT COUNT(*)::int AS total
        FROM sections s
        LEFT JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        WHERE ($1 = '' OR s.section_name ILIKE $1 OR COALESCE(b.branch_name, '') ILIKE $1 OR sem.academic_year ILIKE $1)
          AND ($2 = 0 OR s.branch_id = $2)
          AND ($3 = 0 OR s.semester_id = $3)
      `,
      countValues: [q, branchId, semesterId],
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

router.put("/sections/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const sectionId = asPositiveInt(req.params.id, 0);
    const sectionName = String(req.body.section_name || "").trim();
    const branchId = asPositiveInt(req.body.branch_id, 0);
    const semesterId = asPositiveInt(req.body.semester_id, 0);
    const hasStudentStrength = req.body.student_strength !== undefined && req.body.student_strength !== null;

    if (!sectionId) {
      return res.status(400).json({ message: "Invalid section id" });
    }

    if (!sectionName || !branchId || !semesterId) {
      return res.status(400).json({ message: "Section name, branch and semester are required" });
    }

    const existing = await pool.query(
      `SELECT id, student_strength
       FROM sections
       WHERE id = $1`,
      [sectionId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Section not found" });
    }

    const studentStrength = hasStudentStrength
      ? asPositiveInt(req.body.student_strength, 0)
      : asPositiveInt(existing.rows[0].student_strength, 60);
    if (!studentStrength) {
      return res.status(400).json({ message: "Student strength must be a positive number" });
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
       WHERE id <> $1
         AND branch_id = $2
         AND LOWER(section_name) = LOWER($3)
       LIMIT 1`,
      [sectionId, branchId, sectionName]
    );
    if (duplicateSection.rowCount > 0) {
      return res.status(409).json({ message: "Section already exists in this branch" });
    }

    const updated = await pool.query(
      `UPDATE sections
       SET section_name = $1,
           branch_id = $2,
           semester_id = $3,
           student_strength = $4
       WHERE id = $5
       RETURNING *`,
      [sectionName, branchId, semesterId, studentStrength, sectionId]
    );

    await logActivity(req.user.userId, "Section Updated", `section=${sectionName}, id=${sectionId}`);
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Section already exists in this branch" });
    }
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ message: "Invalid branch or semester selected" });
    }
    return next(err);
  }
});

router.delete("/sections/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const sectionId = asPositiveInt(req.params.id, 0);
    if (!sectionId) {
      return res.status(400).json({ message: "Invalid section id" });
    }

    const existing = await pool.query(
      `SELECT id, section_name
       FROM sections
       WHERE id = $1`,
      [sectionId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Section not found" });
    }

    const dependency = await pool.query(
      `SELECT 1
       FROM timetable_entries
       WHERE section_id = $1
       LIMIT 1`,
      [sectionId]
    );
    if (dependency.rowCount > 0) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(`DELETE FROM sections WHERE id = $1`, [sectionId]);
    await logActivity(req.user.userId, "Section Deleted", `section=${existing.rows[0].section_name}, id=${sectionId}`);
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }
    return next(err);
  }
});

router.get("/faculty", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const departmentId = asPositiveInt(req.query.department_id, 0);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        WITH faculty_view AS (
          SELECT fu.id, fu.faculty_id, fu.full_name, fu.email, fu.mobile_number, fu.created_at,
                 COALESCE(STRING_AGG(DISTINCT d.department_name, ', '), '-') AS departments,
                 COALESCE(STRING_AGG(DISTINCT d.id::text, ','), '') AS department_ids,
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
          AND ($2 = 0 OR department_ids LIKE '%' || $2 || '%')
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      queryValues: [q, departmentId, limit, offset],
      countSql: `
        WITH faculty_view AS (
          SELECT fu.id, fu.faculty_id, fu.full_name, fu.email, fu.mobile_number, fu.created_at,
                 COALESCE(STRING_AGG(DISTINCT d.id::text, ','), '') AS department_ids
          FROM faculty_users fu
          LEFT JOIN faculty_departments fd ON fd.faculty_user_id = fu.id
          WHERE LOWER(fu.role) = 'faculty'
          GROUP BY fu.id
        )
        SELECT COUNT(*)::int AS total
        FROM faculty_view
        WHERE ($2 = 0 OR department_ids LIKE '%' || $2 || '%')
      `,
      countValues: [q, departmentId],
    });

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

router.put("/faculty/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const facultyUserId = asPositiveInt(req.params.id, 0);
    const facultyId = String(req.body.faculty_id || "").trim();
    const fullName = String(req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const mobileNumber = String(req.body.mobile_number || "").trim();

    if (!facultyUserId) {
      return res.status(400).json({ message: "Invalid faculty id" });
    }

    if (!facultyId || !fullName || !email || !mobileNumber) {
      return res.status(400).json({ message: "Faculty ID, name, email and mobile number are required" });
    }

    const existing = await pool.query(
      `SELECT id
       FROM faculty_users
       WHERE id = $1
         AND LOWER(role) = 'faculty'`,
      [facultyUserId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Faculty record not found" });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM faculty_users
       WHERE id <> $1
         AND (
           LOWER(faculty_id) = LOWER($2)
           OR LOWER(email) = LOWER($3)
           OR mobile_number = $4
         )
       LIMIT 1`,
      [facultyUserId, facultyId, email, mobileNumber]
    );
    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "Faculty ID, email or mobile number already exists" });
    }

    const updated = await pool.query(
      `UPDATE faculty_users
       SET faculty_id = $1,
           full_name = $2,
           email = $3,
           mobile_number = $4
       WHERE id = $5
         AND LOWER(role) = 'faculty'
       RETURNING id, faculty_id, full_name, email, mobile_number, role, created_at`,
      [facultyId, fullName, email, mobileNumber, facultyUserId]
    );

    await logActivity(req.user.userId, "Faculty Updated", `faculty_id=${facultyId}, id=${facultyUserId}`);
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Faculty ID, email or mobile number already exists" });
    }
    return next(err);
  }
});

router.delete("/faculty/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const facultyUserId = asPositiveInt(req.params.id, 0);
    if (!facultyUserId) {
      return res.status(400).json({ message: "Invalid faculty id" });
    }

    const existing = await pool.query(
      `SELECT id, faculty_id, full_name
       FROM faculty_users
       WHERE id = $1
         AND LOWER(role) = 'faculty'`,
      [facultyUserId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Faculty record not found" });
    }

    const dependency = await pool.query(
      `SELECT 1
       FROM faculty f
       JOIN timetable_entries te ON te.faculty_id = f.id
       WHERE LOWER(f.faculty_id) = LOWER($1)
       LIMIT 1`,
      [existing.rows[0].faculty_id]
    );
    if (dependency.rowCount > 0) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(
      `DELETE FROM faculty_users
       WHERE id = $1`,
      [facultyUserId]
    );

    await logActivity(
      req.user.userId,
      "Faculty Deleted",
      `faculty_id=${existing.rows[0].faculty_id}, id=${facultyUserId}`
    );
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }
    return next(err);
  }
});

function parseOptionalNonNegativeInt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return asNonNegativeInt(value, -1);
}

function buildSubjectHourConfig({ normalizedSubjectType, totalHours, rawTheoryHours, rawPracticalHours }) {
  if (!Number.isInteger(totalHours) || totalHours <= 0) {
    return { error: "Total semester hours must be a positive integer" };
  }

  if (normalizedSubjectType === "Theory") {
    return {
      theoryHours: totalHours,
      practicalHours: 0,
      totalHours,
      requiresLab: false,
    };
  }

  if (normalizedSubjectType === "Practical") {
    return {
      theoryHours: 0,
      practicalHours: totalHours,
      totalHours,
      requiresLab: true,
    };
  }

  if (rawTheoryHours === null || rawPracticalHours === null) {
    return { error: "Theory hours and practical hours are required for Theory + Practical subjects" };
  }

  if (rawTheoryHours < 0 || rawPracticalHours < 0) {
    return { error: "Theory and practical hours must be zero or positive integers" };
  }

  if (rawTheoryHours + rawPracticalHours !== totalHours) {
    return { error: "Total semester hours must equal theory hours + practical hours" };
  }

  return {
    theoryHours: rawTheoryHours,
    practicalHours: rawPracticalHours,
    totalHours,
    requiresLab: rawPracticalHours > 0,
  };
}

async function ensureLabAvailabilityForPractical(departmentId) {
  const labAvailability = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM classrooms WHERE room_type = 'Lab') AS has_lab_room,
       EXISTS(SELECT 1 FROM laboratories WHERE department_id = $1) AS has_department_lab`,
    [departmentId]
  );

  const availability = labAvailability.rows[0] || {};
  return Boolean(availability.has_lab_room || availability.has_department_lab);
}

router.get("/subjects", authRequired, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = buildSearchTerm(req.query.q);

    const response = await listWithPagination({
      page,
      limit,
      querySql: `
        SELECT s.id, s.subject_name, s.subject_code,
               CASE WHEN s.subject_type = 'Both' THEN 'Theory + Practical' ELSE s.subject_type END AS subject_type,
               s.department_id, s.branch_id, s.semester_id,
               COALESCE(NULLIF(s.total_hours, 0), s.total_hours_semester, 0) AS total_hours,
               COALESCE(NULLIF(s.theory_hours, 0), s.theory_hours_per_week, 0) AS theory_hours,
               COALESCE(NULLIF(s.practical_hours, 0), s.practical_hours_per_week, 0) AS practical_hours,
               ROUND(
                 (
                   COALESCE(NULLIF(s.total_hours, 0), s.total_hours_semester, 0)::numeric
                   / GREATEST(
                     1,
                     COALESCE(CEIL(((sd.end_date - sd.start_date + 1)::numeric) / 7.0), 16)
                   )
                 ),
                 2
               ) AS weekly_hours,
               CASE
                 WHEN s.requires_lab THEN TRUE
                 WHEN s.subject_type = 'Practical' THEN TRUE
                 WHEN (CASE WHEN s.subject_type = 'Both' THEN 'Theory + Practical' ELSE s.subject_type END) = 'Theory + Practical'
                      AND COALESCE(NULLIF(s.practical_hours, 0), s.practical_hours_per_week, 0) > 0 THEN TRUE
                 ELSE FALSE
               END AS requires_lab,
               s.created_at,
               d.department_name,
               b.branch_name,
               sem.semester_number, sem.academic_year,
               COALESCE(subject_faculty.faculty_user_ids, ARRAY[]::INTEGER[]) AS faculty_user_ids,
               COALESCE(subject_faculty.faculty_names, '-') AS faculty_names
        FROM subjects s
        JOIN departments d ON d.id = s.department_id
        JOIN branches b ON b.id = s.branch_id
        JOIN semesters sem ON sem.id = s.semester_id
        LEFT JOIN semester_durations sd ON sd.semester_id = s.semester_id
        LEFT JOIN LATERAL (
          SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT fs.faculty_user_id), NULL) AS faculty_user_ids,
                 STRING_AGG(DISTINCT COALESCE(fu.full_name, f.full_name), ', ') AS faculty_names
          FROM faculty_subjects fs
          LEFT JOIN faculty_users fu ON fu.id = fs.faculty_user_id
          LEFT JOIN faculty f ON f.id = fs.faculty_id
          WHERE fs.subject_id = s.id
        ) subject_faculty ON TRUE
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
  const client = await pool.connect();

  try {
    if (!ensureAdmin(req, res)) return;

    const subjectName = String(req.body.subject_name || "").trim();
    const subjectCode = String(req.body.subject_code || "").trim();
    const departmentId = asPositiveInt(req.body.department_id, 0);
    const branchId = asPositiveInt(req.body.branch_id, 0);
    const semesterId = asPositiveInt(req.body.semester_id, 0);
    const normalizedSubjectType = normalizeSubjectType(req.body.subject_type);
    const totalHours = asNonNegativeInt(req.body.total_hours ?? req.body.total_hours_semester, -1);
    const rawTheoryHours = parseOptionalNonNegativeInt(req.body.theory_hours ?? req.body.theory_hours_per_week);
    const rawPracticalHours = parseOptionalNonNegativeInt(req.body.practical_hours ?? req.body.practical_hours_per_week);
    const facultyUserIds = parseIdArray(req.body.faculty_user_ids ?? req.body.faculty_ids ?? req.body.faculty_user_id);

    if (!subjectName || !subjectCode || !departmentId || !branchId || !semesterId || !normalizedSubjectType) {
      return res.status(400).json({
        message: "Subject name, code, department, branch, semester and type are required",
      });
    }

    if (!facultyUserIds.length) {
      return res.status(400).json({ message: "Assign at least one faculty before saving subject" });
    }

    await client.query("BEGIN");

    const hourConfig = buildSubjectHourConfig({
      normalizedSubjectType,
      totalHours,
      rawTheoryHours,
      rawPracticalHours,
    });
    if (hourConfig.error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: hourConfig.error });
    }

    const branch = await client.query(
      `SELECT id, department_id
       FROM branches
       WHERE id = $1`,
      [branchId]
    );
    if (branch.rowCount === 0 || Number(branch.rows[0].department_id) !== departmentId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected branch does not belong to selected department" });
    }

    const semester = await client.query(
      `SELECT id, branch_id
       FROM semesters
       WHERE id = $1`,
      [semesterId]
    );
    if (semester.rowCount === 0 || Number(semester.rows[0].branch_id) !== branchId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected semester does not belong to selected branch" });
    }

    if (hourConfig.requiresLab) {
      const hasLabCapacity = await ensureLabAvailabilityForPractical(departmentId);
      if (!hasLabCapacity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Practical subjects require at least one configured lab room or laboratory",
        });
      }
    }

    const duplicateCode = await client.query(
      `SELECT id
       FROM subjects
       WHERE branch_id = $1
         AND LOWER(subject_code) = LOWER($2)
       LIMIT 1`,
      [branchId, subjectCode]
    );
    if (duplicateCode.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }

    const facultyValidation = await validateFacultyUsersForSubject(client, facultyUserIds, departmentId);
    if (!facultyValidation.ok) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: facultyValidation.message });
    }

    const inserted = await client.query(
      `INSERT INTO subjects
      (subject_name, subject_code, department_id, branch_id, semester_id, subject_type,
       total_hours, theory_hours, practical_hours, requires_lab,
       theory_hours_per_week, practical_hours_per_week, total_hours_semester)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        subjectName,
        subjectCode,
        departmentId,
        branchId,
        semesterId,
        normalizedSubjectType,
        hourConfig.totalHours,
        hourConfig.theoryHours,
        hourConfig.practicalHours,
        hourConfig.requiresLab,
        hourConfig.theoryHours,
        hourConfig.practicalHours,
        hourConfig.totalHours,
      ]
    );

    await syncSubjectFacultyMappings(client, inserted.rows[0].id, facultyValidation.ids);
    await client.query("COMMIT");

    await logActivity(req.user.userId, "Subject Added", `subject=${subjectName}`);
    return res.status(201).json({
      message: "Subject added successfully",
      data: {
        ...inserted.rows[0],
        faculty_user_ids: facultyValidation.ids,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      // ignore rollback errors
    }
    if (err.code === "23505") {
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid department, branch or semester selected" });
    }
    return next(err);
  } finally {
    client.release();
  }
});

router.put("/subjects/:id", authRequired, async (req, res, next) => {
  const client = await pool.connect();

  try {
    if (!ensureAdmin(req, res)) return;

    const subjectId = asPositiveInt(req.params.id, 0);
    const subjectName = String(req.body.subject_name || "").trim();
    const subjectCode = String(req.body.subject_code || "").trim();
    const departmentId = asPositiveInt(req.body.department_id, 0);
    const branchId = asPositiveInt(req.body.branch_id, 0);
    const semesterId = asPositiveInt(req.body.semester_id, 0);
    const normalizedSubjectType = normalizeSubjectType(req.body.subject_type);
    const totalHours = asNonNegativeInt(req.body.total_hours ?? req.body.total_hours_semester, -1);
    const rawTheoryHours = parseOptionalNonNegativeInt(req.body.theory_hours ?? req.body.theory_hours_per_week);
    const rawPracticalHours = parseOptionalNonNegativeInt(req.body.practical_hours ?? req.body.practical_hours_per_week);
    const hasFacultyMappingField =
      Object.prototype.hasOwnProperty.call(req.body, "faculty_user_ids") ||
      Object.prototype.hasOwnProperty.call(req.body, "faculty_ids") ||
      Object.prototype.hasOwnProperty.call(req.body, "faculty_user_id");
    const facultyUserIds = parseIdArray(req.body.faculty_user_ids ?? req.body.faculty_ids ?? req.body.faculty_user_id);

    if (!subjectId) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    if (!subjectName || !subjectCode || !departmentId || !branchId || !semesterId || !normalizedSubjectType) {
      return res.status(400).json({
        message: "Subject name, code, department, branch, semester and type are required",
      });
    }

    if (hasFacultyMappingField && !facultyUserIds.length) {
      return res.status(400).json({ message: "Assign at least one faculty before saving subject" });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id
       FROM subjects
       WHERE id = $1`,
      [subjectId]
    );
    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Subject not found" });
    }

    const hourConfig = buildSubjectHourConfig({
      normalizedSubjectType,
      totalHours,
      rawTheoryHours,
      rawPracticalHours,
    });
    if (hourConfig.error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: hourConfig.error });
    }

    const branch = await client.query(
      `SELECT id, department_id
       FROM branches
       WHERE id = $1`,
      [branchId]
    );
    if (branch.rowCount === 0 || Number(branch.rows[0].department_id) !== departmentId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected branch does not belong to selected department" });
    }

    const semester = await client.query(
      `SELECT id, branch_id
       FROM semesters
       WHERE id = $1`,
      [semesterId]
    );
    if (semester.rowCount === 0 || Number(semester.rows[0].branch_id) !== branchId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected semester does not belong to selected branch" });
    }

    if (hourConfig.requiresLab) {
      const hasLabCapacity = await ensureLabAvailabilityForPractical(departmentId);
      if (!hasLabCapacity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Practical subjects require at least one configured lab room or laboratory",
        });
      }
    }

    const duplicateCode = await client.query(
      `SELECT id
       FROM subjects
       WHERE id <> $1
         AND branch_id = $2
         AND LOWER(subject_code) = LOWER($3)
       LIMIT 1`,
      [subjectId, branchId, subjectCode]
    );
    if (duplicateCode.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }

    let validatedFacultyUserIds = null;
    if (hasFacultyMappingField) {
      const validation = await validateFacultyUsersForSubject(client, facultyUserIds, departmentId);
      if (!validation.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: validation.message });
      }
      validatedFacultyUserIds = validation.ids;
    }

    const updated = await client.query(
      `UPDATE subjects
       SET subject_name = $1,
           subject_code = $2,
           department_id = $3,
           branch_id = $4,
           semester_id = $5,
           subject_type = $6,
           total_hours = $7,
           theory_hours = $8,
           practical_hours = $9,
           requires_lab = $10,
           theory_hours_per_week = $11,
           practical_hours_per_week = $12,
           total_hours_semester = $13
       WHERE id = $14
       RETURNING *`,
      [
        subjectName,
        subjectCode,
        departmentId,
        branchId,
        semesterId,
        normalizedSubjectType,
        hourConfig.totalHours,
        hourConfig.theoryHours,
        hourConfig.practicalHours,
        hourConfig.requiresLab,
        hourConfig.theoryHours,
        hourConfig.practicalHours,
        hourConfig.totalHours,
        subjectId,
      ]
    );

    if (validatedFacultyUserIds) {
      await syncSubjectFacultyMappings(client, subjectId, validatedFacultyUserIds);
    }

    const mappingCountResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM faculty_subjects
       WHERE subject_id = $1`,
      [subjectId]
    );
    if (Number(mappingCountResult.rows[0]?.total || 0) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Assign at least one faculty before saving subject" });
    }

    await client.query("COMMIT");

    await logActivity(req.user.userId, "Subject Updated", `subject=${subjectName}, id=${subjectId}`);
    return res.json({
      message: "Updated successfully",
      data: {
        ...updated.rows[0],
        ...(validatedFacultyUserIds ? { faculty_user_ids: validatedFacultyUserIds } : {}),
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      // ignore rollback errors
    }
    if (err.code === "23505") {
      return res.status(409).json({ message: "Subject code already exists in this branch" });
    }
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ message: "Invalid department, branch or semester selected" });
    }
    return next(err);
  } finally {
    client.release();
  }
});

router.delete("/subjects/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const subjectId = asPositiveInt(req.params.id, 0);
    if (!subjectId) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    const existing = await pool.query(
      `SELECT id, subject_name
       FROM subjects
       WHERE id = $1`,
      [subjectId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const dependency = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM timetable_entries WHERE subject_id = $1) AS has_timetable_entries,
         EXISTS(SELECT 1 FROM faculty_subjects WHERE subject_id = $1) AS has_faculty_mapping`,
      [subjectId]
    );
    const inUse = dependency.rows[0] || {};
    if (inUse.has_timetable_entries || inUse.has_faculty_mapping) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    await logActivity(req.user.userId, "Subject Deleted", `subject=${existing.rows[0].subject_name}, id=${subjectId}`);
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
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

router.put("/semesters/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const semesterId = asPositiveInt(req.params.id, 0);
    const semesterNumber = asPositiveInt(req.body.semester_number, 0);
    const academicYear = String(req.body.academic_year || "").trim();
    const branchId = asPositiveInt(req.body.branch_id, 0);

    if (!semesterId) {
      return res.status(400).json({ message: "Invalid semester id" });
    }

    if (!semesterNumber || !academicYear || !branchId) {
      return res.status(400).json({ message: "Semester number, academic year and branch are required" });
    }

    const existing = await pool.query(`SELECT id FROM semesters WHERE id = $1`, [semesterId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Semester not found" });
    }

    const branch = await pool.query(`SELECT id FROM branches WHERE id = $1`, [branchId]);
    if (branch.rowCount === 0) {
      return res.status(400).json({ message: "Invalid branch selected" });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM semesters
       WHERE id <> $1
         AND branch_id = $2
         AND semester_number = $3
         AND academic_year = $4
       LIMIT 1`,
      [semesterId, branchId, semesterNumber, academicYear]
    );
    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: "Semester already exists for this branch and academic year" });
    }

    const updated = await pool.query(
      `UPDATE semesters
       SET semester_number = $1,
           academic_year = $2,
           branch_id = $3
       WHERE id = $4
       RETURNING *`,
      [semesterNumber, academicYear, branchId, semesterId]
    );

    await logActivity(
      req.user.userId,
      "Semester Updated",
      `semester=${semesterNumber}, year=${academicYear}, id=${semesterId}`
    );
    return res.json({ message: "Updated successfully", data: updated.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Semester already exists for this branch and academic year" });
    }
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ message: "Invalid branch selected" });
    }
    return next(err);
  }
});

router.delete("/semesters/:id", authRequired, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const semesterId = asPositiveInt(req.params.id, 0);
    if (!semesterId) {
      return res.status(400).json({ message: "Invalid semester id" });
    }

    const existing = await pool.query(
      `SELECT id, semester_number, academic_year
       FROM semesters
       WHERE id = $1`,
      [semesterId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Semester not found" });
    }

    const dependency = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM sections WHERE semester_id = $1) AS has_sections,
         EXISTS(SELECT 1 FROM subjects WHERE semester_id = $1) AS has_subjects,
         EXISTS(SELECT 1 FROM timetables WHERE semester_id = $1) AS has_timetables,
         EXISTS(SELECT 1 FROM timetable_history WHERE semester_id = $1) AS has_history`,
      [semesterId]
    );
    const inUse = dependency.rows[0] || {};

    if (inUse.has_sections || inUse.has_subjects || inUse.has_timetables || inUse.has_history) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }

    await pool.query(`DELETE FROM semesters WHERE id = $1`, [semesterId]);
    await logActivity(
      req.user.userId,
      "Semester Deleted",
      `semester=${existing.rows[0].semester_number}, year=${existing.rows[0].academic_year}, id=${semesterId}`
    );
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(409).json({ message: "Cannot delete. Record is in use." });
    }
    return next(err);
  }
});

module.exports = router;
