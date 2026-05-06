const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");

const router = express.Router();

async function tableExists(tableName) {
  const result = await pool.query(`SELECT to_regclass($1) AS table_ref`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_ref);
}

async function getCount(tableName) {
  const exists = await tableExists(tableName);
  if (!exists) {
    return 0;
  }
  const result = await pool.query(`SELECT COUNT(*)::int AS total FROM ${tableName}`);
  return result.rows[0].total;
}

router.get("/", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const includeActivity = String(req.query.include_activity || "false").toLowerCase() === "true";

    const [
      departments,
      departmentScheduleConfigs,
      branches,
      sections,
      facultyCount,
      classrooms,
      labs,
      blocks,
      timeSlots,
      subjects,
      semesters,
      timetableVersions,
      avgWorkloadResult,
      roomUtilizationResult,
    ] = await Promise.all([
      getCount("departments"),
      getCount("department_schedule_config"),
      getCount("branches"),
      getCount("sections"),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM faculty_users
         WHERE LOWER(role) = 'faculty'`
      ).then((result) => result.rows[0].total),
      getCount("classrooms"),
      getCount("laboratories"),
      getCount("blocks"),
      getCount("time_slots"),
      getCount("subjects"),
      getCount("semesters"),
      getCount("timetables"),
      pool.query(
        `SELECT COALESCE(ROUND(AVG(max_workload_per_week)::numeric, 2), 0) AS average_workload
         FROM faculty`
      ),
      pool.query(
        `SELECT
           COALESCE(
             ROUND(
               (COUNT(DISTINCT CONCAT(classroom_id, '-', timeslot_id))::numeric
               / NULLIF((SELECT COUNT(*) FROM classrooms) * NULLIF((SELECT COUNT(*) FROM time_slots), 0), 0)) * 100,
               2
             ),
             0
           ) AS room_utilization_percent
         FROM timetable_entries`
      ),
    ]);

    const recentActivityResult = includeActivity
      ? await pool.query(
          `SELECT action_type, details, created_at
           FROM recent_activity
           ORDER BY created_at DESC
           LIMIT 10`
        )
      : { rows: [] };

    return res.json({
      totals: {
        departments,
        department_schedule_config: departmentScheduleConfigs,
        branches,
        sections,
        faculty: facultyCount,
        classrooms,
        labs,
        blocks,
        time_slots: timeSlots,
        subjects,
        semesters,
        timetable_versions: timetableVersions,
      },
      metrics: {
        average_faculty_workload: Number(avgWorkloadResult.rows[0].average_workload),
        room_utilization_percent: Number(roomUtilizationResult.rows[0].room_utilization_percent),
      },
      ...(includeActivity ? { recent_activity: recentActivityResult.rows } : {}),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
