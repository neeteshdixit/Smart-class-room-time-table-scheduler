const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");
const { logActivity } = require("../utils/activity");

const router = express.Router();

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}

const resourceConfig = {
  departments: {
    table: "departments",
    fields: ["department_name", "department_code", "hod_name"],
    required: ["department_name", "department_code"],
  },
  branches: {
    table: "branches",
    fields: ["branch_name", "branch_code", "department_id", "program_type"],
    required: ["branch_name", "branch_code", "department_id", "program_type"],
  },
  semesters: {
    table: "semesters",
    fields: ["semester_number", "academic_year", "branch_id"],
    required: ["semester_number", "academic_year", "branch_id"],
  },
  sections: {
    table: "sections",
    fields: ["section_name", "branch_id", "semester_id", "student_strength"],
    required: ["section_name", "branch_id", "semester_id"],
  },
  faculty: {
    table: "faculty",
    fields: [
      "faculty_id",
      "full_name",
      "department_id",
      "designation",
      "qualification",
      "experience_years",
      "max_workload_per_week",
      "preferred_time_slots",
      "avg_leaves_per_month",
      "email",
      "mobile_number",
      "joining_date",
    ],
    required: [
      "faculty_id",
      "full_name",
      "department_id",
      "designation",
      "qualification",
      "experience_years",
      "max_workload_per_week",
      "email",
      "mobile_number",
      "joining_date",
    ],
  },
  subjects: {
    table: "subjects",
    fields: [
      "subject_name",
      "subject_code",
      "department_id",
      "branch_id",
      "semester_id",
      "subject_type",
      "total_hours",
      "theory_hours",
      "practical_hours",
      "requires_lab",
      "theory_hours_per_week",
      "practical_hours_per_week",
      "total_hours_semester",
      "syllabus_file_url",
    ],
    required: [
      "subject_name",
      "subject_code",
      "department_id",
      "branch_id",
      "semester_id",
      "subject_type",
      "total_hours",
    ],
  },
  "faculty-subjects": {
    table: "faculty_subjects",
    fields: ["faculty_id", "subject_id"],
    required: ["faculty_id", "subject_id"],
  },
  blocks: {
    table: "blocks",
    fields: ["block_name", "number_of_floors"],
    required: ["block_name", "number_of_floors"],
  },
  classrooms: {
    table: "classrooms",
    fields: ["room_number", "capacity", "block_id", "floor_number", "room_type"],
    required: ["room_number", "capacity", "block_id", "floor_number", "room_type"],
  },
  laboratories: {
    table: "laboratories",
    fields: ["lab_name", "department_id", "capacity", "equipment_type", "lab_duration_preference"],
    required: ["lab_name", "department_id", "capacity"],
  },
  "department-schedule-config": {
    table: "department_schedule_config",
    fields: [
      "department_id",
      "start_time",
      "end_time",
      "slot_duration_minutes",
      "break_duration_minutes",
      "break_after_slot_number",
      "working_days",
    ],
    required: [
      "department_id",
      "start_time",
      "end_time",
    ],
  },
  "semester-durations": {
    table: "semester_durations",
    fields: ["semester_id", "start_date", "end_date"],
    required: ["semester_id", "start_date", "end_date"],
  },
  "scheduling-parameters": {
    table: "scheduling_parameters",
    fields: [
      "class_duration_minutes",
      "working_days_per_week",
      "working_hours_start",
      "working_hours_end",
      "break_duration_minutes",
      "max_classes_per_day",
      "lab_session_duration",
      "special_fixed_slots",
    ],
    required: [
      "class_duration_minutes",
      "working_days_per_week",
      "working_hours_start",
      "working_hours_end",
      "break_duration_minutes",
      "max_classes_per_day",
      "lab_session_duration",
    ],
  },
  "time-slots": {
    table: "time_slots",
    fields: ["department_id", "day_of_week", "start_time", "end_time", "slot_number"],
    required: ["day_of_week", "start_time", "end_time", "slot_number"],
  },
};

function getConfig(resource) {
  return resourceConfig[resource] || null;
}

function isManualTimeSlotResource(resource) {
  return resource === "time-slots";
}

router.get("/:resource", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const { resource } = req.params;
    const config = getConfig(resource);
    if (!config) {
      return res.status(404).json({ message: "Unknown resource" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${String(req.query.q).toLowerCase()}%` : null;

    let whereClauses = [];
    let queryValues = [];

    // Auto-filter by any field present in the table (e.g., department_id, branch_id)
    config.fields.forEach((field) => {
      if (req.query[field] !== undefined) {
        whereClauses.push(`${field} = $${queryValues.length + 1}`);
        queryValues.push(req.query[field]);
      }
    });

    // Support search across text fields
    if (q) {
      const searchFields = config.fields.filter(f => f.includes('name') || f.includes('code') || f.includes('email'));
      if (searchFields.length > 0) {
        const searchClause = searchFields.map(f => `LOWER(${f}) LIKE $${queryValues.length + 1}`).join(" OR ");
        whereClauses.push(`(${searchClause})`);
        queryValues.push(q);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ${config.table} ${whereSql}`,
      queryValues
    );

    const result = await pool.query(
      `SELECT * FROM ${config.table}
       ${whereSql}
       ORDER BY id DESC
       LIMIT $${queryValues.length + 1} OFFSET $${queryValues.length + 2}`,
      [...queryValues, limit, offset]
    );

    return res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/:resource", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const config = getConfig(req.params.resource);
    if (!config) {
      return res.status(404).json({ message: "Unknown resource" });
    }

    if (req.params.resource === "faculty" && !isAdminRole(req.user.role)) {
      return res.status(403).json({
        message: "Only admin can add faculty records",
      });
    }

    if (isManualTimeSlotResource(req.params.resource)) {
      return res.status(400).json({
        message: "Manual time slot creation is disabled. Configure department schedule and generate timetable.",
      });
    }

    const missingFields = config.required.filter((field) => req.body[field] === undefined);
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const fields = config.fields.filter((field) => req.body[field] !== undefined);
    const values = fields.map((field) => req.body[field]);
    const placeholders = fields.map((_, idx) => `$${idx + 1}`);

    const result = await pool.query(
      `INSERT INTO ${config.table} (${fields.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );

    await logActivity(req.user.userId, `Created ${req.params.resource}`, JSON.stringify(result.rows[0]));

    return res.status(201).json({
      message: "Record created successfully",
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Duplicate record detected" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid reference id provided" });
    }
    return next(err);
  }
});

router.put("/:resource/:id", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const config = getConfig(req.params.resource);
    if (!config) {
      return res.status(404).json({ message: "Unknown resource" });
    }

    if (isManualTimeSlotResource(req.params.resource)) {
      return res.status(400).json({
        message: "Manual time slot update is disabled. Configure department schedule and generate timetable.",
      });
    }

    const updates = config.fields.filter((field) => req.body[field] !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const values = updates.map((field) => req.body[field]);
    const assignments = updates.map((field, idx) => `${field} = $${idx + 1}`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE ${config.table}
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    await logActivity(req.user.userId, `Updated ${req.params.resource}`, `id=${req.params.id}`);
    return res.json({ message: "Record updated successfully", data: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Duplicate record detected" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid reference id provided" });
    }
    return next(err);
  }
});

router.delete("/:resource/:id", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const config = getConfig(req.params.resource);
    if (!config) {
      return res.status(404).json({ message: "Unknown resource" });
    }

    if (isManualTimeSlotResource(req.params.resource)) {
      return res.status(400).json({
        message: "Manual time slot deletion is disabled. Configure department schedule and generate timetable.",
      });
    }

    const result = await pool.query(
      `DELETE FROM ${config.table}
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    await logActivity(req.user.userId, `Deleted ${req.params.resource}`, `id=${req.params.id}`);
    return res.json({ message: "Record deleted successfully" });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({ message: "Delete blocked by dependent records" });
    }
    return next(err);
  }
});

module.exports = router;
