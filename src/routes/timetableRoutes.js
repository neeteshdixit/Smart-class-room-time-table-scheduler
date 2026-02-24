const express = require("express");
const fs = require("fs");
const path = require("path");
const { body } = require("express-validator");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activity");

const router = express.Router();

const DEFAULT_SEMESTER_WEEKS = 16;

function normalizeSubjectType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "theory") return "Theory";
  if (normalized === "practical") return "Practical";
  if (normalized === "both" || normalized === "theory + practical" || normalized === "theory+practical") {
    return "Theory + Practical";
  }
  return "Theory";
}

function asNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function parseDateToUtcValue(value) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = String(value).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function calculateTotalWeeks(semesterDuration) {
  if (!semesterDuration) {
    return DEFAULT_SEMESTER_WEEKS;
  }

  const startUtc = parseDateToUtcValue(semesterDuration.start_date);
  const endUtc = parseDateToUtcValue(semesterDuration.end_date);
  if (startUtc === null || endUtc === null || endUtc < startUtc) {
    return DEFAULT_SEMESTER_WEEKS;
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.floor((endUtc - startUtc) / millisPerDay) + 1;
  return Math.max(1, Math.ceil(totalDays / 7));
}

function toTimeMinutes(value) {
  const text = String(value || "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function minutesToSqlTime(minutes) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Number(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

function resolveWorkingDays(workingDays) {
  if (String(workingDays || "").trim() === "Mon-Sat") {
    return [1, 2, 3, 4, 5, 6];
  }
  return [1, 2, 3, 4, 5];
}

function computeWeeklyDemand(totalHours, totalWeeks) {
  const safeTotalHours = asNonNegativeInteger(totalHours, 0);
  const safeTotalWeeks = Math.max(1, asNonNegativeInteger(totalWeeks, DEFAULT_SEMESTER_WEEKS));
  if (safeTotalHours === 0) return 0;

  const base = Math.floor(safeTotalHours / safeTotalWeeks);
  const remainder = safeTotalHours % safeTotalWeeks;
  return base + (remainder > 0 ? 1 : 0);
}

function resolveSubjectHourBreakdown(subject) {
  const type = normalizeSubjectType(subject.subject_type);
  const totalHours = asNonNegativeInteger(subject.total_hours ?? subject.total_hours_semester, 0);
  let theoryHours = asNonNegativeInteger(subject.theory_hours ?? subject.theory_hours_per_week, 0);
  let practicalHours = asNonNegativeInteger(subject.practical_hours ?? subject.practical_hours_per_week, 0);

  if (type === "Theory") {
    theoryHours = totalHours > 0 ? totalHours : theoryHours;
    practicalHours = 0;
  } else if (type === "Practical") {
    theoryHours = 0;
    practicalHours = totalHours > 0 ? totalHours : practicalHours;
  } else {
    if (theoryHours === 0 && practicalHours === 0 && totalHours > 0) {
      theoryHours = Math.ceil(totalHours / 2);
      practicalHours = totalHours - theoryHours;
    } else if (totalHours > 0 && theoryHours + practicalHours !== totalHours) {
      const recomputedTheory = Math.max(0, totalHours - practicalHours);
      if (theoryHours === 0 || recomputedTheory + practicalHours === totalHours) {
        theoryHours = recomputedTheory;
      } else {
        practicalHours = Math.max(0, totalHours - theoryHours);
      }
    }
  }

  const resolvedTotal = totalHours > 0 ? totalHours : theoryHours + practicalHours;
  return {
    type,
    totalHours: resolvedTotal,
    theoryHours,
    practicalHours,
  };
}

function getSessionDemands(subject, totalWeeks) {
  const subjectHours = resolveSubjectHourBreakdown(subject);

  if (subjectHours.type === "Theory") {
    return [{ count: computeWeeklyDemand(subjectHours.totalHours, totalWeeks), mode: "Theory" }];
  }

  if (subjectHours.type === "Practical") {
    return [{ count: computeWeeklyDemand(subjectHours.totalHours, totalWeeks), mode: "Practical" }];
  }

  return [
    { count: computeWeeklyDemand(subjectHours.theoryHours, totalWeeks), mode: "Theory" },
    { count: computeWeeklyDemand(subjectHours.practicalHours, totalWeeks), mode: "Practical" },
  ].filter((item) => item.count > 0);
}

async function tableHasColumn(queryable, tableName, columnName, schema = "public") {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = $2
         AND column_name = $3
     ) AS has_column`,
    [schema, tableName, columnName]
  );
  return Boolean(result.rows[0]?.has_column);
}

async function tableExists(queryable, tableName, schema = "public") {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name = $2
     ) AS has_table`,
    [schema, tableName]
  );
  return Boolean(result.rows[0]?.has_table);
}

async function loadAvailableTimeSlots(queryable, departmentId) {
  const hasTimeSlotsTable = await tableExists(queryable, "time_slots");
  if (!hasTimeSlotsTable) {
    return [];
  }

  const hasDepartmentColumn = await tableHasColumn(queryable, "time_slots", "department_id");
  if (!hasDepartmentColumn) {
    const result = await queryable.query(
      `SELECT id, day_of_week, start_time, end_time, slot_number
       FROM time_slots
       ORDER BY day_of_week, slot_number, id`
    );
    return result.rows;
  }

  const departmentSlotsResult = await queryable.query(
    `SELECT id, day_of_week, start_time, end_time, slot_number
     FROM time_slots
     WHERE department_id = $1
     ORDER BY day_of_week, slot_number, id`,
    [departmentId]
  );
  if (departmentSlotsResult.rowCount > 0) {
    return departmentSlotsResult.rows;
  }

  const nullDepartmentSlotsResult = await queryable.query(
    `SELECT id, day_of_week, start_time, end_time, slot_number
     FROM time_slots
     WHERE department_id IS NULL
     ORDER BY day_of_week, slot_number, id`
  );
  if (nullDepartmentSlotsResult.rowCount > 0) {
    return nullDepartmentSlotsResult.rows;
  }

  return [];
}

function buildDepartmentSlotTemplates(scheduleConfig) {
  const startMinutes = toTimeMinutes(scheduleConfig.start_time);
  const endMinutes = toTimeMinutes(scheduleConfig.end_time);
  const slotDurationMinutes = asNonNegativeInteger(scheduleConfig.slot_duration_minutes, 0);
  const breakDurationMinutes = asNonNegativeInteger(scheduleConfig.break_duration_minutes, 0);
  const breakAfterSlotNumber =
    scheduleConfig.break_after_slot_number === null || scheduleConfig.break_after_slot_number === undefined
      ? null
      : Number(scheduleConfig.break_after_slot_number);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error("Department schedule has invalid start/end time");
  }
  if (slotDurationMinutes <= 0) {
    throw new Error("Department schedule has invalid slot duration");
  }
  if (breakDurationMinutes < 0) {
    throw new Error("Department schedule has invalid break duration");
  }
  if (breakDurationMinutes > 0 && (!Number.isInteger(breakAfterSlotNumber) || breakAfterSlotNumber <= 0)) {
    throw new Error("Department schedule requires a valid break-after slot number");
  }

  const templates = [];
  let cursor = startMinutes;
  let slotNumber = 1;
  let breakApplied = false;

  while (cursor < endMinutes) {
    if (breakDurationMinutes > 0 && !breakApplied && slotNumber - 1 === breakAfterSlotNumber) {
      if (cursor + breakDurationMinutes > endMinutes) {
        throw new Error("Department break must be within configured working hours");
      }
      cursor += breakDurationMinutes;
      breakApplied = true;
      continue;
    }

    const remainingMinutes = endMinutes - cursor;
    if (remainingMinutes <= 0) {
      break;
    }
    const slotLength = Math.min(slotDurationMinutes, remainingMinutes);
    const slotEnd = cursor + slotLength;

    templates.push({
      slot_number: slotNumber,
      start_time: minutesToSqlTime(cursor),
      end_time: minutesToSqlTime(slotEnd),
    });
    slotNumber += 1;
    cursor = slotEnd;
  }

  if (templates.length === 0) {
    throw new Error("Department schedule did not produce any valid slots");
  }

  if (breakDurationMinutes > 0 && !breakApplied) {
    throw new Error("Break after slot number exceeds available generated slots");
  }

  return templates;
}

async function ensureDepartmentTimeSlots(client, departmentId, scheduleConfig) {
  const slotTemplates = buildDepartmentSlotTemplates(scheduleConfig);
  const workingDays = resolveWorkingDays(scheduleConfig.working_days);
  const createdSlots = [];

  for (const day of workingDays) {
    for (const template of slotTemplates) {
      const slotResult = await client.query(
        `INSERT INTO time_slots (department_id, day_of_week, start_time, end_time, slot_number)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (department_id, day_of_week, slot_number)
         DO UPDATE SET
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time
         RETURNING id, department_id, day_of_week, start_time, end_time, slot_number`,
        [departmentId, day, template.start_time, template.end_time, template.slot_number]
      );
      createdSlots.push(slotResult.rows[0]);
    }
  }

  return createdSlots.sort((a, b) =>
    Number(a.day_of_week) === Number(b.day_of_week)
      ? Number(a.slot_number) - Number(b.slot_number)
      : Number(a.day_of_week) - Number(b.day_of_week)
  );
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

    const semesterMetaResult = await client.query(
      `SELECT sem.id, sem.branch_id, b.department_id
       FROM semesters sem
       JOIN branches b ON b.id = sem.branch_id
       WHERE sem.id = $1`,
      [semesterId]
    );
    if (semesterMetaResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid semester selected" });
    }
    const departmentId = Number(semesterMetaResult.rows[0].department_id);
    const departmentScheduleResult = await client.query(
      `SELECT id, department_id, start_time, end_time, slot_duration_minutes, break_duration_minutes,
              break_after_slot_number, working_days
       FROM department_schedule_config
       WHERE department_id = $1
       LIMIT 1`,
      [departmentId]
    );
    if (departmentScheduleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Department working hours are not configured. Configure department schedule first.",
      });
    }

    const semesterDurationResult = await client.query(
      `SELECT start_date, end_date
       FROM semester_durations
       WHERE semester_id = $1
       LIMIT 1`,
      [semesterId]
    );
    const totalWeeks = calculateTotalWeeks(semesterDurationResult.rows[0]);
    const hasSessionModeColumn = await tableHasColumn(client, "timetable_entries", "session_mode");

    const sectionsResult = await client.query(
      `SELECT id, section_name, student_strength
       FROM sections
       WHERE semester_id = $1`,
      [semesterId]
    );

    const subjectsResult = await client.query(
      `SELECT id, subject_name, subject_type, total_hours, theory_hours, practical_hours, requires_lab
       FROM subjects
       WHERE semester_id = $1`,
      [semesterId]
    );

    const mappingResult = await client.query(
      `SELECT fs.subject_id, fs.faculty_id, f.full_name, f.max_workload_per_week
       FROM faculty_subjects fs
       JOIN faculty f ON f.id = fs.faculty_id
       JOIN subjects s ON s.id = fs.subject_id
       WHERE fs.faculty_id IS NOT NULL
         AND s.semester_id = $1`,
      [semesterId]
    );

    const roomsResult = await client.query(
      `SELECT id, room_type, capacity
       FROM classrooms`
    );
    const labsResult = await client.query(
      `SELECT id, lab_name, capacity
       FROM laboratories
       WHERE department_id = $1`,
      [departmentId]
    );

    if (sectionsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No sections found for this semester" });
    }

    if (subjectsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No subjects found for this semester" });
    }

    if (roomsResult.rowCount === 0) {
      await client.query("ROLLBACK");
      if (labsResult.rowCount > 0) {
        return res.status(400).json({
          message: "No classrooms configured. Add classroom records (room_type: Lecture/Lab) to assign slots.",
        });
      }
      return res.status(400).json({ message: "No classrooms configured" });
    }

    let slots = [];
    try {
      slots = await ensureDepartmentTimeSlots(client, departmentId, departmentScheduleResult.rows[0]);
    } catch (scheduleErr) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: scheduleErr.message || "Invalid department schedule configuration",
      });
    }
    if (!slots.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No valid slots generated from department schedule" });
    }

    const lectureRooms = roomsResult.rows.filter((room) => room.room_type === "Lecture");
    const labRooms = roomsResult.rows.filter((room) => room.room_type === "Lab");

    if (!lectureRooms.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No lecture classrooms configured" });
    }

    const hasPracticalSubjects = subjectsResult.rows.some((subject) =>
      getSessionDemands(subject, totalWeeks).some((demand) => demand.mode === "Practical" && demand.count > 0)
    );
    if (hasPracticalSubjects && !labRooms.length) {
      await client.query("ROLLBACK");
      if (labsResult.rowCount > 0) {
        return res.status(400).json({
          message: "No classroom with room_type 'Lab' is available for practical sessions.",
        });
      }
      return res.status(400).json({ message: "Practical subjects require lab rooms, but none are configured" });
    }

    const subjectFacultyMap = new Map();
    const facultyWorkloadMap = new Map();

    mappingResult.rows.forEach((row) => {
      if (!subjectFacultyMap.has(row.subject_id)) {
        subjectFacultyMap.set(row.subject_id, []);
      }
      const currentFaculty = subjectFacultyMap.get(row.subject_id);
      if (!currentFaculty.includes(row.faculty_id)) {
        currentFaculty.push(row.faculty_id);
      }
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
      const sourceRooms = mode === "Practical" ? labRooms : lectureRooms;
      return sourceRooms.filter((room) => {
        if (mode === "Practical") {
          return room.capacity >= studentStrength;
        }
        return room.capacity >= studentStrength;
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

      for (const slot of slots) {
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
                session_mode: mode,
              },
            };
          }
        }
      }

      return { success: false, reason: "No conflict-free slot found" };
    }

    for (const section of sectionsResult.rows) {
      for (const subject of subjectsResult.rows) {
        const demands = getSessionDemands(subject, totalWeeks);
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
                requested_per_week: demand.count,
                reason: assigned.reason,
              });
            }
          }
        }
      }
    }

    for (const entry of entries) {
      if (hasSessionModeColumn) {
        await client.query(
          `INSERT INTO timetable_entries
           (timetable_id, section_id, subject_id, faculty_id, classroom_id, timeslot_id, session_mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            entry.timetable_id,
            entry.section_id,
            entry.subject_id,
            entry.faculty_id,
            entry.classroom_id,
            entry.timeslot_id,
            entry.session_mode,
          ]
        );
      } else {
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
    }

    const sessionModeSelect = hasSessionModeColumn
      ? "te.session_mode"
      : "CASE WHEN c.room_type = 'Lab' THEN 'Practical' ELSE 'Theory' END";

    const exportRowsResult = await client.query(
      `SELECT sec.section_name, sub.subject_name, ${sessionModeSelect} AS session_mode, f.full_name AS faculty_name, c.room_number,
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
      timetable: {
        ...timetableResult.rows[0],
        total_weeks: totalWeeks,
        department_id: departmentId,
      },
      total_weeks: totalWeeks,
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
                latest_timetable.id AS timetable_id,
                sem.semester_number, sem.academic_year,
                b.branch_name
         FROM timetable_history th
         JOIN semesters sem ON sem.id = th.semester_id
         JOIN branches b ON b.id = sem.branch_id
         LEFT JOIN LATERAL (
            SELECT t.id
            FROM timetables t
            WHERE t.semester_id = th.semester_id
              AND t.version_name = th.version_name
            ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - th.created_at))) ASC, t.id DESC
            LIMIT 1
         ) latest_timetable ON TRUE
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

async function fetchTimetableDetails(timetableId) {
  const timetableResult = await pool.query(
    `SELECT t.*, s.semester_number, s.academic_year, b.branch_name, d.id AS department_id, d.department_name
     FROM timetables t
     JOIN semesters s ON s.id = t.semester_id
     JOIN branches b ON b.id = s.branch_id
     JOIN departments d ON d.id = b.department_id
     WHERE t.id = $1`,
    [timetableId]
  );

  if (timetableResult.rowCount === 0) {
    return null;
  }

  const timetable = timetableResult.rows[0];
  const hasSessionModeColumn = await tableHasColumn(pool, "timetable_entries", "session_mode");
  const sessionModeSelect = hasSessionModeColumn
    ? "te.session_mode"
    : "CASE WHEN c.room_type = 'Lab' THEN 'Practical' ELSE 'Theory' END";

  const [entriesResult, departmentTimeslots] = await Promise.all([
    pool.query(
      `SELECT te.id, te.section_id, sec.section_name, te.subject_id, sub.subject_name, sub.subject_code,
              CASE WHEN sub.subject_type = 'Both' THEN 'Theory + Practical' ELSE sub.subject_type END AS subject_type,
              ${sessionModeSelect} AS session_mode,
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
    ),
    loadAvailableTimeSlots(pool, Number(timetable.department_id)),
  ]);

  let timeSlots = departmentTimeslots;
  if (timeSlots.length === 0) {
    const fallbackTimeslotsResult = await pool.query(
      `SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_number
       FROM time_slots ts
       WHERE ts.id IN (
         SELECT DISTINCT te.timeslot_id
         FROM timetable_entries te
         WHERE te.timetable_id = $1
       )
       ORDER BY ts.day_of_week, ts.slot_number`,
      [timetableId]
    );
    timeSlots = fallbackTimeslotsResult.rows;
  }

  return {
    timetable,
    entries: entriesResult.rows,
    time_slots: timeSlots,
  };
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
      const detail = await fetchTimetableDetails(timetableId);
      if (!detail) {
        return res.status(404).json({ message: "Timetable not found" });
      }
      return res.json(detail);
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

router.get("/:id", authRequired, async (req, res, next) => {
  try {
    const timetableId = Number(req.params.id);
    if (!Number.isInteger(timetableId) || timetableId <= 0) {
      return res.status(404).json({ message: "Timetable not found" });
    }
    const detail = await fetchTimetableDetails(timetableId);
    if (!detail) {
      return res.status(404).json({ message: "Timetable not found" });
    }
    return res.json(detail);
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
        `SELECT timetable_id, faculty_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY timetable_id, faculty_id, timeslot_id
         HAVING COUNT(*) > 1`
      ),
      pool.query(
        `SELECT timetable_id, classroom_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY timetable_id, classroom_id, timeslot_id
         HAVING COUNT(*) > 1`
      ),
      pool.query(
        `SELECT timetable_id, section_id, timeslot_id, COUNT(*)::int AS conflict_count
         FROM timetable_entries
         GROUP BY timetable_id, section_id, timeslot_id
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
