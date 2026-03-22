const express = require("express");
const fs = require("fs");
const path = require("path");
const { body } = require("express-validator");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { normalizeEmailList, sendTimetableSharedEmails } = require("../utils/mailer");

const router = express.Router();
const SYSTEM_FACULTY_EMAIL_DOMAIN = "scheduler.local";

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function resolveUploadFileAbsolutePath(publicPath) {
  const cleaned = String(publicPath || "").trim();
  if (!cleaned) return null;

  const relativePath = cleaned.replace(/^\/+/, "");
  const absolutePath = path.resolve(path.join(__dirname, "..", "..", relativePath));
  const uploadsRoot = path.resolve(path.join(__dirname, "..", "..", "uploads"));

  if (!absolutePath.startsWith(uploadsRoot)) {
    return null;
  }

  return absolutePath;
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

async function listAccessibleTimetables(mappedFacultyIds, semesterId = null) {
  if (!mappedFacultyIds.length) {
    return [];
  }

  const timetableListResult = await pool.query(
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
     WHERE te.faculty_id = ANY($1::int[])
       AND ($2::int IS NULL OR t.semester_id = $2)
     ORDER BY t.created_at DESC, t.id DESC`,
    [mappedFacultyIds, semesterId]
  );

  return timetableListResult.rows;
}

async function fetchStudentTimetablePayload(mappedFacultyIds, options = {}) {
  const semesterId = toPositiveInt(options.semesterId);
  const requestedTimetableId = toPositiveInt(options.timetableId);
  const requestedSectionId = toPositiveInt(options.sectionId);
  const timetableRows = await listAccessibleTimetables(mappedFacultyIds, semesterId);

  if (!timetableRows.length) {
    return {
      timetables: [],
      selected_timetable_id: null,
      selected_section_id: null,
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
         AND ($2::int IS NULL OR te.section_id = $2)
       ORDER BY sec.section_name, ts.day_of_week, ts.slot_number, sub.subject_name`,
      [selectedTimetableId, requestedSectionId]
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

  const sections = Array.from(
    new Map(entriesResult.rows.map((entry) => [Number(entry.section_id), { id: Number(entry.section_id), name: entry.section_name }])).values()
  ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const selectedSectionId =
    requestedSectionId && sections.some((section) => Number(section.id) === requestedSectionId)
      ? requestedSectionId
      : sections[0]?.id || null;

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
    const timetableRows = await listAccessibleTimetables(mappedFacultyIds, semesterId);

    if (!timetableRows.length) {
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
      pdf_path: selectedTimetable.pdf_path || null,
      download_url: selectedTimetable.pdf_path ? buildAbsolutePublicUrl(req, selectedTimetable.pdf_path) : null,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/student-timetable", authRequired, requireRoles("faculty"), async (req, res, next) => {
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
        selected_section_id: null,
        timetable: null,
        sections: [],
        entries: [],
        time_slots: [],
        pdf_path: null,
      });
    }

    const payload = await fetchStudentTimetablePayload(mappedFacultyIds, {
      semesterId: req.query.semester_id,
      timetableId: req.query.timetable_id,
      sectionId: req.query.section_id,
    });
    if (payload === null) {
      return res.status(404).json({ message: "Requested timetable is not assigned to this faculty." });
    }

    return res.json({
      faculty: {
        id: user.id,
        faculty_id: user.faculty_id,
        full_name: user.full_name,
        role: user.role,
        mapped_faculty_ids: mappedFacultyIds,
      },
      ...payload,
      download_url: payload.pdf_path ? buildAbsolutePublicUrl(req, payload.pdf_path) : null,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/student-timetable/download", authRequired, requireRoles("faculty"), async (req, res, next) => {
  try {
    const { mappedFacultyIds } = await resolveFacultyIdentity(req.user.userId);
    if (!mappedFacultyIds.length) {
      return res.status(404).json({ message: "No timetable is assigned to this faculty." });
    }

    const payload = await fetchStudentTimetablePayload(mappedFacultyIds, {
      timetableId: req.query.timetable_id,
      sectionId: req.query.section_id,
    });
    if (!payload?.timetable) {
      return res.status(404).json({ message: "Requested timetable is not assigned to this faculty." });
    }

    if (!payload.pdf_path) {
      return res.status(404).json({ message: "Timetable PDF is not available for download." });
    }

    const absolutePath = resolveUploadFileAbsolutePath(payload.pdf_path);
    if (!absolutePath) {
      return res.status(404).json({ message: "Timetable PDF path is invalid." });
    }

    await fs.promises.access(absolutePath, fs.constants.R_OK);
    const safeVersionName = String(payload.timetable.version_name || "student-timetable")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return res.download(absolutePath, `${safeVersionName || "student-timetable"}.pdf`);
  } catch (err) {
    if (String(err?.code || "") === "ENOENT") {
      return res.status(404).json({ message: "Timetable PDF file was not found." });
    }
    return next(err);
  }
});

const shareStudentTimetableMiddleware = [
  authRequired,
  requireRoles("faculty"),
  body("timetable_id").isInt({ min: 1 }),
  body("section_id").optional().isInt({ min: 1 }),
  body("recipient_emails").isArray({ min: 1 }),
  body("recipient_emails.*").trim().isEmail(),
  body("message").optional().isString(),
  validateRequest,
  async (req, res, next) => {
    try {
      const { user, mappedFacultyIds } = await resolveFacultyIdentity(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "Faculty account not found" });
      }

      if (!mappedFacultyIds.length) {
        return res.status(404).json({ message: "No timetable is assigned to this faculty." });
      }

      const payload = await fetchStudentTimetablePayload(mappedFacultyIds, {
        timetableId: req.body.timetable_id,
        sectionId: req.body.section_id,
      });
      if (!payload?.timetable) {
        return res.status(404).json({ message: "Requested timetable is not assigned to this faculty." });
      }

      const recipients = normalizeEmailList(req.body.recipient_emails);
      if (!recipients.length) {
        return res.status(400).json({ message: "Provide at least one valid recipient email." });
      }

      const selectedSection = payload.sections.find((section) => Number(section.id) === Number(payload.selected_section_id));
      const shareSummary = await sendTimetableSharedEmails(recipients, {
        message: String(req.body.message || "").trim(),
        sharedBy: `${user.full_name || "-"} (${user.faculty_id || "-"})`,
        versionName: payload.timetable.version_name,
        sectionName: selectedSection?.name || "",
        semesterNumber: payload.timetable.semester_number,
        academicYear: payload.timetable.academic_year,
        pdfUrl: payload.pdf_path ? buildAbsolutePublicUrl(req, payload.pdf_path) : "",
        portalUrl: payload.pdf_path ? buildAbsolutePublicUrl(req, payload.pdf_path) : "",
      });

      return res.json({
        message: "Student timetable shared",
        timetable_id: payload.selected_timetable_id,
        section_id: payload.selected_section_id,
        pdf_path: payload.pdf_path,
        share_summary: shareSummary,
      });
    } catch (err) {
      return next(err);
    }
  },
];

router.post("/student-timetable/share", ...shareStudentTimetableMiddleware);

module.exports = router;
