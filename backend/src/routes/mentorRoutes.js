const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");
const {
  listMentorSectionsByFacultyUserId,
  isMentorMappedToSection,
} = require("../models/mentorMappingModel");

const router = express.Router();

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildAbsolutePublicUrl(req, publicPath) {
  const cleanedPath = String(publicPath || "").trim();
  if (!cleanedPath) return "";

  if (/^https?:\/\//i.test(cleanedPath)) {
    return cleanedPath;
  }

  const appBaseUrl = String(process.env.PUBLIC_APP_BASE_URL || process.env.PUBLIC_API_BASE_URL || "").trim();
  if (appBaseUrl) {
    return `${appBaseUrl.replace(/\/+$/, "")}/${cleanedPath.replace(/^\/+/, "")}`;
  }

  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || "")
    .split(",")[0]
    .trim();
  if (!host) {
    return cleanedPath;
  }
  return `${protocol}://${host}${cleanedPath.startsWith("/") ? cleanedPath : `/${cleanedPath}`}`;
}

async function tableHasColumn(tableName, columnName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS has_column`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.has_column);
}

async function findFacultyUserById(userId) {
  const result = await pool.query(
    `SELECT id, faculty_id, full_name, role, is_mentor
     FROM faculty_users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function listSectionTimetables(sectionId, semesterId = null) {
  const result = await pool.query(
    `SELECT DISTINCT t.id, t.version_name, t.status, t.created_at, t.semester_id,
            sem.semester_number, sem.academic_year,
            b.branch_name, d.department_name,
            history.pdf_path
     FROM timetables t
     JOIN timetable_entries te ON te.timetable_id = t.id
     JOIN semesters sem ON sem.id = t.semester_id
     JOIN branches b ON b.id = sem.branch_id
     JOIN departments d ON d.id = b.department_id
     LEFT JOIN LATERAL (
       SELECT th.pdf_path
       FROM timetable_history th
       WHERE th.semester_id = t.semester_id
         AND th.version_name = t.version_name
       ORDER BY ABS(EXTRACT(EPOCH FROM (th.created_at - t.created_at))) ASC, th.id DESC
       LIMIT 1
     ) history ON TRUE
     WHERE te.section_id = $1
       AND ($2::int IS NULL OR t.semester_id = $2)
     ORDER BY t.created_at DESC, t.id DESC`,
    [sectionId, semesterId]
  );
  return result.rows;
}

async function fetchMentorTimetablePayload(sectionId, options = {}) {
  const semesterId = toPositiveInt(options.semesterId);
  const requestedTimetableId = toPositiveInt(options.timetableId);
  const timetableRows = await listSectionTimetables(sectionId, semesterId);

  if (!timetableRows.length) {
    return {
      timetables: [],
      selected_timetable_id: null,
      selected_section_id: sectionId,
      timetable: null,
      sections: [],
      entries: [],
      time_slots: [],
      pdf_path: null,
    };
  }

  const selectedTimetableId = requestedTimetableId || Number(timetableRows[0].id);
  const selectedTimetable = timetableRows.find((row) => Number(row.id) === selectedTimetableId);
  if (!selectedTimetable) {
    return null;
  }

  const hasSessionModeColumn = await tableHasColumn("timetable_entries", "session_mode");
  const sessionModeSelect = hasSessionModeColumn
    ? "te.session_mode"
    : "CASE WHEN c.room_type = 'Lab' THEN 'Practical' ELSE 'Theory' END";

  const [entriesResult, timeSlotsResult, sectionsResult] = await Promise.all([
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
         AND te.section_id = $2
       ORDER BY ts.day_of_week, ts.slot_number, sub.subject_name`,
      [selectedTimetableId, sectionId]
    ),
    pool.query(
      `SELECT DISTINCT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number
       FROM time_slots ts
       JOIN timetable_entries te ON te.timeslot_id = ts.id
       WHERE te.timetable_id = $1
       ORDER BY ts.day_of_week, ts.slot_number, ts.id`,
      [selectedTimetableId]
    ),
    pool.query(
      `SELECT DISTINCT sec.id, sec.section_name
       FROM timetable_entries te
       JOIN sections sec ON sec.id = te.section_id
       WHERE te.timetable_id = $1
       ORDER BY sec.section_name`,
      [selectedTimetableId]
    ),
  ]);

  const sections = sectionsResult.rows.map((row) => ({
    id: Number(row.id),
    name: row.section_name,
  }));
  const selectedSectionId = sections.some((section) => Number(section.id) === Number(sectionId))
    ? Number(sectionId)
    : sections[0]?.id || Number(sectionId);

  return {
    timetables: timetableRows,
    selected_timetable_id: selectedTimetableId,
    selected_section_id: selectedSectionId,
    timetable: selectedTimetable,
    sections,
    entries: entriesResult.rows,
    time_slots: timeSlotsResult.rows,
    pdf_path: selectedTimetable.pdf_path || null,
  };
}

router.get("/sections", authRequired, requireRoles("faculty"), async (req, res, next) => {
  try {
    const user = await findFacultyUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Faculty account not found" });
    }

    if (!Boolean(user.is_mentor)) {
      return res.json({
        faculty: {
          id: user.id,
          faculty_id: user.faculty_id,
          full_name: user.full_name,
          role: user.role,
          is_mentor: false,
        },
        sections: [],
      });
    }

    const sections = await listMentorSectionsByFacultyUserId(user.id);
    return res.json({
      faculty: {
        id: user.id,
        faculty_id: user.faculty_id,
        full_name: user.full_name,
        role: user.role,
        is_mentor: true,
      },
      sections,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/timetable/:sectionId", authRequired, requireRoles("faculty"), async (req, res, next) => {
  try {
    const sectionId = toPositiveInt(req.params.sectionId);
    if (!sectionId) {
      return res.status(400).json({ message: "Invalid section id" });
    }

    const user = await findFacultyUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Faculty account not found" });
    }

    if (!Boolean(user.is_mentor)) {
      return res.status(403).json({ message: "Mentor access is not enabled for this account." });
    }

    const hasAccess = await isMentorMappedToSection(user.id, sectionId);
    if (!hasAccess) {
      return res.status(403).json({ message: "You are not assigned as mentor for this section." });
    }

    const payload = await fetchMentorTimetablePayload(sectionId, {
      semesterId: req.query.semester_id,
      timetableId: req.query.timetable_id,
    });

    if (payload === null) {
      return res.status(404).json({ message: "Requested timetable is not available for this section." });
    }

    return res.json({
      faculty: {
        id: user.id,
        faculty_id: user.faculty_id,
        full_name: user.full_name,
        role: user.role,
        is_mentor: true,
      },
      ...payload,
      download_url: payload.pdf_path ? buildAbsolutePublicUrl(req, payload.pdf_path) : null,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

