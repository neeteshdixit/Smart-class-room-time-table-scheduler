const express = require("express");
const fs = require("fs");
const path = require("path");
const { body } = require("express-validator");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activity");

const router = express.Router();

function getSessionDemands(subject) {
  const theory = Number(subject.theory_hours_per_week || 0);
  const practical = Number(subject.practical_hours_per_week || 0);
  const type = subject.subject_type;

  if (type === "Theory") {
    return [{ count: Math.max(1, theory), mode: "Theory" }];
  }
  if (type === "Practical") {
    return [{ count: Math.max(1, practical), mode: "Practical" }];
  }
  return [
    { count: Math.max(1, theory), mode: "Theory" },
    { count: Math.max(1, practical), mode: "Practical" },
  ];
}

function normalizeFileToken(value, fallback = "timetable") {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines) {
  const printableLines = lines.slice(0, 44).map((line) => escapePdfText(line));
  const remaining = Math.max(0, lines.length - printableLines.length);
  if (remaining > 0) {
    printableLines.push(escapePdfText(`...and ${remaining} more rows`));
  }

  let contentStream = "BT\n/F1 10 Tf\n48 770 Td\n13 TL\n";
  printableLines.forEach((line, index) => {
    if (index === 0) {
      contentStream += `(${line}) Tj\n`;
    } else {
      contentStream += "T*\n";
      contentStream += `(${line}) Tj\n`;
    }
  });
  contentStream += "ET";

  const contentLength = Buffer.byteLength(contentStream, "utf8");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  });

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${offsets.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

async function saveTimetablePdf({
  versionName,
  semesterId,
  createdAt,
  entries,
  conflictsCount,
  assignedEntries,
}) {
  const stamp = new Date(createdAt || Date.now()).toISOString();
  const fileName = `${normalizeFileToken(versionName)}-${Date.now()}.pdf`;
  const storageDir = path.join(__dirname, "..", "..", "uploads", "timetables");
  const absolutePath = path.join(storageDir, fileName);
  const publicPath = `/uploads/timetables/${fileName}`;

  const lines = [
    "Smart Classroom Timetable",
    `Version: ${versionName}`,
    `Semester ID: ${semesterId}`,
    `Generated At: ${stamp}`,
    `Assigned Entries: ${assignedEntries}`,
    `Conflicts: ${conflictsCount}`,
    "------------------------------",
    "Section | Subject | Faculty | Room | Day | Slot",
  ];

  entries.forEach((entry) => {
    lines.push(
      `${entry.section_name} | ${entry.subject_name} | ${entry.faculty_name} | ${entry.room_number} | D${entry.day_of_week} | #${entry.slot_number}`
    );
  });

  const pdfBuffer = buildSimplePdf(lines);
  await fs.promises.mkdir(storageDir, { recursive: true });
  await fs.promises.writeFile(absolutePath, pdfBuffer);

  return { publicPath, absolutePath };
}

async function generateTimetableHandler(req, res, next) {
  const client = await pool.connect();
  let pdfFile = null;

  try {
    const { semester_id: semesterId, version_name: versionName } = req.body;

    await client.query("BEGIN");

    const sectionsResult = await client.query(
      `SELECT id, section_name, student_strength
       FROM sections
       WHERE semester_id = $1`,
      [semesterId]
    );

    const subjectsResult = await client.query(
      `SELECT id, subject_name, subject_type, theory_hours_per_week, practical_hours_per_week
       FROM subjects
       WHERE semester_id = $1`,
      [semesterId]
    );

    const mappingResult = await client.query(
      `SELECT fs.subject_id, fs.faculty_id, f.full_name, f.max_workload_per_week
       FROM faculty_subjects fs
       JOIN faculty f ON f.id = fs.faculty_id
       WHERE fs.faculty_id IS NOT NULL`
    );

    const slotsResult = await client.query(
      `SELECT id, day_of_week, slot_number
       FROM time_slots
       ORDER BY day_of_week, slot_number`
    );

    const roomsResult = await client.query(
      `SELECT id, room_type, capacity
       FROM classrooms`
    );

    if (sectionsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No sections found for this semester" });
    }

    if (subjectsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No subjects found for this semester" });
    }

    if (slotsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No time slots configured" });
    }

    if (roomsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No classrooms configured" });
    }

    const subjectFacultyMap = new Map();
    const facultyWorkloadMap = new Map();

    mappingResult.rows.forEach((row) => {
      if (!subjectFacultyMap.has(row.subject_id)) {
        subjectFacultyMap.set(row.subject_id, []);
      }
      subjectFacultyMap.get(row.subject_id).push(row.faculty_id);
      if (!facultyWorkloadMap.has(row.faculty_id)) {
        facultyWorkloadMap.set(row.faculty_id, {
          max: Number(row.max_workload_per_week || 0),
          assigned: 0,
        });
      }
    });

    const timetableResult = await client.query(
      `INSERT INTO timetables (version_name, semester_id, generated_by, status)
       VALUES ($1, $2, $3, 'Draft')
       RETURNING id, created_at`,
      [versionName, semesterId, req.user.userId]
    );

    const timetableId = timetableResult.rows[0].id;
    const createdAt = timetableResult.rows[0].created_at;
    const facultySlotUsed = new Set();
    const roomSlotUsed = new Set();
    const sectionSlotUsed = new Set();
    const entries = [];
    const conflicts = [];

    function roomCandidatesFor(mode, studentStrength) {
      return roomsResult.rows.filter((room) => {
        if (mode === "Practical") {
          return room.room_type === "Lab" && room.capacity >= studentStrength;
        }
        return room.room_type === "Lecture" && room.capacity >= studentStrength;
      });
    }

    function tryAssign(section, subject, mode) {
      const facultyList = subjectFacultyMap.get(subject.id) || [];
      const rooms = roomCandidatesFor(mode, section.student_strength);

      if (facultyList.length === 0) {
        return { success: false, reason: "No faculty mapped for subject" };
      }
      if (rooms.length === 0) {
        return { success: false, reason: "No suitable room available" };
      }

      for (const slot of slotsResult.rows) {
        const sectionSlotKey = `${section.id}-${slot.id}`;
        if (sectionSlotUsed.has(sectionSlotKey)) {
          continue;
        }

        for (const facultyId of facultyList) {
          const load = facultyWorkloadMap.get(facultyId);
          if (!load || load.assigned >= load.max) {
            continue;
          }

          const facultySlotKey = `${facultyId}-${slot.id}`;
          if (facultySlotUsed.has(facultySlotKey)) {
            continue;
          }

          for (const room of rooms) {
            const roomSlotKey = `${room.id}-${slot.id}`;
            if (roomSlotUsed.has(roomSlotKey)) {
              continue;
            }

            sectionSlotUsed.add(sectionSlotKey);
            facultySlotUsed.add(facultySlotKey);
            roomSlotUsed.add(roomSlotKey);
            load.assigned += 1;

            return {
              success: true,
              entry: {
                timetable_id: timetableId,
                section_id: section.id,
                subject_id: subject.id,
                faculty_id: facultyId,
                classroom_id: room.id,
                timeslot_id: slot.id,
              },
            };
          }
        }
      }

      return { success: false, reason: "No conflict-free slot found" };
    }

    for (const section of sectionsResult.rows) {
      for (const subject of subjectsResult.rows) {
        const demands = getSessionDemands(subject);
        for (const demand of demands) {
          for (let i = 0; i < demand.count; i += 1) {
            const assigned = tryAssign(section, subject, demand.mode);
            if (assigned.success) {
              entries.push(assigned.entry);
            } else {
              conflicts.push({
                section_id: section.id,
                section_name: section.section_name,
                subject_id: subject.id,
                subject_name: subject.subject_name,
                mode: demand.mode,
                reason: assigned.reason,
              });
            }
          }
        }
      }
    }

    for (const entry of entries) {
      await client.query(
        `INSERT INTO timetable_entries
         (timetable_id, section_id, subject_id, faculty_id, classroom_id, timeslot_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.timetable_id,
          entry.section_id,
          entry.subject_id,
          entry.faculty_id,
          entry.classroom_id,
          entry.timeslot_id,
        ]
      );
    }

    const exportRowsResult = await client.query(
      `SELECT sec.section_name, sub.subject_name, f.full_name AS faculty_name, c.room_number,
              ts.day_of_week, ts.slot_number
       FROM timetable_entries te
       JOIN sections sec ON sec.id = te.section_id
       JOIN subjects sub ON sub.id = te.subject_id
       JOIN faculty f ON f.id = te.faculty_id
       JOIN classrooms c ON c.id = te.classroom_id
       JOIN time_slots ts ON ts.id = te.timeslot_id
       WHERE te.timetable_id = $1
       ORDER BY sec.section_name, ts.day_of_week, ts.slot_number`,
      [timetableId]
    );

    pdfFile = await saveTimetablePdf({
      versionName,
      semesterId,
      createdAt,
      entries: exportRowsResult.rows,
      conflictsCount: conflicts.length,
      assignedEntries: entries.length,
    });

    const historyResult = await client.query(
      `INSERT INTO timetable_history (version_name, semester_id, pdf_path)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [versionName, semesterId, pdfFile.publicPath]
    );

    await client.query("COMMIT");
    await logActivity(
      req.user.userId,
      "Timetable Generated",
      `timetable_id=${timetableId}, assigned=${entries.length}, conflicts=${conflicts.length}`
    );

    return res.status(201).json({
      message: "Timetable generated",
      timetable: timetableResult.rows[0],
      assigned_entries: entries.length,
      conflicts_count: conflicts.length,
      conflicts,
      pdf_path: pdfFile.publicPath,
      history: historyResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (pdfFile?.absolutePath) {
      try {
        await fs.promises.unlink(pdfFile.absolutePath);
      } catch (unlinkErr) {
        // ignore cleanup failures
      }
    }
    return next(err);
  } finally {
    client.release();
  }
}

async function getTimetableHistoryHandler(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const search = q ? `%${q}%` : "";

    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT th.id, th.version_name, th.semester_id, th.pdf_path, th.created_at,
                sem.semester_number, sem.academic_year,
                b.branch_name
         FROM timetable_history th
         JOIN semesters sem ON sem.id = th.semester_id
         JOIN branches b ON b.id = sem.branch_id
         WHERE ($1 = '' OR th.version_name ILIKE $1 OR b.branch_name ILIKE $1 OR sem.academic_year ILIKE $1)
         ORDER BY th.created_at DESC
         LIMIT $2 OFFSET $3`,
        [search, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM timetable_history th
         JOIN semesters sem ON sem.id = th.semester_id
         JOIN branches b ON b.id = sem.branch_id
         WHERE ($1 = '' OR th.version_name ILIKE $1 OR b.branch_name ILIKE $1 OR sem.academic_year ILIKE $1)`,
        [search]
      ),
    ]);

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
}

const generateTimetableMiddleware = [
  authRequired,
  body("semester_id").isInt({ min: 1 }),
  body("version_name").trim().notEmpty(),
  validateRequest,
  generateTimetableHandler,
];

const getTimetableHistoryMiddleware = [authRequired, getTimetableHistoryHandler];

router.post("/generate", ...generateTimetableMiddleware);
router.get("/history", ...getTimetableHistoryMiddleware);

router.get("/", authRequired, async (req, res, next) => {
  try {
    const { semester_id: semesterId, timetable_id: timetableId, status } = req.query;

    if (timetableId) {
      const timetableResult = await pool.query(
        `SELECT t.*, s.semester_number, s.academic_year
         FROM timetables t
         JOIN semesters s ON s.id = t.semester_id
         WHERE t.id = $1`,
        [timetableId]
      );

      if (timetableResult.rowCount === 0) {
        return res.status(404).json({ message: "Timetable not found" });
      }

      const entriesResult = await pool.query(
        `SELECT te.id, te.section_id, sec.section_name, te.subject_id, sub.subject_name, sub.subject_code,
                te.faculty_id, f.full_name AS faculty_name, te.classroom_id, c.room_number,
                ts.id AS timeslot_id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number
         FROM timetable_entries te
         JOIN sections sec ON sec.id = te.section_id
         JOIN subjects sub ON sub.id = te.subject_id
         JOIN faculty f ON f.id = te.faculty_id
         JOIN classrooms c ON c.id = te.classroom_id
         JOIN time_slots ts ON ts.id = te.timeslot_id
         WHERE te.timetable_id = $1
         ORDER BY sec.section_name, ts.day_of_week, ts.slot_number`,
        [timetableId]
      );

      return res.json({
        timetable: timetableResult.rows[0],
        entries: entriesResult.rows,
      });
    }

    const filters = [];
    const values = [];

    if (semesterId) {
      values.push(semesterId);
      filters.push(`t.semester_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      filters.push(`t.status = $${values.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT t.id, t.version_name, t.semester_id, t.generated_by, t.status, t.created_at,
              s.semester_number, s.academic_year,
              (SELECT COUNT(*) FROM timetable_entries te WHERE te.timetable_id = t.id)::int AS total_entries
       FROM timetables t
       JOIN semesters s ON s.id = t.semester_id
       ${where}
       ORDER BY t.created_at DESC`,
      values
    );

    return res.json({ data: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.post(
  "/:id/approval",
  authRequired,
  [body("status").isIn(["Approved", "Rejected"]), body("comments").optional().trim(), validateRequest],
  async (req, res, next) => {
    try {
      const { status, comments } = req.body;
      const timetableId = Number(req.params.id);

      const timetableResult = await pool.query(
        `UPDATE timetables
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [status, timetableId]
      );

      if (timetableResult.rowCount === 0) {
        return res.status(404).json({ message: "Timetable not found" });
      }

      await pool.query(
        `INSERT INTO approvals (timetable_id, approved_by, status, comments)
         VALUES ($1, $2, $3, $4)`,
        [timetableId, req.user.userId, status, comments || null]
      );

      await logActivity(req.user.userId, `Timetable ${status}`, `timetable_id=${timetableId}`);
      return res.json({
        message: `Timetable ${status.toLowerCase()} successfully`,
        timetable: timetableResult.rows[0],
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.get("/reports/workload", authRequired, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.faculty_id, f.full_name,
              f.max_workload_per_week,
              COUNT(te.id)::int AS assigned_slots
       FROM faculty f
       LEFT JOIN timetable_entries te ON te.faculty_id = f.id
       GROUP BY f.id
       ORDER BY assigned_slots DESC, f.full_name`
    );

    return res.json({ data: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.get("/reports/room-utilization", authRequired, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.room_number, c.room_type, c.capacity,
              COUNT(te.id)::int AS used_slots
       FROM classrooms c
       LEFT JOIN timetable_entries te ON te.classroom_id = c.id
       GROUP BY c.id
       ORDER BY used_slots DESC, c.room_number`
    );

    return res.json({ data: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.get("/reports/subject-distribution", authRequired, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT sec.id AS section_id, sec.section_name, sub.subject_name, sub.subject_code,
              COUNT(te.id)::int AS allocated_sessions
       FROM timetable_entries te
       JOIN sections sec ON sec.id = te.section_id
       JOIN subjects sub ON sub.id = te.subject_id
       GROUP BY sec.id, sec.section_name, sub.subject_name, sub.subject_code
       ORDER BY sec.section_name, allocated_sessions DESC, sub.subject_name`
    );

    return res.json({ data: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.get("/reports/conflicts", authRequired, async (req, res, next) => {
  try {
    const [facultyConflict, roomConflict, sectionConflict] = await Promise.all([
      pool.query(
        `SELECT faculty_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY faculty_id, timeslot_id
         HAVING COUNT(*) > 1`
      ),
      pool.query(
        `SELECT classroom_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY classroom_id, timeslot_id
         HAVING COUNT(*) > 1`
      ),
      pool.query(
        `SELECT section_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY section_id, timeslot_id
         HAVING COUNT(*) > 1`
      ),
    ]);

    return res.json({
      faculty_conflicts: facultyConflict.rows,
      classroom_conflicts: roomConflict.rows,
      section_conflicts: sectionConflict.rows,
      has_conflicts:
        facultyConflict.rowCount > 0 || roomConflict.rowCount > 0 || sectionConflict.rowCount > 0,
    });
  } catch (err) {
    return next(err);
  }
});

router.generateTimetableMiddleware = generateTimetableMiddleware;
router.getTimetableHistoryMiddleware = getTimetableHistoryMiddleware;

module.exports = router;
