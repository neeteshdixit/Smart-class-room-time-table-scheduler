const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");

const router = express.Router();

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function resolveFacultyIdentity(userId) {
  const userResult = await pool.query(
    `SELECT id, faculty_id, full_name, email, mobile_number, role
     FROM faculty_users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const user = userResult.rows[0] || null;
  if (!user) {
    return { user: null, mappedFacultyIds: [] };
  }

  const facultyResult = await pool.query(
    `SELECT id, faculty_id, full_name
     FROM faculty
     WHERE LOWER(faculty_id) = LOWER($1)
        OR LOWER(email) = LOWER($2)
        OR mobile_number = $3
     ORDER BY id`,
    [user.faculty_id, user.email, user.mobile_number]
  );

  const mappedFacultyIds = facultyResult.rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);

  return { user, mappedFacultyIds };
}

router.get("/timetable", authRequired, requireRoles("faculty"), async (req, res, next) => {
  try {
    const { user, mappedFacultyIds } = await resolveFacultyIdentity(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Faculty account not found" });
    }

    if (!mappedFacultyIds.length) {
      return res.json({
        faculty: {
          id: user.id,
          faculty_id: user.faculty_id,
          full_name: user.full_name,
          role: user.role,
        },
        timetables: [],
        selected_timetable_id: null,
        entries: [],
        time_slots: [],
      });
    }

    const semesterId = toPositiveInt(req.query.semester_id);
    const timetableIdFromQuery = toPositiveInt(req.query.timetable_id);

    const timetableListResult = await pool.query(
      `SELECT DISTINCT t.id, t.version_name, t.status, t.created_at, t.semester_id,
              sem.semester_number, sem.academic_year,
              b.branch_name, d.department_name
       FROM timetables t
       JOIN timetable_entries te ON te.timetable_id = t.id
       JOIN semesters sem ON sem.id = t.semester_id
       JOIN branches b ON b.id = sem.branch_id
       JOIN departments d ON d.id = b.department_id
       WHERE te.faculty_id = ANY($1::int[])
         AND ($2::int IS NULL OR t.semester_id = $2)
       ORDER BY t.created_at DESC, t.id DESC`,
      [mappedFacultyIds, semesterId]
    );

    if (timetableListResult.rowCount === 0) {
      return res.json({
        faculty: {
          id: user.id,
          faculty_id: user.faculty_id,
          full_name: user.full_name,
          role: user.role,
        },
        timetables: [],
        selected_timetable_id: null,
        entries: [],
        time_slots: [],
      });
    }

    const timetableRows = timetableListResult.rows;
    const selectedTimetableId = timetableIdFromQuery || Number(timetableRows[0].id);
    const selectedTimetable = timetableRows.find((row) => Number(row.id) === selectedTimetableId);

    if (!selectedTimetable) {
      return res.status(404).json({ message: "Requested timetable is not assigned to this faculty." });
    }

    const sessionModeColumnResult = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'timetable_entries'
           AND column_name = 'session_mode'
       ) AS has_session_mode`
    );
    const hasSessionModeColumn = Boolean(sessionModeColumnResult.rows[0]?.has_session_mode);
    const sessionModeSelect = hasSessionModeColumn
      ? "te.session_mode"
      : "CASE WHEN c.room_type = 'Lab' THEN 'Practical' ELSE 'Theory' END";

    const [entriesResult, timeSlotsResult] = await Promise.all([
      pool.query(
        `SELECT te.id, te.timetable_id, te.section_id, sec.section_name,
                te.subject_id, sub.subject_name, sub.subject_code,
                te.faculty_id, f.full_name AS faculty_name,
                te.classroom_id, c.room_number,
                ${sessionModeSelect} AS session_mode,
                ts.id AS timeslot_id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number
         FROM timetable_entries te
         JOIN sections sec ON sec.id = te.section_id
         JOIN subjects sub ON sub.id = te.subject_id
         JOIN faculty f ON f.id = te.faculty_id
         JOIN classrooms c ON c.id = te.classroom_id
         JOIN time_slots ts ON ts.id = te.timeslot_id
         WHERE te.timetable_id = $1
           AND te.faculty_id = ANY($2::int[])
         ORDER BY ts.day_of_week, ts.slot_number, sec.section_name, sub.subject_name`,
        [selectedTimetableId, mappedFacultyIds]
      ),
      pool.query(
        `SELECT DISTINCT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number
         FROM time_slots ts
         JOIN timetable_entries te ON te.timeslot_id = ts.id
         WHERE te.timetable_id = $1
         ORDER BY ts.day_of_week, ts.slot_number, ts.id`,
        [selectedTimetableId]
      ),
    ]);

    return res.json({
      faculty: {
        id: user.id,
        faculty_id: user.faculty_id,
        full_name: user.full_name,
        role: user.role,
        mapped_faculty_ids: mappedFacultyIds,
      },
      timetables: timetableRows,
      selected_timetable_id: selectedTimetableId,
      timetable: selectedTimetable,
      entries: entriesResult.rows,
      time_slots: timeSlotsResult.rows,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
