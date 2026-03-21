const express = require("express");
const fs = require("fs");
const path = require("path");
const { body } = require("express-validator");
const pool = require("../config/db");
const { authRequired, requireRoles } = require("../middleware/auth");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activity");

const router = express.Router();

const DEFAULT_SEMESTER_WEEKS = 16;
const DEFAULT_SLOT_DURATION_MINUTES = 50;
const DEFAULT_MAX_WORKLOAD_PER_WEEK = 30;
const DEFAULT_MAX_CLASSES_PER_DAY = 6;
const DEFAULT_FACULTY_OVERUSE_THRESHOLD = 2;
const DEFAULT_LAB_BLOCK_MINUTES = 100;
const LAB_SESSION_SLOT_SPAN = 2;
const GENERATION_STRATEGY = Object.freeze({
  BALANCED: "balanced",
  COMPACT: "compact",
  FACULTY_FRIENDLY: "faculty_friendly",
});

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

function ensureAdmin(req, res) {
  if (isAdminRole(req.user?.role)) {
    return true;
  }
  res.status(403).json({ message: "Only admin can perform this action" });
  return false;
}

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

function normalizeGenerationStrategy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === GENERATION_STRATEGY.COMPACT) return GENERATION_STRATEGY.COMPACT;
  if (normalized === GENERATION_STRATEGY.FACULTY_FRIENDLY) return GENERATION_STRATEGY.FACULTY_FRIENDLY;
  return GENERATION_STRATEGY.BALANCED;
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
  if (Array.isArray(workingDays)) {
    const normalizedArray = [...new Set(workingDays.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1 && item <= 7))].sort(
      (a, b) => a - b
    );
    if (normalizedArray.length > 0) {
      return normalizedArray;
    }
  }

  const raw = String(workingDays || "").trim();
  const normalized = raw.toLowerCase();
  if (normalized === "mon-sun" || normalized === "monday-sunday") {
    return [1, 2, 3, 4, 5, 6, 7];
  }
  if (normalized === "mon-sat" || normalized === "monday-saturday") {
    return [1, 2, 3, 4, 5, 6];
  }
  if (normalized === "mon-fri" || normalized === "monday-friday") {
    return [1, 2, 3, 4, 5];
  }

  const parsedCount = Number(raw);
  if (Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= 7) {
    return Array.from({ length: parsedCount }, (_, index) => index + 1);
  }

  return [1, 2, 3, 4, 5];
}

function computeWeeklySessions(totalHours, totalWeeks, slotDurationMinutes) {
  const safeTotalHours = asNonNegativeInteger(totalHours, 0);
  const safeTotalWeeks = Math.max(1, asNonNegativeInteger(totalWeeks, DEFAULT_SEMESTER_WEEKS));
  const safeSlotDuration = Math.max(1, asNonNegativeInteger(slotDurationMinutes, 0));
  if (safeTotalHours === 0) return 0;

  const weeklyHours = safeTotalHours / safeTotalWeeks;
  const weeklyMinutes = weeklyHours * 60;
  return Math.max(1, Math.ceil(weeklyMinutes / safeSlotDuration));
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

function getSessionDemands(subject, totalWeeks, slotDurationMinutes, labBlockMinutes) {
  const subjectHours = resolveSubjectHourBreakdown(subject);
  const safeLabBlockMinutes = Math.max(1, asNonNegativeInteger(labBlockMinutes, DEFAULT_LAB_BLOCK_MINUTES));

  if (subjectHours.type === "Theory") {
    return [{ count: computeWeeklySessions(subjectHours.totalHours, totalWeeks, slotDurationMinutes), mode: "Theory" }];
  }

  if (subjectHours.type === "Practical") {
    return [{ count: computeWeeklySessions(subjectHours.totalHours, totalWeeks, safeLabBlockMinutes), mode: "Practical" }];
  }

  return [
    { count: computeWeeklySessions(subjectHours.theoryHours, totalWeeks, slotDurationMinutes), mode: "Theory" },
    { count: computeWeeklySessions(subjectHours.practicalHours, totalWeeks, safeLabBlockMinutes), mode: "Practical" },
  ].filter((item) => item.count > 0);
}

function requiresLabRoom(subject) {
  const type = normalizeSubjectType(subject.subject_type);
  return Boolean(subject.requires_lab) || type === "Practical" || type === "Theory + Practical";
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
    if (remainingMinutes < slotDurationMinutes) {
      break;
    }
    const slotLength = slotDurationMinutes;
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
  const slotNumbers = slotTemplates.map((template) => Number(template.slot_number));
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

  const hasTimetableEntriesTable = await tableExists(client, "timetable_entries");
  if (hasTimetableEntriesTable) {
    await client.query(
      `DELETE FROM time_slots ts
       WHERE ts.department_id = $1
         AND (
           NOT (ts.day_of_week = ANY($2::int[]))
           OR NOT (ts.slot_number = ANY($3::int[]))
         )
         AND NOT EXISTS (
           SELECT 1
           FROM timetable_entries te
           WHERE te.timeslot_id = ts.id
         )`,
      [departmentId, workingDays, slotNumbers]
    );
  } else {
    await client.query(
      `DELETE FROM time_slots
       WHERE department_id = $1
         AND (
           NOT (day_of_week = ANY($2::int[]))
           OR NOT (slot_number = ANY($3::int[]))
         )`,
      [departmentId, workingDays, slotNumbers]
    );
  }

  return createdSlots.sort((a, b) =>
    Number(a.day_of_week) === Number(b.day_of_week)
      ? Number(a.slot_number) - Number(b.slot_number)
      : Number(a.day_of_week) - Number(b.day_of_week)
  );
}

async function ensureAutoLectureRoomsForSections(client, { requiredLectureRooms, requiredCapacity, departmentId }) {
  const targetLectureRooms = Math.max(0, asNonNegativeInteger(requiredLectureRooms, 0));
  if (targetLectureRooms === 0) {
    return [];
  }

  const capacity = Math.max(1, asNonNegativeInteger(requiredCapacity, 60));
  const depId = Math.max(1, asNonNegativeInteger(departmentId, 1));
  const createdRooms = [];

  const lectureCountResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM classrooms
     WHERE LOWER(room_type) = 'lecture'`
  );
  let lectureCount = Number(lectureCountResult.rows[0]?.count || 0);
  if (lectureCount >= targetLectureRooms) {
    return createdRooms;
  }

  const existingBlockResult = await client.query(
    `SELECT id
     FROM blocks
     ORDER BY id
     LIMIT 1`
  );

  let blockId = Number(existingBlockResult.rows[0]?.id || 0);
  if (!blockId) {
    const autoBlockName = `AUTO-BLOCK-${depId}`;
    const autoBlockResult = await client.query(
      `INSERT INTO blocks (block_name, number_of_floors)
       VALUES ($1, 1)
       ON CONFLICT (block_name)
       DO UPDATE SET number_of_floors = GREATEST(blocks.number_of_floors, EXCLUDED.number_of_floors)
       RETURNING id`,
      [autoBlockName]
    );
    blockId = Number(autoBlockResult.rows[0]?.id || 0);
  }

  let roomSeed = 1;
  let safetyCounter = 0;
  while (lectureCount < targetLectureRooms && safetyCounter < 300) {
    safetyCounter += 1;
    const roomNumber = `AUTO-LEC-${depId}-${roomSeed}`;
    roomSeed += 1;

    const insertRoomResult = await client.query(
      `INSERT INTO classrooms (room_number, capacity, block_id, floor_number, room_type)
       VALUES ($1, $2, $3, 0, 'Lecture')
       ON CONFLICT (room_number) DO NOTHING
       RETURNING id, room_number, room_type, capacity`,
      [roomNumber, capacity, blockId]
    );

    if (insertRoomResult.rowCount === 0) {
      continue;
    }

    lectureCount += 1;
    createdRooms.push(insertRoomResult.rows[0]);
  }

  return createdRooms;
}

function resolveSlotGenerationErrorMessage(err) {
  const code = String(err?.code || "").trim();
  const message = String(err?.message || "").trim();
  const normalized = message.toLowerCase();

  if (
    code === "23503" ||
    normalized.includes("timetable_entries_timeslot_id_fkey") ||
    normalized.includes("violates restrict")
  ) {
    return "Existing timetable entries are linked to previous time slots. Old referenced slots were kept; update schedule and regenerate.";
  }

  return message || "Invalid department schedule configuration";
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

async function removeHistoryPdfFile(publicPath) {
  const absolutePath = resolveUploadFileAbsolutePath(publicPath);
  if (!absolutePath) return;

  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (String(err?.code || "") !== "ENOENT") {
      throw err;
    }
  }
}

const PRECHECK_LABELS = Object.freeze({
  subjects_found: "Subjects found",
  faculty_mapped: "Faculty mapped",
  labs_available: "Labs available",
  working_days_configured: "Working days configured",
});

const CONFLICT_REASON = Object.freeze({
  MISSING_FACULTY: "missing_faculty",
  ROOM_CLASH: "room_clash",
  FACULTY_CLASH: "faculty_clash",
  SECTION_CLASH: "section_clash",
  WORKLOAD_EXCEEDED: "workload_exceeded",
  NO_LAB_AVAILABLE: "no_lab_available",
  NO_CONTINUOUS_LAB_BLOCK: "no_continuous_lab_block",
  NO_SUITABLE_ROOM: "no_suitable_room",
  NO_SLOT_AVAILABLE: "no_slot_available",
});

const CONFLICT_REASON_LABELS = Object.freeze({
  [CONFLICT_REASON.MISSING_FACULTY]: "Missing faculty mapping",
  [CONFLICT_REASON.ROOM_CLASH]: "Room clash",
  [CONFLICT_REASON.FACULTY_CLASH]: "Faculty clash",
  [CONFLICT_REASON.SECTION_CLASH]: "Section clash",
  [CONFLICT_REASON.WORKLOAD_EXCEEDED]: "Workload exceeded",
  [CONFLICT_REASON.NO_LAB_AVAILABLE]: "No lab available",
  [CONFLICT_REASON.NO_CONTINUOUS_LAB_BLOCK]: "No continuous lab block available",
  [CONFLICT_REASON.NO_SUITABLE_ROOM]: "No suitable room available",
  [CONFLICT_REASON.NO_SLOT_AVAILABLE]: "No slot available",
});

const ISSUE_LABELS = Object.freeze({
  missing_faculty_mapping: "Missing Faculty Mapping",
  missing_department_assignment: "Missing Department Assignment",
  missing_workload_limit: "Missing Workload Limit",
  invalid_faculty_override: "Invalid Faculty Override",
  missing_working_hours: "Department Working Hours Not Configured",
  working_days_not_configured: "Working Days Not Configured",
  no_classroom_available: "No Classroom Available",
  no_lab_available: "No Lab Available",
  no_sections: "No Sections Configured",
  no_subjects: "No Subjects Configured",
  slot_generation_failed: "Slot Generation Failed",
});

const CONFLICT_SUMMARY_LABELS = Object.freeze({
  missing_faculty_mapping: "Missing Faculty Mapping",
  no_lab_available: "No Lab Available",
  no_continuous_lab_block: "No Continuous Lab Block",
  no_classroom_available: "No Classroom Available",
  room_clash: "Room Clash",
  faculty_clash: "Faculty Clash",
  section_clash: "Section Clash",
  workload_exceeded: "Workload Exceeded",
  no_slot_available: "No Slot Available",
});

function buildPrecheckSummary(statusFlags) {
  return Object.entries(PRECHECK_LABELS).map(([key, label]) => ({
    key,
    label,
    passed: Boolean(statusFlags?.[key]),
  }));
}

function createIssueBuckets() {
  return Object.keys(ISSUE_LABELS).reduce((acc, key) => {
    acc[key] = new Set();
    return acc;
  }, {});
}

function addIssue(issueBuckets, key, item) {
  if (!issueBuckets[key]) return;
  const normalized = String(item || "").trim();
  if (!normalized) return;
  issueBuckets[key].add(normalized);
}

function buildGroupedItems(buckets, labels) {
  return Object.entries(buckets)
    .map(([key, set]) => ({
      key,
      title: labels[key] || key,
      items: [...set].sort((a, b) => a.localeCompare(b)),
    }))
    .filter((group) => group.items.length > 0);
}

function flattenGroupItems(groups) {
  return groups.flatMap((group) => group.items.map((item) => `${group.title}: ${item}`));
}

function hasAnyIssues(buckets) {
  return Object.values(buckets).some((set) => set.size > 0);
}

function createConflictSummaryBuckets() {
  return {
    missing_faculty_mapping: new Set(),
    no_lab_available: new Set(),
    no_continuous_lab_block: new Set(),
    no_classroom_available: new Set(),
    room_clash: new Set(),
    faculty_clash: new Set(),
    section_clash: new Set(),
    workload_exceeded: new Set(),
    no_slot_available: new Set(),
  };
}

function conflictReasonToSummaryKey(reason) {
  if (reason === CONFLICT_REASON.MISSING_FACULTY) return "missing_faculty_mapping";
  if (reason === CONFLICT_REASON.NO_LAB_AVAILABLE) {
    return "no_lab_available";
  }
  if (reason === CONFLICT_REASON.NO_CONTINUOUS_LAB_BLOCK) return "no_continuous_lab_block";
  if (reason === CONFLICT_REASON.NO_SUITABLE_ROOM) return "no_classroom_available";
  if (reason === CONFLICT_REASON.ROOM_CLASH) return "room_clash";
  if (reason === CONFLICT_REASON.FACULTY_CLASH) return "faculty_clash";
  if (reason === CONFLICT_REASON.SECTION_CLASH) return "section_clash";
  if (reason === CONFLICT_REASON.WORKLOAD_EXCEEDED) return "workload_exceeded";
  return "no_slot_available";
}

function pickDominantReason(counters) {
  const ordered = [
    CONFLICT_REASON.WORKLOAD_EXCEEDED,
    CONFLICT_REASON.ROOM_CLASH,
    CONFLICT_REASON.FACULTY_CLASH,
    CONFLICT_REASON.SECTION_CLASH,
  ];

  let selected = CONFLICT_REASON.NO_SLOT_AVAILABLE;
  let maxCount = 0;
  ordered.forEach((reasonKey) => {
    const count = Number(counters[reasonKey] || 0);
    if (count > maxCount) {
      maxCount = count;
      selected = reasonKey;
    }
  });

  return selected;
}

function resolveValidationFailureMessage(groups) {
  const firstGroup = groups[0];
  const firstItem = firstGroup?.items?.[0] || "";

  if (!firstGroup || !firstItem) {
    return "Pre-generation validation failed. Fix missing setup data and retry.";
  }

  if (firstGroup.key === "missing_faculty_mapping") {
    return `Subject '${firstItem}' has no faculty assigned.`;
  }
  if (firstGroup.key === "missing_workload_limit") {
    return `Faculty '${firstItem}' has no workload limit defined.`;
  }
  if (firstGroup.key === "missing_department_assignment") {
    return `Faculty '${firstItem}' has no department assigned.`;
  }
  if (firstGroup.key === "invalid_faculty_override") {
    return `Invalid faculty override: ${firstItem}`;
  }
  if (firstGroup.key === "missing_working_hours") {
    return "Department working hours are not configured.";
  }
  if (firstGroup.key === "working_days_not_configured") {
    return "Configure valid working days in department schedule (Mon-Fri/Mon-Sat/Mon-Sun).";
  }
  if (firstGroup.key === "no_lab_available") {
    return "No lab room is configured for practical sessions.";
  }
  if (firstGroup.key === "no_classroom_available") {
    return "No lecture classroom is configured.";
  }
  if (firstGroup.key === "no_subjects") {
    return "No subjects mapped to this branch for selected semester.";
  }
  if (firstGroup.key === "no_sections") {
    return "No sections mapped to this branch for selected semester.";
  }
  if (firstGroup.key === "slot_generation_failed") {
    return "Time slot generation failed for the configured department schedule.";
  }

  return "Pre-generation validation failed. Fix missing setup data and retry.";
}

function asNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function toSectionSubjectKey(sectionId, subjectId) {
  return `${Number(sectionId)}::${Number(subjectId)}`;
}

async function ensureFacultyDirectoryRowsForSemesterMappings(client, semesterId) {
  const hasFacultyUsersTable = await tableExists(client, "faculty_users");
  const hasFacultyDepartmentsTable = await tableExists(client, "faculty_departments");
  if (!hasFacultyUsersTable || !hasFacultyDepartmentsTable) {
    return;
  }

  const linkedFacultyUsersResult = await client.query(
    `SELECT fu.id AS faculty_user_id,
            fu.faculty_id,
            fu.full_name,
            fu.designation,
            fu.qualification,
            fu.experience_years,
            fu.email,
            fu.mobile_number,
            fu.joining_date,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT fd.department_id), NULL) AS department_ids
     FROM faculty_subjects fs
     JOIN subjects s ON s.id = fs.subject_id
     JOIN faculty_users fu ON fu.id = fs.faculty_user_id
     LEFT JOIN faculty_departments fd ON fd.faculty_user_id = fu.id
     WHERE s.semester_id = $1
       AND fs.faculty_user_id IS NOT NULL
       AND LOWER(fu.role) = 'faculty'
     GROUP BY fu.id, fu.faculty_id, fu.full_name, fu.designation, fu.qualification,
              fu.experience_years, fu.email, fu.mobile_number, fu.joining_date`,
    [semesterId]
  );

  for (const row of linkedFacultyUsersResult.rows) {
    const facultyCode = String(row.faculty_id || "").trim();
    const fullName = String(row.full_name || "").trim();
    const email = String(row.email || "").trim().toLowerCase();
    const mobileNumber = String(row.mobile_number || "").trim();
    const departmentIds = Array.isArray(row.department_ids)
      ? row.department_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
      : [];

    if (!facultyCode || !fullName || !email || !mobileNumber || departmentIds.length === 0) {
      continue;
    }

    const existingResult = await client.query(
      `SELECT id
       FROM faculty
       WHERE LOWER(faculty_id) = LOWER($1)
       LIMIT 1`,
      [facultyCode]
    );
    if (existingResult.rowCount > 0) {
      continue;
    }

    const designation = String(row.designation || "").trim() || "Faculty";
    const qualification = String(row.qualification || "").trim() || "Not Specified";
    const experienceYears = asNonNegativeNumber(row.experience_years, 0);
    const joiningDate = row.joining_date || new Date();
    const departmentId = departmentIds[0];

    try {
      await client.query(
        `INSERT INTO faculty (
           faculty_id, full_name, department_id, designation, qualification,
           experience_years, max_workload_per_week, email, mobile_number, joining_date
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (faculty_id) DO NOTHING`,
        [
          facultyCode,
          fullName,
          departmentId,
          designation,
          qualification,
          experienceYears,
          DEFAULT_MAX_WORKLOAD_PER_WEEK,
          email,
          mobileNumber,
          joiningDate,
        ]
      );
    } catch (insertErr) {
      if (String(insertErr?.code || "") !== "23505") {
        throw insertErr;
      }
      // Legacy datasets may already hold a faculty row with same email/mobile but different code.
      // Resolution by email/mobile is handled in mapping lookup.
    }
  }
}

async function generateTimetableHandler(req, res, next) {
  const client = await pool.connect();
  let pdfFile = null;

  try {
    const { semester_id: semesterId, version_name: versionName } = req.body;
    const generationStrategy = normalizeGenerationStrategy(req.body.generation_strategy);
    const facultyOveruseThreshold = Math.max(
      0,
      asNonNegativeInteger(req.body.faculty_overuse_threshold, DEFAULT_FACULTY_OVERUSE_THRESHOLD)
    );
    const rawFacultyAssignmentOverrides = Array.isArray(req.body.faculty_assignment_overrides)
      ? req.body.faculty_assignment_overrides
      : [];
    const autoRoomExpansion =
      !(req.body.auto_room_expansion === false) &&
      String(req.body.auto_room_expansion || "").trim().toLowerCase() !== "false";
    const reuseSavedFacultyAssignments =
      req.body.reuse_saved_faculty_assignments === true ||
      String(req.body.reuse_saved_faculty_assignments || "").trim().toLowerCase() === "true";
    const simulateOnly =
      req.body.simulation_mode === true || String(req.body.simulation_mode || "").trim().toLowerCase() === "true";

    await client.query("BEGIN");

    const precheckStatus = {
      subjects_found: false,
      faculty_mapped: false,
      labs_available: false,
      working_days_configured: false,
    };
    const issues = createIssueBuckets();

    const semesterMetaResult = await client.query(
      `SELECT sem.id, sem.branch_id, b.department_id
       FROM semesters sem
       JOIN branches b ON b.id = sem.branch_id
       WHERE sem.id = $1`,
      [semesterId]
    );
    if (semesterMetaResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Invalid semester selected",
        precheck_summary: buildPrecheckSummary(precheckStatus),
      });
    }

    const branchId = Number(semesterMetaResult.rows[0].branch_id);
    const departmentId = Number(semesterMetaResult.rows[0].department_id);
    // Run these queries sequentially on the same client while a transaction
    // is active. Running multiple client queries in parallel can cause a
    // transaction to become aborted if one of them fails.
    const departmentScheduleResult = await client.query(
      `SELECT id, department_id, start_time, end_time, slot_duration_minutes, break_duration_minutes,
              break_after_slot_number, working_days
       FROM department_schedule_config
       WHERE department_id = $1
       LIMIT 1`,
      [departmentId]
    );

    const semesterDurationResult = await client.query(
      `SELECT start_date, end_date
       FROM semester_durations
       WHERE semester_id = $1
       LIMIT 1`,
      [semesterId]
    );

    const sectionsResult = await client.query(
      `SELECT s.id, s.section_name, s.student_strength
       FROM sections s
       JOIN branches b ON b.id = s.branch_id
       WHERE s.semester_id = $1
         AND s.branch_id = $2
         AND b.department_id = $3
       ORDER BY s.section_name, s.id`,
      [semesterId, branchId, departmentId]
    );

    const subjectsResult = await client.query(
      `SELECT id, subject_name, subject_type, total_hours, theory_hours, practical_hours, requires_lab
       FROM subjects
       WHERE semester_id = $1
         AND branch_id = $2
         AND department_id = $3
       ORDER BY subject_name, id`,
      [semesterId, branchId, departmentId]
    );

    let autoCreatedRooms = [];
    if (autoRoomExpansion && !simulateOnly) {
      const requiredLectureRooms = Math.max(1, sectionsResult.rowCount);
      const requiredCapacity = Math.max(
        1,
        sectionsResult.rows.reduce(
          (maxValue, section) => Math.max(maxValue, asNonNegativeInteger(section.student_strength, 0)),
          60
        )
      );
      // Use a dedicated auto-commit client so newly created fallback rooms
      // are not rolled back when timetable generation fails.
      const roomClient = await pool.connect();
      try {
        autoCreatedRooms = await ensureAutoLectureRoomsForSections(roomClient, {
          requiredLectureRooms,
          requiredCapacity,
          departmentId,
        });
      } finally {
        roomClient.release();
      }
    }

    const roomsResult = await client.query(
      `SELECT id, room_number, room_type, capacity
       FROM classrooms
       ORDER BY room_number, id`
    );
    const hasSubjectFacultyAssignmentTable = await tableExists(client, "subject_faculty_assignment");

    const configuredWorkingDays =
      departmentScheduleResult.rowCount > 0 ? resolveWorkingDays(departmentScheduleResult.rows[0].working_days) : [];

    if (departmentScheduleResult.rowCount === 0) {
      addIssue(issues, "missing_working_hours", "Configure department schedule first");
    } else if (configuredWorkingDays.length > 0) {
      precheckStatus.working_days_configured = true;
    } else {
      addIssue(
        issues,
        "working_days_not_configured",
        "Set valid working days (Mon-Fri, Mon-Sat, or Mon-Sun)."
      );
    }

    if (sectionsResult.rowCount === 0) {
      addIssue(issues, "no_sections", "No sections mapped to this branch for selected semester");
    }

    if (subjectsResult.rowCount === 0) {
      addIssue(issues, "no_subjects", "No subjects mapped to this branch for selected semester.");
    } else {
      precheckStatus.subjects_found = true;
    }

    const lectureRooms = roomsResult.rows.filter((room) => String(room.room_type || "").toLowerCase() === "lecture");
    const labRooms = roomsResult.rows.filter((room) => String(room.room_type || "").toLowerCase() === "lab");
    const hasTheorySessions = subjectsResult.rows.some((subject) => normalizeSubjectType(subject.subject_type) !== "Practical");
    const hasPracticalSessions = subjectsResult.rows.some((subject) => requiresLabRoom(subject));

    if (hasTheorySessions && !lectureRooms.length) {
      addIssue(issues, "no_classroom_available", "Add at least one classroom with room type 'Lecture'");
    }
    if (hasPracticalSessions && !labRooms.length) {
      addIssue(issues, "no_lab_available", "Add at least one classroom with room type 'Lab'");
    }
    if (!hasPracticalSessions || labRooms.length > 0) {
      precheckStatus.labs_available = true;
    }

    let slots = [];
    if (departmentScheduleResult.rowCount > 0) {
      try {
        // Use a dedicated client for slot generation/upsert so any SQL errors
        // won't pollute the main transaction client.
        const slotClient = await pool.connect();
        try {
          slots = await ensureDepartmentTimeSlots(slotClient, departmentId, departmentScheduleResult.rows[0]);
        } finally {
          slotClient.release();
        }

        if (slots.length > 0) {
          // no-op: slot generation status is reflected through validation issues
        } else if (!issues.slot_generation_failed.size) {
          addIssue(issues, "slot_generation_failed", "No valid slots generated from department schedule");
        }
      } catch (scheduleErr) {
        addIssue(issues, "slot_generation_failed", resolveSlotGenerationErrorMessage(scheduleErr));
      }
    }

    // Populate faculty directory using a dedicated client so any errors do
    // not affect the main transaction client.
    const facultyClient = await pool.connect();
    try {
      await ensureFacultyDirectoryRowsForSemesterMappings(facultyClient, semesterId);
    } finally {
      facultyClient.release();
    }

    const facultyUserMappingEnabled = await tableHasColumn(client, "faculty_subjects", "faculty_user_id");
    const hasFacultyUsersTable = facultyUserMappingEnabled ? await tableExists(client, "faculty_users") : false;

    const mappingResult = await client.query(
      facultyUserMappingEnabled && hasFacultyUsersTable
        ? `SELECT fs.subject_id,
                  s.subject_name,
                  fs.faculty_id AS mapped_faculty_id,
                  fs.faculty_user_id AS mapped_faculty_user_id,
                  fu.faculty_id AS faculty_user_code,
                  COALESCE(f_direct.id, f_by_code.id, f_by_email.id, f_by_mobile.id) AS resolved_faculty_id,
                  COALESCE(f_direct.full_name, f_by_code.full_name, f_by_email.full_name, f_by_mobile.full_name, fu.full_name) AS faculty_name,
                  COALESCE(f_direct.max_workload_per_week, f_by_code.max_workload_per_week, f_by_email.max_workload_per_week, f_by_mobile.max_workload_per_week) AS max_workload_per_week,
                  COALESCE(f_direct.department_id, f_by_code.department_id, f_by_email.department_id, f_by_mobile.department_id) AS faculty_department_id
           FROM faculty_subjects fs
           JOIN subjects s ON s.id = fs.subject_id
           LEFT JOIN faculty f_direct ON f_direct.id = fs.faculty_id
           LEFT JOIN faculty_users fu ON fu.id = fs.faculty_user_id
           LEFT JOIN faculty f_by_code
             ON fu.faculty_id IS NOT NULL
            AND LOWER(f_by_code.faculty_id) = LOWER(fu.faculty_id)
           LEFT JOIN faculty f_by_email
             ON fu.email IS NOT NULL
            AND LOWER(f_by_email.email) = LOWER(fu.email)
           LEFT JOIN faculty f_by_mobile
             ON fu.mobile_number IS NOT NULL
            AND f_by_mobile.mobile_number = fu.mobile_number
           WHERE s.semester_id = $1
             AND s.branch_id = $2
             AND s.department_id = $3`
        : `SELECT fs.subject_id,
                  s.subject_name,
                  fs.faculty_id AS mapped_faculty_id,
                  NULL::int AS mapped_faculty_user_id,
                  NULL::text AS faculty_user_code,
                  f.id AS resolved_faculty_id,
                  f.full_name AS faculty_name,
                  f.max_workload_per_week,
                  f.department_id AS faculty_department_id
            FROM faculty_subjects fs
            JOIN subjects s ON s.id = fs.subject_id
            LEFT JOIN faculty f ON f.id = fs.faculty_id
           WHERE s.semester_id = $1
             AND s.branch_id = $2
             AND s.department_id = $3`,
      [semesterId, branchId, departmentId]
    );

    const totalWeeks = calculateTotalWeeks(semesterDurationResult.rows[0]);
    const slotDurationMinutes = asNonNegativeInteger(
      departmentScheduleResult.rows[0]?.slot_duration_minutes,
      DEFAULT_SLOT_DURATION_MINUTES
    );
    const labBlockMinutes = DEFAULT_LAB_BLOCK_MINUTES;
    const practicalSlotsPerBlock = LAB_SESSION_SLOT_SPAN;
    const schedulingParamsResult = await client.query(
      `SELECT max_classes_per_day
       FROM scheduling_parameters
       ORDER BY id DESC
       LIMIT 1`
    );
    const facultyMaxClassesPerDay = Math.max(
      1,
      asNonNegativeInteger(schedulingParamsResult.rows[0]?.max_classes_per_day, DEFAULT_MAX_CLASSES_PER_DAY)
    );

    const sectionById = new Map(sectionsResult.rows.map((section) => [Number(section.id), section]));
    const subjectById = new Map(subjectsResult.rows.map((subject) => [Number(subject.id), subject]));
    const subjectFacultyMap = new Map();
    const facultyWorkloadMap = new Map();
    const initialFacultyAssignmentMap = new Map();

    mappingResult.rows.forEach((row) => {
      const subjectId = Number(row.subject_id);
      if (!subjectById.has(subjectId)) return;
      if (!subjectFacultyMap.has(subjectId)) {
        subjectFacultyMap.set(subjectId, []);
      }

      const resolvedFacultyId = Number(row.resolved_faculty_id || 0);
      const facultyName = String(row.faculty_name || row.faculty_user_code || `Faculty#${row.mapped_faculty_user_id || "?"}`).trim();
      const workloadLimit = asNonNegativeInteger(row.max_workload_per_week, 0);
      const facultyDepartmentId = asNonNegativeInteger(row.faculty_department_id, 0);

      if (!resolvedFacultyId) {
        addIssue(issues, "missing_faculty_mapping", String(row.subject_name || `Subject#${subjectId}`));
        return;
      }

      if (!facultyDepartmentId) {
        addIssue(issues, "missing_department_assignment", facultyName);
      }
      if (workloadLimit <= 0) {
        addIssue(issues, "missing_workload_limit", facultyName);
      }
      if (!facultyDepartmentId || workloadLimit <= 0) {
        return;
      }

      const subjectFacultyList = subjectFacultyMap.get(subjectId);
      if (!subjectFacultyList.some((item) => item.faculty_id === resolvedFacultyId)) {
        subjectFacultyList.push({
          faculty_id: resolvedFacultyId,
          faculty_name: facultyName,
        });
      }

      if (!facultyWorkloadMap.has(resolvedFacultyId)) {
        facultyWorkloadMap.set(resolvedFacultyId, {
          max: workloadLimit,
          assigned: 0,
          name: facultyName,
        });
      }
    });

    subjectsResult.rows.forEach((subject) => {
      const subjectId = Number(subject.id);
      const candidates = subjectFacultyMap.get(subjectId) || [];
      if (candidates.length === 0) {
        addIssue(issues, "missing_faculty_mapping", subject.subject_name);
      }
    });

    const estimatedDemandUnitsBySectionSubject = new Map();
    sectionsResult.rows.forEach((section) => {
      subjectsResult.rows.forEach((subject) => {
        const sectionId = Number(section.id);
        const subjectId = Number(subject.id);
        const demands = getSessionDemands(subject, totalWeeks, slotDurationMinutes, labBlockMinutes);
        const demandUnits = demands.reduce((accumulator, demand) => {
          const demandCount = Math.max(0, asNonNegativeInteger(demand.count, 0));
          const unitSize = demand.mode === "Practical" ? practicalSlotsPerBlock : 1;
          return accumulator + demandCount * unitSize;
        }, 0);
        estimatedDemandUnitsBySectionSubject.set(
          toSectionSubjectKey(sectionId, subjectId),
          Math.max(1, demandUnits)
        );
      });
    });

    const sectionIdsInScope = sectionsResult.rows
      .map((section) => Number(section.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const subjectIdsInScope = subjectsResult.rows
      .map((subject) => Number(subject.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (
      reuseSavedFacultyAssignments &&
      hasSubjectFacultyAssignmentTable &&
      sectionIdsInScope.length > 0 &&
      subjectIdsInScope.length > 0
    ) {
      const persistedAssignmentsResult = await client.query(
        `SELECT section_id, subject_id, faculty_id
         FROM subject_faculty_assignment
         WHERE section_id = ANY($1::int[])
           AND subject_id = ANY($2::int[])`,
        [sectionIdsInScope, subjectIdsInScope]
      );

      persistedAssignmentsResult.rows.forEach((row) => {
        const sectionId = Number(row.section_id);
        const subjectId = Number(row.subject_id);
        const facultyId = Number(row.faculty_id);
        const key = toSectionSubjectKey(sectionId, subjectId);
        const candidates = subjectFacultyMap.get(subjectId) || [];
        const isCandidate = candidates.some((candidate) => Number(candidate.faculty_id) === facultyId);
        if (!isCandidate) return;
        if (!facultyWorkloadMap.has(facultyId)) return;
        initialFacultyAssignmentMap.set(key, facultyId);
      });
    }

    function rankFacultyCandidatesForPreassignment(candidates, facultyUsageMap) {
      return [...candidates].sort((a, b) => {
        const aUsage = Number(facultyUsageMap.get(Number(a.faculty_id)) || 0);
        const bUsage = Number(facultyUsageMap.get(Number(b.faculty_id)) || 0);
        const aWorkload = facultyWorkloadMap.get(Number(a.faculty_id)) || { max: 0 };
        const bWorkload = facultyWorkloadMap.get(Number(b.faculty_id)) || { max: 0 };
        const aRatio = aWorkload.max > 0 ? aUsage / aWorkload.max : Number.POSITIVE_INFINITY;
        const bRatio = bWorkload.max > 0 ? bUsage / bWorkload.max : Number.POSITIVE_INFINITY;

        if (aRatio !== bRatio) return aRatio - bRatio;
        if (aUsage !== bUsage) return aUsage - bUsage;
        return String(a.faculty_name || "").localeCompare(String(b.faculty_name || ""));
      });
    }

    const preassignmentUsageMap = new Map();
    initialFacultyAssignmentMap.forEach((facultyId, assignmentKey) => {
      const normalizedFacultyId = Number(facultyId);
      const demandUnits = Number(estimatedDemandUnitsBySectionSubject.get(assignmentKey) || 1);
      preassignmentUsageMap.set(
        normalizedFacultyId,
        (preassignmentUsageMap.get(normalizedFacultyId) || 0) + Math.max(1, demandUnits)
      );
    });

    if (rawFacultyAssignmentOverrides.length > 0) {
      rawFacultyAssignmentOverrides.forEach((override, index) => {
        const itemLabel = `item #${index + 1}`;
        const sectionId = Number(override?.section_id);
        const subjectId = Number(override?.subject_id);
        const facultyId = Number(override?.faculty_id);

        if (
          !Number.isInteger(sectionId) ||
          sectionId <= 0 ||
          !Number.isInteger(subjectId) ||
          subjectId <= 0 ||
          !Number.isInteger(facultyId) ||
          facultyId <= 0
        ) {
          addIssue(issues, "invalid_faculty_override", `${itemLabel} must include valid section_id, subject_id, and faculty_id`);
          return;
        }

        const section = sectionById.get(sectionId);
        if (!section) {
          addIssue(issues, "invalid_faculty_override", `${itemLabel} references section_id=${sectionId} which is outside this timetable scope`);
          return;
        }

        const subject = subjectById.get(subjectId);
        if (!subject) {
          addIssue(issues, "invalid_faculty_override", `${itemLabel} references subject_id=${subjectId} which is outside this timetable scope`);
          return;
        }

        const subjectFacultyCandidates = subjectFacultyMap.get(subjectId) || [];
        const matchedFaculty = subjectFacultyCandidates.find((candidate) => Number(candidate.faculty_id) === facultyId);
        if (!matchedFaculty) {
          addIssue(
            issues,
            "invalid_faculty_override",
            `${section.section_name} - ${subject.subject_name}: faculty_id=${facultyId} is not mapped to this subject`
          );
          return;
        }

        if (!facultyWorkloadMap.has(facultyId)) {
          addIssue(
            issues,
            "invalid_faculty_override",
            `${section.section_name} - ${subject.subject_name}: faculty_id=${facultyId} has invalid workload/department setup`
          );
          return;
        }

        const assignmentKey = toSectionSubjectKey(sectionId, subjectId);
        const demandUnits = Number(estimatedDemandUnitsBySectionSubject.get(assignmentKey) || 1);
        const previousFacultyId = Number(initialFacultyAssignmentMap.get(assignmentKey) || 0);
        if (previousFacultyId > 0) {
          const previousCount = Number(preassignmentUsageMap.get(previousFacultyId) || 0);
          if (previousCount > demandUnits) {
            preassignmentUsageMap.set(previousFacultyId, previousCount - demandUnits);
          } else {
            preassignmentUsageMap.delete(previousFacultyId);
          }
        }

        preassignmentUsageMap.set(facultyId, (preassignmentUsageMap.get(facultyId) || 0) + Math.max(1, demandUnits));
        initialFacultyAssignmentMap.set(toSectionSubjectKey(sectionId, subjectId), matchedFaculty.faculty_id);
      });
    }

    const sectionRowsOrdered = [...sectionsResult.rows].sort((a, b) => {
      const byName = String(a.section_name || "").localeCompare(String(b.section_name || ""));
      if (byName !== 0) return byName;
      return Number(a.id) - Number(b.id);
    });
    const subjectRowsOrdered = [...subjectsResult.rows].sort((a, b) => {
      const byName = String(a.subject_name || "").localeCompare(String(b.subject_name || ""));
      if (byName !== 0) return byName;
      return Number(a.id) - Number(b.id);
    });
    const subjectFacultySectionUsageMap = new Map();
    initialFacultyAssignmentMap.forEach((facultyIdRaw, assignmentKey) => {
      const [, subjectIdText] = String(assignmentKey).split("::");
      const subjectId = Number(subjectIdText);
      const facultyId = Number(facultyIdRaw);
      if (!Number.isInteger(subjectId) || !Number.isInteger(facultyId)) return;
      const usageKey = `${subjectId}-${facultyId}`;
      subjectFacultySectionUsageMap.set(usageKey, (subjectFacultySectionUsageMap.get(usageKey) || 0) + 1);
    });

    function getSubjectFacultySectionUsage(subjectId, facultyId) {
      return Number(subjectFacultySectionUsageMap.get(`${subjectId}-${facultyId}`) || 0);
    }

    function incrementSubjectFacultySectionUsage(subjectId, facultyId) {
      const usageKey = `${subjectId}-${facultyId}`;
      subjectFacultySectionUsageMap.set(usageKey, getSubjectFacultySectionUsage(subjectId, facultyId) + 1);
    }

    function getAverageGlobalProjectedLoad() {
      if (facultyWorkloadMap.size === 0) return 0;
      let total = 0;
      facultyWorkloadMap.forEach((_, facultyId) => {
        total += Number(preassignmentUsageMap.get(Number(facultyId)) || 0);
      });
      return total / facultyWorkloadMap.size;
    }

    // Build complete section-subject -> faculty map using subject-wise round-robin
    // so one faculty doesn't capture all sections for the same subject.
    subjectRowsOrdered.forEach((subject, subjectIndex) => {
      const subjectId = Number(subject.id);
      const candidates = subjectFacultyMap.get(subjectId) || [];
      if (candidates.length === 0) {
        return;
      }

      const baselineCandidates = rankFacultyCandidatesForPreassignment(candidates, preassignmentUsageMap);
      if (baselineCandidates.length === 0) {
        return;
      }

      const baseRotationOffset = baselineCandidates.length > 0 ? subjectIndex % baselineCandidates.length : 0;
      sectionRowsOrdered.forEach((section, sectionIndex) => {
        const sectionId = Number(section.id);
        const assignmentKey = toSectionSubjectKey(sectionId, subjectId);
        if (initialFacultyAssignmentMap.has(assignmentKey)) {
          return;
        }

        const rotatedCandidates = [];
        for (let rotationIndex = 0; rotationIndex < baselineCandidates.length; rotationIndex += 1) {
          const candidateIndex = (baseRotationOffset + sectionIndex + rotationIndex) % baselineCandidates.length;
          rotatedCandidates.push(baselineCandidates[candidateIndex]);
        }

        const subjectTotalAssigned = rotatedCandidates.reduce(
          (accumulator, candidate) => accumulator + getSubjectFacultySectionUsage(subjectId, Number(candidate.faculty_id)),
          0
        );
        const subjectAverageAssigned = rotatedCandidates.length > 0 ? subjectTotalAssigned / rotatedCandidates.length : 0;
        const globalAverageProjectedLoad = getAverageGlobalProjectedLoad();

        let selectedFaculty = null;
        let selectedScore = Number.POSITIVE_INFINITY;
        rotatedCandidates.forEach((candidate, rotationRank) => {
          const facultyId = Number(candidate.faculty_id);
          const subjectSectionUsage = getSubjectFacultySectionUsage(subjectId, facultyId);
          const globalProjectedLoad = Number(preassignmentUsageMap.get(facultyId) || 0);
          const workload = facultyWorkloadMap.get(facultyId) || { max: 0 };
          const loadRatio = workload.max > 0 ? globalProjectedLoad / workload.max : Number.POSITIVE_INFINITY;
          const exceedsSubjectSkew = subjectSectionUsage > subjectAverageAssigned + 1;
          const exceedsGlobalSkew = globalProjectedLoad > globalAverageProjectedLoad + facultyOveruseThreshold;
          const skewPenalty = (exceedsSubjectSkew ? 5000 : 0) + (exceedsGlobalSkew ? 1000 : 0);
          const score = skewPenalty + subjectSectionUsage * 100 + loadRatio * 25 + globalProjectedLoad + rotationRank * 0.1;
          if (score < selectedScore) {
            selectedScore = score;
            selectedFaculty = candidate;
          }
        });

        if (!selectedFaculty) {
          return;
        }

        const selectedFacultyId = Number(selectedFaculty.faculty_id);
        const demandUnits = Number(estimatedDemandUnitsBySectionSubject.get(assignmentKey) || 1);
        initialFacultyAssignmentMap.set(assignmentKey, selectedFacultyId);
        preassignmentUsageMap.set(
          selectedFacultyId,
          (preassignmentUsageMap.get(selectedFacultyId) || 0) + Math.max(1, demandUnits)
        );
        incrementSubjectFacultySectionUsage(subjectId, selectedFacultyId);
      });
    });

    if (
      subjectsResult.rowCount > 0 &&
      issues.missing_faculty_mapping.size === 0 &&
      issues.missing_department_assignment.size === 0 &&
      issues.missing_workload_limit.size === 0 &&
      issues.invalid_faculty_override.size === 0
    ) {
      precheckStatus.faculty_mapped = true;
    }

    if (hasAnyIssues(issues)) {
      const validationGroups = buildGroupedItems(issues, ISSUE_LABELS);
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: resolveValidationFailureMessage(validationGroups),
        precheck_summary: buildPrecheckSummary(precheckStatus),
        validation_groups: validationGroups,
        errors: flattenGroupItems(validationGroups),
      });
    }

    const hasSessionModeColumn = await tableHasColumn(client, "timetable_entries", "session_mode");
    const hasDayColumn = await tableHasColumn(client, "timetable_entries", "day");
    const hasDayOfWeekColumn = hasDayColumn ? false : await tableHasColumn(client, "timetable_entries", "day_of_week");
    const hasSlotNumberColumn = await tableHasColumn(client, "timetable_entries", "slot_number");

    const timetableResult = await client.query(
      `INSERT INTO timetables (version_name, semester_id, generated_by, status)
       VALUES ($1, $2, $3, 'Draft')
       RETURNING id, created_at`,
      [versionName, semesterId, req.user.userId]
    );

    const timetableId = timetableResult.rows[0].id;
    const createdAt = timetableResult.rows[0].created_at;
    const conflicts = [];
    const conflictSummaryBuckets = createConflictSummaryBuckets();
    const slotDurationById = new Map(
      slots.map((slot) => {
        const startMinutes = toTimeMinutes(slot.start_time);
        const endMinutes = toTimeMinutes(slot.end_time);
        const slotMinutes =
          startMinutes === null || endMinutes === null ? slotDurationMinutes : Math.max(1, endMinutes - startMinutes);
        return [Number(slot.id), slotMinutes];
      })
    );
    const roomTypeById = new Map(roomsResult.rows.map((room) => [Number(room.id), String(room.room_type || "").toLowerCase()]));
    const roomNumberById = new Map(roomsResult.rows.map((room) => [Number(room.id), String(room.room_number || "").trim()]));
    const slotsByDay = new Map();
    slots.forEach((slot) => {
      const day = Number(slot.day_of_week);
      if (!slotsByDay.has(day)) {
        slotsByDay.set(day, []);
      }
      slotsByDay.get(day).push(slot);
    });
    slotsByDay.forEach((daySlots) => {
      daySlots.sort((a, b) =>
        Number(a.slot_number) === Number(b.slot_number)
          ? Number(a.id) - Number(b.id)
          : Number(a.slot_number) - Number(b.slot_number)
      );
    });
    const workingDaySequence = [...slotsByDay.keys()].sort((a, b) => a - b);

    function orderedDaysForPreferredDay(preferredDay, options = {}) {
      const preferred = Number(preferredDay);
      const usePreferred = !options.ignorePreferredDay && Number.isInteger(preferred) && slotsByDay.has(preferred);
      const ordered = usePreferred ? [preferred] : [];
      for (const day of workingDaySequence) {
        if (usePreferred && day === preferred) continue;
        ordered.push(day);
      }
      if (options.reverseDayOrder) {
        ordered.reverse();
      }
      return ordered;
    }

    function buildTheorySlotCandidates(preferredDay, options = {}) {
      const candidates = [];
      for (const day of orderedDaysForPreferredDay(preferredDay, options)) {
        const daySlots = slotsByDay.get(day) || [];
        const orderedSlots = options.reverseSlotOrder ? [...daySlots].reverse() : daySlots;
        orderedSlots.forEach((slot) => candidates.push([slot]));
      }
      return candidates;
    }

    function isContinuousSlotPair(firstSlot, secondSlot) {
      if (Number(firstSlot.day_of_week) !== Number(secondSlot.day_of_week)) return false;
      if (Number(secondSlot.slot_number) !== Number(firstSlot.slot_number) + 1) return false;

      const firstEndMinutes = toTimeMinutes(firstSlot.end_time);
      const secondStartMinutes = toTimeMinutes(secondSlot.start_time);
      if (firstEndMinutes === null || secondStartMinutes === null) return false;
      return firstEndMinutes === secondStartMinutes;
    }

    function buildPracticalBlockCandidates(preferredDay, options = {}) {
      const candidates = [];
      for (const day of orderedDaysForPreferredDay(preferredDay, options)) {
        const daySlots = slotsByDay.get(day) || [];
        if (daySlots.length < practicalSlotsPerBlock) continue;

        const startIndexes = [];
        for (let index = 0; index <= daySlots.length - practicalSlotsPerBlock; index += 1) {
          startIndexes.push(index);
        }
        if (options.reverseSlotOrder) {
          startIndexes.reverse();
        }

        for (const startIndex of startIndexes) {
          const block = daySlots.slice(startIndex, startIndex + practicalSlotsPerBlock);
          const hasStandardDuration = block.every(
            (slot) => (slotDurationById.get(Number(slot.id)) || 0) >= Math.max(1, slotDurationMinutes)
          );
          if (!hasStandardDuration) continue;

          let continuous = true;
          for (let index = 0; index < block.length - 1; index += 1) {
            if (!isContinuousSlotPair(block[index], block[index + 1])) {
              continuous = false;
              break;
            }
          }
          if (!continuous) continue;

          const totalMinutes = block.reduce(
            (accumulator, slot) => accumulator + (slotDurationById.get(Number(slot.id)) || 0),
            0
          );
          if (totalMinutes < labBlockMinutes) continue;

          candidates.push(block);
        }
      }
      return candidates;
    }

    function isRoomCompatibleWithMode(roomId, mode) {
      const roomType = roomTypeById.get(Number(roomId));
      if (mode === "Practical") return roomType === "lab";
      return roomType === "lecture";
    }

    function roomCandidatesFor(mode, studentStrength, options = {}) {
      const requiredStrength = Number(studentStrength || 0);
      let candidates;
      if (mode === "Practical") {
        candidates = labRooms.filter((room) => Number(room.capacity || 0) >= requiredStrength);
      } else {
        const lectureCapacityMatched = lectureRooms.filter((room) => Number(room.capacity || 0) >= requiredStrength);
        candidates = lectureCapacityMatched.length > 0 ? lectureCapacityMatched : lectureRooms;
      }

      if (options.reverseRoomOrder) {
        return [...candidates].reverse();
      }
      return candidates;
    }

    function createFacultyLoadState() {
      const cloned = new Map();
      facultyWorkloadMap.forEach((value, key) => {
        cloned.set(key, { ...value, assigned: 0 });
      });
      return cloned;
    }

    function getAverageFacultyAssignedLoad(facultyLoadState) {
      if (!facultyLoadState || facultyLoadState.size === 0) return 0;
      let total = 0;
      facultyLoadState.forEach((load) => {
        total += Number(load?.assigned || 0);
      });
      return total / facultyLoadState.size;
    }

    function rankFacultyCandidates(candidates, facultyLoadState, options = {}) {
      const threshold = Math.max(0, asNonNegativeInteger(options.overuseThreshold, facultyOveruseThreshold));
      const averageAssignedLoad = getAverageFacultyAssignedLoad(facultyLoadState);
      const overuseLimit = averageAssignedLoad + threshold;
      const ignoreOveruseThreshold = Boolean(options.ignoreOveruseThreshold);
      const ranked = [...candidates].sort((a, b) => {
        const aLoad = facultyLoadState.get(a.faculty_id) || { max: 0, assigned: 0 };
        const bLoad = facultyLoadState.get(b.faculty_id) || { max: 0, assigned: 0 };
        const aProjected = Number(aLoad.assigned || 0) + 1;
        const bProjected = Number(bLoad.assigned || 0) + 1;
        const aOverused = !ignoreOveruseThreshold && aProjected > overuseLimit;
        const bOverused = !ignoreOveruseThreshold && bProjected > overuseLimit;
        if (aOverused !== bOverused) return aOverused ? 1 : -1;

        const aRatio = aLoad.max > 0 ? aLoad.assigned / aLoad.max : Number.POSITIVE_INFINITY;
        const bRatio = bLoad.max > 0 ? bLoad.assigned / bLoad.max : Number.POSITIVE_INFINITY;

        if (aRatio !== bRatio) return aRatio - bRatio;
        if (aLoad.assigned !== bLoad.assigned) return aLoad.assigned - bLoad.assigned;
        return String(a.faculty_name || "").localeCompare(String(b.faculty_name || ""));
      });
      if (options.reverseFacultyOrder) {
        ranked.reverse();
      }
      return ranked;
    }

    const requestedCountBySectionSubjectMode = new Map();
    const subjectRemainingMap = new Map();

    function tryAssignRequest(request, options, schedulingState) {
      const { section, subject, mode, preferred_day: preferredDay } = request;
      const assignmentKey = toSectionSubjectKey(section.id, subject.id);
      const subjectFacultyCandidates = subjectFacultyMap.get(subject.id) || [];
      const preAssignedFacultyId = schedulingState.facultyAssignmentMap.get(assignmentKey);
      const alreadyAssignedForPair = Number(schedulingState.sectionSubjectAssignedCount.get(assignmentKey) || 0);
      const canRelaxFacultyForPair = alreadyAssignedForPair === 0;
      const allowSecondaryFacultyFallback = Boolean(options.allowSecondaryFacultyFallback) && canRelaxFacultyForPair;
      const allowAnyFacultyFallback = Boolean(options.allowAnyFacultyFallback) && canRelaxFacultyForPair;
      let facultyCandidates = subjectFacultyCandidates;
      if (preAssignedFacultyId) {
        const preferredFacultyCandidates = subjectFacultyCandidates.filter(
          (candidate) => Number(candidate.faculty_id) === Number(preAssignedFacultyId)
        );
        if (allowSecondaryFacultyFallback) {
          const secondaryFacultyCandidates = subjectFacultyCandidates.filter(
            (candidate) => Number(candidate.faculty_id) !== Number(preAssignedFacultyId)
          );
          facultyCandidates = [...preferredFacultyCandidates, ...secondaryFacultyCandidates];
        } else {
          facultyCandidates = preferredFacultyCandidates;
        }
      }
      if (allowAnyFacultyFallback) {
        const candidateIds = new Set(facultyCandidates.map((candidate) => Number(candidate.faculty_id)));
        const fallbackFaculty = [...schedulingState.facultyLoadState.entries()].map(([facultyId, load]) => ({
          faculty_id: Number(facultyId),
          faculty_name: String(load?.name || `Faculty#${facultyId}`),
        }));
        fallbackFaculty.forEach((candidate) => {
          if (candidateIds.has(Number(candidate.faculty_id))) return;
          facultyCandidates.push(candidate);
        });
      }
      const rooms = roomCandidatesFor(mode, section.student_strength, options);
      const counters = {
        [CONFLICT_REASON.SECTION_CLASH]: 0,
        [CONFLICT_REASON.FACULTY_CLASH]: 0,
        [CONFLICT_REASON.ROOM_CLASH]: 0,
        [CONFLICT_REASON.WORKLOAD_EXCEEDED]: 0,
      };

      if (facultyCandidates.length === 0) {
        return { success: false, reason: CONFLICT_REASON.MISSING_FACULTY };
      }
      if (rooms.length === 0) {
        return {
          success: false,
          reason: mode === "Practical" ? CONFLICT_REASON.NO_LAB_AVAILABLE : CONFLICT_REASON.NO_SUITABLE_ROOM,
        };
      }

      const hasExactSlotGroup = Array.isArray(options.exactSlotGroup) && options.exactSlotGroup.length > 0;
      const slotGroups = hasExactSlotGroup
        ? [options.exactSlotGroup]
        : mode === "Practical"
          ? buildPracticalBlockCandidates(preferredDay, options)
          : buildTheorySlotCandidates(preferredDay, options);
      if (mode === "Practical" && slotGroups.length === 0) {
        return { success: false, reason: CONFLICT_REASON.NO_CONTINUOUS_LAB_BLOCK };
      }

      for (const slotGroup of slotGroups) {
        const sectionBusy = slotGroup.some((slot) => schedulingState.sectionSlotUsed.has(`${section.id}-${slot.id}`));
        if (sectionBusy) {
          counters[CONFLICT_REASON.SECTION_CLASH] += 1;
          continue;
        }

        const rankedFaculty = rankFacultyCandidates(facultyCandidates, schedulingState.facultyLoadState, {
          ...options,
          overuseThreshold: facultyOveruseThreshold,
        });
        const averageAssignedLoad = getAverageFacultyAssignedLoad(schedulingState.facultyLoadState);
        const overuseLimit = averageAssignedLoad + facultyOveruseThreshold;
        for (const faculty of rankedFaculty) {
          const facultyId = faculty.faculty_id;
          const load = schedulingState.facultyLoadState.get(facultyId);
          if (!load) {
            counters[CONFLICT_REASON.WORKLOAD_EXCEEDED] += 1;
            continue;
          }
          if (!options.ignoreWeeklyFacultyLimit && load.assigned + slotGroup.length > load.max) {
            counters[CONFLICT_REASON.WORKLOAD_EXCEEDED] += 1;
            continue;
          }

          const projectedLoad = Number(load.assigned || 0) + slotGroup.length;
          if (!options.ignoreOveruseThreshold && projectedLoad > overuseLimit) {
            const hasAlternativeWithinThreshold = rankedFaculty.some((candidate) => {
              const candidateId = Number(candidate.faculty_id);
              if (candidateId === Number(facultyId)) return false;
              const candidateLoad = schedulingState.facultyLoadState.get(candidateId);
              if (!candidateLoad) return false;
              if (
                !options.ignoreWeeklyFacultyLimit &&
                Number(candidateLoad.assigned || 0) + slotGroup.length > Number(candidateLoad.max || 0)
              ) {
                return false;
              }
              return Number(candidateLoad.assigned || 0) + slotGroup.length <= overuseLimit;
            });
            if (hasAlternativeWithinThreshold) {
              counters[CONFLICT_REASON.WORKLOAD_EXCEEDED] += 1;
              continue;
            }
          }

          const exceedsDailyClassLimit = slotGroup.some((slot) => {
            const dayKey = `${facultyId}-${slot.day_of_week}`;
            const dayLoad = Number(schedulingState.facultyDayLoadUsed.get(dayKey) || 0);
            return dayLoad + 1 > facultyMaxClassesPerDay;
          });
          if (!options.ignoreDailyFacultyLimit && exceedsDailyClassLimit) {
            counters[CONFLICT_REASON.WORKLOAD_EXCEEDED] += 1;
            continue;
          }

          const facultyBusy = slotGroup.some((slot) => schedulingState.facultySlotUsed.has(`${facultyId}-${slot.id}`));
          if (facultyBusy) {
            counters[CONFLICT_REASON.FACULTY_CLASH] += 1;
            continue;
          }

          for (const room of rooms) {
            if (!isRoomCompatibleWithMode(room.id, mode)) {
              continue;
            }

            const roomBusy = slotGroup.some((slot) => schedulingState.roomSlotUsed.has(`${room.id}-${slot.id}`));
            if (roomBusy) {
              counters[CONFLICT_REASON.ROOM_CLASH] += 1;
              continue;
            }

            slotGroup.forEach((slot) => {
              schedulingState.sectionSlotUsed.add(`${section.id}-${slot.id}`);
              schedulingState.facultySlotUsed.add(`${facultyId}-${slot.id}`);
              schedulingState.roomSlotUsed.add(`${room.id}-${slot.id}`);
              const dayKey = `${facultyId}-${slot.day_of_week}`;
              schedulingState.facultyDayLoadUsed.set(dayKey, (schedulingState.facultyDayLoadUsed.get(dayKey) || 0) + 1);
            });
            load.assigned += slotGroup.length;
            schedulingState.facultyAssignmentMap.set(assignmentKey, facultyId);

            schedulingState.entries.push(
              ...slotGroup.map((slot) => ({
                timetable_id: timetableId,
                section_id: section.id,
                subject_id: subject.id,
                faculty_id: facultyId,
                classroom_id: room.id,
                timeslot_id: slot.id,
                session_mode: mode,
                day_of_week: slot.day_of_week,
                slot_number: slot.slot_number,
                slot_minutes: slotDurationById.get(Number(slot.id)) || slotDurationMinutes,
              }))
            );
            schedulingState.assignedRequestCountByKey.set(
              request.request_key,
              (schedulingState.assignedRequestCountByKey.get(request.request_key) || 0) + 1
            );
            if (schedulingState.subjectRemainingMap.has(request.request_key)) {
              schedulingState.subjectRemainingMap.set(
                request.request_key,
                Math.max(0, Number(schedulingState.subjectRemainingMap.get(request.request_key) || 0) - 1)
              );
            }
            schedulingState.sectionSubjectAssignedCount.set(assignmentKey, alreadyAssignedForPair + 1);
            const sectionId = Number(section.id);
            schedulingState.sectionAssignedCount.set(
              sectionId,
              (schedulingState.sectionAssignedCount.get(sectionId) || 0) + 1
            );
            return { success: true };
          }
        }
      }

      return { success: false, reason: pickDominantReason(counters) };
    }

    const sessionRequests = [];
    const makeRequestKey = (sectionId, subjectId, mode) => `${sectionId}::${subjectId}::${mode}`;
    for (const section of sectionsResult.rows) {
      for (const subject of subjectsResult.rows) {
        const demands = getSessionDemands(subject, totalWeeks, slotDurationMinutes, labBlockMinutes);
        for (const demand of demands) {
          const demandCount = Math.max(0, asNonNegativeInteger(demand.count, 0));
          const dayOffsetBase = workingDaySequence.length
            ? (Number(section.id) * 31 + Number(subject.id) * 17 + (demand.mode === "Practical" ? 7 : 3)) %
              workingDaySequence.length
            : 0;
          for (let i = 0; i < demandCount; i += 1) {
            const preferredDay = workingDaySequence.length
              ? workingDaySequence[(dayOffsetBase + i) % workingDaySequence.length]
              : null;
            sessionRequests.push({
              section,
              subject,
              mode: demand.mode,
              requested_per_week: demandCount,
              preferred_day: preferredDay,
              request_key: makeRequestKey(section.id, subject.id, demand.mode),
              request_id: `${section.id}:${subject.id}:${demand.mode}:${i + 1}`,
            });
          }
        }
      }
    }

    sessionRequests.forEach((request) => {
      const key = request.request_key;
      requestedCountBySectionSubjectMode.set(key, (requestedCountBySectionSubjectMode.get(key) || 0) + 1);
    });
    requestedCountBySectionSubjectMode.forEach((requiredCount, key) => {
      subjectRemainingMap.set(key, Number(requiredCount));
    });

    const requiredRequestCountBySection = new Map();
    sessionRequests.forEach((request) => {
      const sectionId = Number(request.section.id);
      requiredRequestCountBySection.set(sectionId, (requiredRequestCountBySection.get(sectionId) || 0) + 1);
    });

    function getSectionCoverageState(sectionId, schedulingState) {
      const required = Number(requiredRequestCountBySection.get(Number(sectionId)) || 0);
      const assigned = Number(schedulingState?.sectionAssignedCount?.get(Number(sectionId)) || 0);
      const missing = Math.max(0, required - assigned);
      const ratio = required > 0 ? assigned / required : 1;
      return { required, assigned, missing, ratio };
    }

    function interleaveRequestsBySection(requests, schedulingState, options = {}) {
      const bySection = new Map();
      requests.forEach((request) => {
        const sectionId = Number(request.section.id);
        if (!bySection.has(sectionId)) {
          bySection.set(sectionId, []);
        }
        bySection.get(sectionId).push(request);
      });

      const sectionOrder = [...bySection.keys()].sort((a, b) => {
        const aCoverage = getSectionCoverageState(a, schedulingState);
        const bCoverage = getSectionCoverageState(b, schedulingState);
        if (aCoverage.ratio !== bCoverage.ratio) return aCoverage.ratio - bCoverage.ratio;
        if (aCoverage.assigned !== bCoverage.assigned) return aCoverage.assigned - bCoverage.assigned;
        return String(sectionById.get(a)?.section_name || "").localeCompare(String(sectionById.get(b)?.section_name || ""));
      });
      if (options.reverseSectionOrder) {
        sectionOrder.reverse();
      }

      const interleaved = [];
      let hasPending = true;
      while (hasPending) {
        hasPending = false;
        for (const sectionId of sectionOrder) {
          const queue = bySection.get(sectionId);
          if (!queue || queue.length === 0) continue;
          interleaved.push(queue.shift());
          hasPending = true;
        }
      }

      return interleaved;
    }

    function sortSessionRequests(requests, failureState, schedulingState, options = {}) {
      const sorted = [...requests].sort((a, b) => {
        const aSectionId = Number(a.section.id);
        const bSectionId = Number(b.section.id);
        const aCoverage = getSectionCoverageState(aSectionId, schedulingState);
        const bCoverage = getSectionCoverageState(bSectionId, schedulingState);
        if (aCoverage.missing !== bCoverage.missing) {
          return bCoverage.missing - aCoverage.missing;
        }
        if (aCoverage.ratio !== bCoverage.ratio) {
          return aCoverage.ratio - bCoverage.ratio;
        }

        const aRemaining = Number(schedulingState?.subjectRemainingMap?.get(a.request_key) || 0);
        const bRemaining = Number(schedulingState?.subjectRemainingMap?.get(b.request_key) || 0);
        if (aRemaining !== bRemaining) {
          return bRemaining - aRemaining;
        }

        const aFailures = failureState?.get(a.request_id)?.count || 0;
        const bFailures = failureState?.get(b.request_id)?.count || 0;
        if (aFailures !== bFailures) {
          return bFailures - aFailures;
        }

        const aStrength = Number(a.section.student_strength || 0);
        const bStrength = Number(b.section.student_strength || 0);
        if (aStrength !== bStrength) return bStrength - aStrength;

        const aDay = Number(a.preferred_day || 0);
        const bDay = Number(b.preferred_day || 0);
        if (aDay !== bDay) return aDay - bDay;

        const bySection = String(a.section.section_name || "").localeCompare(String(b.section.section_name || ""));
        if (bySection !== 0) return bySection;
        return String(a.subject.subject_name || "").localeCompare(String(b.subject.subject_name || ""));
      });
      if (options.reverseRequestOrder) {
        sorted.reverse();
      }
      return sorted;
    }

    function calculateLayoutPenalty(candidateEntries) {
      const slotNumbersBySectionDay = new Map();
      for (const entry of candidateEntries) {
        const key = `${entry.section_id}-${entry.day_of_week}`;
        if (!slotNumbersBySectionDay.has(key)) {
          slotNumbersBySectionDay.set(key, new Set());
        }
        slotNumbersBySectionDay.get(key).add(Number(entry.slot_number));
      }

      let holePenalty = 0;
      let lateStartPenalty = 0;
      let spanPenalty = 0;

      slotNumbersBySectionDay.forEach((slotSet) => {
        const slotNumbers = [...slotSet].filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => a - b);
        if (slotNumbers.length === 0) return;
        const minSlot = slotNumbers[0];
        const maxSlot = slotNumbers[slotNumbers.length - 1];
        const holes = Math.max(0, maxSlot - minSlot + 1 - slotNumbers.length);

        holePenalty += holes;
        lateStartPenalty += Math.max(0, minSlot - 1);
        spanPenalty += maxSlot - minSlot + 1;
      });

      return holePenalty * 100 + lateStartPenalty * 10 + spanPenalty;
    }

    function calculateSectionCoveragePenalty(sectionAssignedCount) {
      let penalty = 0;
      requiredRequestCountBySection.forEach((required, sectionId) => {
        const assigned = Number(sectionAssignedCount.get(Number(sectionId)) || 0);
        const missing = Math.max(0, Number(required) - assigned);
        penalty += missing * 1000;
      });
      return penalty;
    }

    function runSchedulingProfile(profile) {
      const schedulingState = {
        facultySlotUsed: new Set(),
        roomSlotUsed: new Set(),
        sectionSlotUsed: new Set(),
        facultyLoadState: createFacultyLoadState(),
        facultyDayLoadUsed: new Map(),
        facultyAssignmentMap: new Map(initialFacultyAssignmentMap),
        subjectRemainingMap: new Map(subjectRemainingMap),
        sectionSubjectAssignedCount: new Map(),
        sectionAssignedCount: new Map(),
        entries: [],
        assignedRequestCountByKey: new Map(),
      };
      const failureState = new Map();

      function runModeRequests(modeRequests) {
        let pending = [...modeRequests];
        let noProgressPasses = 0;
        const sectionCount = Math.max(1, sectionsResult.rows.length);
        const maxPasses = Math.max(
          8,
          profile.variants.length * 4,
          Math.ceil(modeRequests.length / sectionCount) * 3
        );

        for (let pass = 0; pass < maxPasses && pending.length > 0; pass += 1) {
          const variant = profile.variants[pass % profile.variants.length];
          const sortedPending = sortSessionRequests(
            pending,
            profile.preferFailureFirst ? failureState : null,
            schedulingState,
            {
              reverseRequestOrder: profile.reverseRequestOrder ? pass % 2 === 1 : false,
            }
          );
          const orderedPending = interleaveRequestsBySection(sortedPending, schedulingState, {
            reverseSectionOrder: profile.reverseRequestOrder ? pass % 2 === 1 : false,
          });

          let assignedThisPass = 0;
          const nextPending = [];
          for (const request of orderedPending) {
            const assigned = tryAssignRequest(request, variant, schedulingState);
            if (assigned.success) {
              assignedThisPass += 1;
            } else {
              const failure = failureState.get(request.request_id) || { count: 0, lastReason: CONFLICT_REASON.NO_SLOT_AVAILABLE };
              failureState.set(request.request_id, {
                count: failure.count + 1,
                lastReason: assigned.reason || CONFLICT_REASON.NO_SLOT_AVAILABLE,
              });
              nextPending.push(request);
            }
          }

          pending = nextPending;
          if (assignedThisPass === 0) {
            noProgressPasses += 1;
          } else {
            noProgressPasses = 0;
          }
          if (noProgressPasses >= profile.variants.length) {
            break;
          }
        }

        return pending;
      }

      const practicalRequests = sortSessionRequests(
        sessionRequests.filter((request) => request.mode === "Practical"),
        null,
        schedulingState,
        { reverseRequestOrder: profile.reverseRequestOrder }
      );
      const theoryRequests = sortSessionRequests(
        sessionRequests.filter((request) => request.mode !== "Practical"),
        null,
        schedulingState,
        { reverseRequestOrder: profile.reverseRequestOrder }
      );

      const pendingPractical = runModeRequests(practicalRequests);
      const pendingTheory = runModeRequests(theoryRequests);
      const pendingRequests = [...pendingPractical, ...pendingTheory];

      return {
        schedulingState,
        entries: schedulingState.entries,
        assignedRequestCountByKey: schedulingState.assignedRequestCountByKey,
        failureState,
        pendingRequests,
        pendingPracticalCount: pendingRequests.filter((request) => request.mode === "Practical").length,
        layoutPenalty: calculateLayoutPenalty(schedulingState.entries),
        sectionCoveragePenalty: calculateSectionCoveragePenalty(schedulingState.sectionAssignedCount),
      };
    }

    function isBetterSchedulingResult(candidate, currentBest) {
      if (!currentBest) return true;
      if (candidate.pendingPracticalCount !== currentBest.pendingPracticalCount) {
        return candidate.pendingPracticalCount < currentBest.pendingPracticalCount;
      }
      if (candidate.pendingRequests.length !== currentBest.pendingRequests.length) {
        return candidate.pendingRequests.length < currentBest.pendingRequests.length;
      }
      if (candidate.entries.length !== currentBest.entries.length) {
        return candidate.entries.length > currentBest.entries.length;
      }
      if (candidate.sectionCoveragePenalty !== currentBest.sectionCoveragePenalty) {
        return candidate.sectionCoveragePenalty < currentBest.sectionCoveragePenalty;
      }
      if (candidate.layoutPenalty !== currentBest.layoutPenalty) {
        return candidate.layoutPenalty < currentBest.layoutPenalty;
      }
      return false;
    }

    const baseSchedulingProfiles = [
      {
        reverseRequestOrder: false,
        preferFailureFirst: false,
        variants: [
          {
            ignorePreferredDay: false,
            reverseDayOrder: false,
            reverseSlotOrder: false,
            reverseFacultyOrder: false,
            reverseRoomOrder: false,
          },
          {
            ignorePreferredDay: false,
            reverseDayOrder: false,
            reverseSlotOrder: false,
            reverseFacultyOrder: true,
            reverseRoomOrder: true,
          },
          {
            ignorePreferredDay: true,
            reverseDayOrder: false,
            reverseSlotOrder: false,
            reverseFacultyOrder: false,
            reverseRoomOrder: false,
            allowSecondaryFacultyFallback: true,
            allowAnyFacultyFallback: true,
          },
        ],
      },
      {
        reverseRequestOrder: false,
        preferFailureFirst: true,
        variants: [
          {
            ignorePreferredDay: false,
            reverseDayOrder: true,
            reverseSlotOrder: false,
            reverseFacultyOrder: false,
            reverseRoomOrder: false,
          },
          {
            ignorePreferredDay: true,
            reverseDayOrder: true,
            reverseSlotOrder: false,
            reverseFacultyOrder: true,
            reverseRoomOrder: true,
            allowSecondaryFacultyFallback: true,
            allowAnyFacultyFallback: true,
          },
        ],
      },
      {
        reverseRequestOrder: true,
        preferFailureFirst: true,
        variants: [
          {
            ignorePreferredDay: false,
            reverseDayOrder: false,
            reverseSlotOrder: true,
            reverseFacultyOrder: false,
            reverseRoomOrder: false,
          },
          {
            ignorePreferredDay: true,
            reverseDayOrder: true,
            reverseSlotOrder: true,
            reverseFacultyOrder: true,
            reverseRoomOrder: true,
            allowSecondaryFacultyFallback: true,
            allowAnyFacultyFallback: true,
          },
        ],
      },
    ];

    const profileOrderByStrategy = {
      [GENERATION_STRATEGY.BALANCED]: [0, 1, 2],
      [GENERATION_STRATEGY.COMPACT]: [2, 1, 0],
      [GENERATION_STRATEGY.FACULTY_FRIENDLY]: [1, 0, 2],
    };

    const schedulingProfiles = (profileOrderByStrategy[generationStrategy] || profileOrderByStrategy.balanced)
      .map((profileIndex) => baseSchedulingProfiles[profileIndex])
      .filter(Boolean);

    let bestSchedulingResult = null;
    for (const profile of schedulingProfiles) {
      const candidate = runSchedulingProfile(profile);
      if (isBetterSchedulingResult(candidate, bestSchedulingResult)) {
        bestSchedulingResult = candidate;
      }
      if (candidate.pendingRequests.length === 0) {
        break;
      }
    }

    const schedulingState =
      bestSchedulingResult?.schedulingState ||
      {
        facultySlotUsed: new Set(),
        roomSlotUsed: new Set(),
        sectionSlotUsed: new Set(),
        facultyLoadState: createFacultyLoadState(),
        facultyDayLoadUsed: new Map(),
        facultyAssignmentMap: new Map(initialFacultyAssignmentMap),
        subjectRemainingMap: new Map(subjectRemainingMap),
        sectionSubjectAssignedCount: new Map(),
        sectionAssignedCount: new Map(),
        entries: [],
        assignedRequestCountByKey: new Map(),
      };
    const entries = schedulingState.entries;
    const assignedRequestCountByKey = schedulingState.assignedRequestCountByKey;
    let unresolvedRequests = [...(bestSchedulingResult?.pendingRequests || [])];
    const unresolvedFailureState = bestSchedulingResult?.failureState || new Map();

    const fallbackVariants = [
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
      },
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: true,
        reverseFacultyOrder: true,
        reverseRoomOrder: true,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
      },
      {
        ignorePreferredDay: true,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
      },
      {
        ignorePreferredDay: true,
        reverseDayOrder: true,
        reverseSlotOrder: true,
        reverseFacultyOrder: true,
        reverseRoomOrder: true,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
        ignoreDailyFacultyLimit: true,
      },
      {
        ignorePreferredDay: true,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
        ignoreDailyFacultyLimit: true,
        ignoreOveruseThreshold: true,
        ignoreWeeklyFacultyLimit: true,
      },
    ];

    function tryAssignWithVariants(request, variants) {
      for (const variant of variants) {
        const assigned = tryAssignRequest(request, variant, schedulingState);
        if (assigned.success) {
          return { success: true };
        }
      }
      return { success: false };
    }

    // Final required-hours completion attempt: keep iterating unresolved requests with broader variants.
    if (unresolvedRequests.length > 0) {
      let pending = [...unresolvedRequests];
      let noProgressPasses = 0;
      const maxPasses = Math.max(8, fallbackVariants.length * 3);

      for (let pass = 0; pass < maxPasses && pending.length > 0; pass += 1) {
        const sortedPending = sortSessionRequests(pending, unresolvedFailureState, schedulingState, {
          reverseRequestOrder: pass % 2 === 1,
        });
        const orderedPending = interleaveRequestsBySection(sortedPending, schedulingState, {
          reverseSectionOrder: pass % 2 === 1,
        });
        const nextPending = [];
        let assignedThisPass = 0;

        for (const request of orderedPending) {
          const attempt = tryAssignWithVariants(request, fallbackVariants);
          if (attempt.success) {
            assignedThisPass += 1;
          } else {
            const failure = unresolvedFailureState.get(request.request_id) || { count: 0, lastReason: CONFLICT_REASON.NO_SLOT_AVAILABLE };
            unresolvedFailureState.set(request.request_id, {
              count: failure.count + 1,
              lastReason: failure.lastReason || CONFLICT_REASON.NO_SLOT_AVAILABLE,
            });
            nextPending.push(request);
          }
        }

        pending = nextPending;
        if (assignedThisPass === 0) {
          noProgressPasses += 1;
        } else {
          noProgressPasses = 0;
        }
        if (noProgressPasses >= 2) {
          break;
        }
      }

      unresolvedRequests = pending;
    }

    // Intelligent blank-slot fill (only after required hours are fully placed).
    // This keeps day-wise timetable dense while still respecting room/faculty/section/workload rules.
    if (unresolvedRequests.length === 0) {
      const practicalSubjects = subjectsResult.rows.filter((subject) => {
        const type = normalizeSubjectType(subject.subject_type);
        return type === "Practical" || type === "Theory + Practical";
      });
      const theorySubjects = subjectsResult.rows.filter((subject) => normalizeSubjectType(subject.subject_type) !== "Practical");
      const totalSectionCapacity = sectionsResult.rows.length * slots.length;
      const fillUsage = new Map();

      entries.forEach((entry) => {
        const key = `${entry.section_id}::${entry.subject_id}::${entry.session_mode}`;
        fillUsage.set(key, (fillUsage.get(key) || 0) + 1);
      });

      const overflowVariants = [
        {
          ignorePreferredDay: false,
          reverseDayOrder: false,
          reverseSlotOrder: false,
          reverseFacultyOrder: false,
          reverseRoomOrder: false,
        },
        {
          ignorePreferredDay: false,
          reverseDayOrder: true,
          reverseSlotOrder: false,
          reverseFacultyOrder: true,
          reverseRoomOrder: true,
          allowSecondaryFacultyFallback: true,
          allowAnyFacultyFallback: true,
        },
        {
          ignorePreferredDay: true,
          reverseDayOrder: false,
          reverseSlotOrder: true,
          reverseFacultyOrder: true,
          reverseRoomOrder: true,
          allowSecondaryFacultyFallback: true,
          allowAnyFacultyFallback: true,
          ignoreDailyFacultyLimit: true,
        },
        {
          ignorePreferredDay: true,
          reverseDayOrder: false,
          reverseSlotOrder: false,
          reverseFacultyOrder: false,
          reverseRoomOrder: false,
          allowSecondaryFacultyFallback: true,
          allowAnyFacultyFallback: true,
          ignoreDailyFacultyLimit: true,
          ignoreOveruseThreshold: true,
          ignoreWeeklyFacultyLimit: true,
        },
      ];

      const maxFillPasses = Math.max(8, totalSectionCapacity);
      for (let pass = 0; pass < maxFillPasses && entries.length < totalSectionCapacity; pass += 1) {
        let passProgress = 0;

        for (const section of sectionsResult.rows) {
          const modeOrder = pass % 2 === 0 ? ["Practical", "Theory"] : ["Theory", "Practical"];
          let sectionAssigned = false;

          for (const mode of modeOrder) {
            const subjectPool = mode === "Practical" ? practicalSubjects : theorySubjects;
            if (subjectPool.length === 0) continue;

            const sortedPool = [...subjectPool].sort((a, b) => {
              const aKey = `${section.id}::${a.id}::${mode}`;
              const bKey = `${section.id}::${b.id}::${mode}`;
              const aCount = fillUsage.get(aKey) || 0;
              const bCount = fillUsage.get(bKey) || 0;
              if (aCount !== bCount) return aCount - bCount;
              return String(a.subject_name || "").localeCompare(String(b.subject_name || ""));
            });

            for (const subject of sortedPool) {
              const preferredDay = workingDaySequence.length
                ? workingDaySequence[(pass + Number(section.id) + Number(subject.id)) % workingDaySequence.length]
                : null;
              const overflowRequest = {
                section,
                subject,
                mode,
                preferred_day: preferredDay,
                requested_per_week: 1,
                request_key: `overflow::${section.id}::${subject.id}::${mode}`,
                request_id: `overflow:${section.id}:${subject.id}:${mode}:${pass}`,
              };

              const attempt = tryAssignWithVariants(overflowRequest, overflowVariants);
              if (!attempt.success) {
                continue;
              }

              const usageKey = `${section.id}::${subject.id}::${mode}`;
              fillUsage.set(usageKey, (fillUsage.get(usageKey) || 0) + 1);
              passProgress += 1;
              sectionAssigned = true;
              break;
            }

            if (sectionAssigned) {
              break;
            }
          }
        }

        if (passProgress === 0) {
          break;
        }
      }
    }

    unresolvedRequests.forEach((request) => {
      const reason = unresolvedFailureState.get(request.request_id)?.lastReason || CONFLICT_REASON.NO_SLOT_AVAILABLE;
      const reasonLabel =
        reason === CONFLICT_REASON.NO_LAB_AVAILABLE
          ? `No lab available for subject ${request.subject.subject_name}`
          : reason === CONFLICT_REASON.NO_CONTINUOUS_LAB_BLOCK
            ? `No continuous lab block available for subject ${request.subject.subject_name}`
            : CONFLICT_REASON_LABELS[reason] || CONFLICT_REASON_LABELS[CONFLICT_REASON.NO_SLOT_AVAILABLE];
      const summaryKey = conflictReasonToSummaryKey(reason);
      const conflictItem = `${request.section.section_name} - ${request.subject.subject_name}`;
      conflicts.push({
        section_id: request.section.id,
        section_name: request.section.section_name,
        subject_id: request.subject.id,
        subject_name: request.subject.subject_name,
        mode: request.mode,
        requested_per_week: request.requested_per_week,
        reason: reasonLabel,
        reason_key: reason,
      });
      conflictSummaryBuckets[summaryKey].add(conflictItem);
    });

    const incompleteSubjects = [];
    requestedCountBySectionSubjectMode.forEach((requiredCount, key) => {
      const assignedCount = assignedRequestCountByKey.get(key) || 0;
      if (assignedCount >= requiredCount) return;

      const [sectionIdText, subjectIdText, mode] = key.split("::");
      const sectionId = Number(sectionIdText);
      const subjectId = Number(subjectIdText);
      const section = sectionsResult.rows.find((row) => Number(row.id) === sectionId);
      const subject = subjectsResult.rows.find((row) => Number(row.id) === subjectId);
      if (!section || !subject) return;

      const modeMinutes = mode === "Practical" ? labBlockMinutes : Math.max(1, slotDurationMinutes);
      const requiredMinutes = requiredCount * modeMinutes;
      const assignedMinutes = assignedCount * modeMinutes;
      const missingMinutes = Math.max(0, requiredMinutes - assignedMinutes);
      const conflictItem = `${section.section_name} - ${subject.subject_name}`;

      incompleteSubjects.push({
        section_id: section.id,
        section_name: section.section_name,
        subject_id: subject.id,
        subject_name: subject.subject_name,
        mode,
        required_sessions: requiredCount,
        assigned_sessions: assignedCount,
        missing_sessions: requiredCount - assignedCount,
        required_minutes: requiredMinutes,
        assigned_minutes: assignedMinutes,
        missing_minutes: missingMinutes,
      });

      conflictSummaryBuckets.no_slot_available.add(conflictItem);
      conflicts.push({
        section_id: section.id,
        section_name: section.section_name,
        subject_id: subject.id,
        subject_name: subject.subject_name,
        mode,
        requested_per_week: requiredCount,
        reason: `Unable to schedule full required hours for subject ${subject.subject_name}`,
        reason_key: "incomplete_subject_hours",
      });
    });

    const incompleteSections = [];
    requiredRequestCountBySection.forEach((requiredCount, sectionId) => {
      const assignedCount = Number(schedulingState.sectionAssignedCount.get(Number(sectionId)) || 0);
      if (assignedCount >= Number(requiredCount)) return;

      const sectionName = String(sectionById.get(Number(sectionId))?.section_name || `Section#${sectionId}`);
      incompleteSections.push({
        section_id: Number(sectionId),
        section_name: sectionName,
        required_sessions: Number(requiredCount),
        assigned_sessions: assignedCount,
        missing_sessions: Math.max(0, Number(requiredCount) - assignedCount),
      });
    });

    if (incompleteSubjects.length > 0) {
      const firstIncomplete = incompleteSubjects[0];
      const conflictSummary = buildGroupedItems(conflictSummaryBuckets, CONFLICT_SUMMARY_LABELS);
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: `Unable to schedule full required hours for subject ${firstIncomplete.subject_name}`,
        precheck_summary: buildPrecheckSummary(precheckStatus),
        assigned_entries: entries.length,
        conflicts_count: conflicts.length,
        conflicts,
        incomplete_subjects: incompleteSubjects,
        incomplete_sections: incompleteSections,
        conflict_summary: conflictSummary,
        errors: flattenGroupItems(conflictSummary),
      });
    }

    if (entries.length === 0) {
      const conflictSummary = buildGroupedItems(conflictSummaryBuckets, CONFLICT_SUMMARY_LABELS);
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Unable to assign any timetable entries. Resolve conflicts and retry.",
        precheck_summary: buildPrecheckSummary(precheckStatus),
        assigned_entries: 0,
        conflicts_count: conflicts.length,
        conflicts,
        conflict_summary: conflictSummary,
        errors: flattenGroupItems(conflictSummary),
      });
    }

    // Mandatory fill pass: prevent empty cells after required subject coverage.
    const orderedSlots = [...slots].sort((a, b) =>
      Number(a.day_of_week) === Number(b.day_of_week)
        ? Number(a.slot_number) === Number(b.slot_number)
          ? Number(a.id) - Number(b.id)
          : Number(a.slot_number) - Number(b.slot_number)
        : Number(a.day_of_week) - Number(b.day_of_week)
    );
    const slotByDayAndNumber = new Map(
      orderedSlots.map((slot) => [`${slot.day_of_week}-${slot.slot_number}`, slot])
    );
    const subjectUsageBySectionSubject = new Map();
    entries.forEach((entry) => {
      const key = `${entry.section_id}::${entry.subject_id}`;
      subjectUsageBySectionSubject.set(key, (subjectUsageBySectionSubject.get(key) || 0) + 1);
    });

    function getRemainingForSectionSubjectMode(sectionId, subjectId, mode) {
      const requestKey = makeRequestKey(sectionId, subjectId, mode);
      const requiredCount = Number(requestedCountBySectionSubjectMode.get(requestKey) || 0);
      const assignedCount = Number(assignedRequestCountByKey.get(requestKey) || 0);
      return Math.max(0, requiredCount - assignedCount);
    }

    function getRemainingForSectionSubject(sectionId, subjectId) {
      return (
        getRemainingForSectionSubjectMode(sectionId, subjectId, "Theory") +
        getRemainingForSectionSubjectMode(sectionId, subjectId, "Practical")
      );
    }

    const mandatoryFillVariants = [
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
      },
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
        allowSecondaryFacultyFallback: true,
      },
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
      },
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: true,
        reverseRoomOrder: true,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
        ignoreDailyFacultyLimit: true,
      },
      {
        ignorePreferredDay: false,
        reverseDayOrder: false,
        reverseSlotOrder: false,
        reverseFacultyOrder: false,
        reverseRoomOrder: false,
        allowSecondaryFacultyFallback: true,
        allowAnyFacultyFallback: true,
        ignoreDailyFacultyLimit: true,
        ignoreOveruseThreshold: true,
        ignoreWeeklyFacultyLimit: true,
      },
    ];

    function tryAssignExactSlotWithVariants(request, slotGroup) {
      for (const variant of mandatoryFillVariants) {
        const assigned = tryAssignRequest(
          request,
          {
            ...variant,
            exactSlotGroup: slotGroup,
          },
          schedulingState
        );
        if (assigned.success) {
          return true;
        }
      }
      return false;
    }

    const maxMandatoryFillPasses = Math.max(2, sectionsResult.rows.length * 2);
    for (let pass = 0; pass < maxMandatoryFillPasses; pass += 1) {
      let passProgress = 0;

      for (const slot of orderedSlots) {
        for (const section of sectionsResult.rows) {
          const sectionSlotKey = `${section.id}-${slot.id}`;
          if (schedulingState.sectionSlotUsed.has(sectionSlotKey)) {
            continue;
          }

          const sortedSubjects = [...subjectsResult.rows].sort((a, b) => {
            const aRemaining = getRemainingForSectionSubject(Number(section.id), Number(a.id));
            const bRemaining = getRemainingForSectionSubject(Number(section.id), Number(b.id));
            if (aRemaining !== bRemaining) return bRemaining - aRemaining;

            const aUsage = Number(subjectUsageBySectionSubject.get(`${section.id}::${a.id}`) || 0);
            const bUsage = Number(subjectUsageBySectionSubject.get(`${section.id}::${b.id}`) || 0);
            if (aUsage !== bUsage) return aUsage - bUsage;

            return String(a.subject_name || "").localeCompare(String(b.subject_name || ""));
          });

          let assigned = false;
          for (const subject of sortedSubjects) {
            const sectionId = Number(section.id);
            const subjectId = Number(subject.id);
            const subjectType = normalizeSubjectType(subject.subject_type);
            const remainingTheory = getRemainingForSectionSubjectMode(sectionId, subjectId, "Theory");
            const remainingPractical = getRemainingForSectionSubjectMode(sectionId, subjectId, "Practical");
            let modes;
            if (subjectType === "Practical") {
              modes = ["Practical"];
            } else if (subjectType === "Theory") {
              modes = ["Theory"];
            } else {
              modes = remainingPractical > remainingTheory ? ["Practical", "Theory"] : ["Theory", "Practical"];
            }

            for (const mode of modes) {
              let slotGroup = [slot];
              if (mode === "Practical") {
                const nextSlot = slotByDayAndNumber.get(`${slot.day_of_week}-${Number(slot.slot_number) + 1}`);
                if (!nextSlot) continue;
                if (!isContinuousSlotPair(slot, nextSlot)) continue;
                if (schedulingState.sectionSlotUsed.has(`${section.id}-${nextSlot.id}`)) continue;
                slotGroup = [slot, nextSlot];
              }

              const requiredRequestKey = makeRequestKey(sectionId, subjectId, mode);
              const hasRequiredKey = requestedCountBySectionSubjectMode.has(requiredRequestKey);
              const request = {
                section,
                subject,
                mode,
                preferred_day: slot.day_of_week,
                requested_per_week: 1,
                request_key: hasRequiredKey ? requiredRequestKey : `mandatory::${sectionId}::${subjectId}::${mode}`,
                request_id: `mandatory:${sectionId}:${subjectId}:${mode}:${slot.id}:${pass}`,
              };

              const placed = tryAssignExactSlotWithVariants(request, slotGroup);
              if (!placed) continue;

              const usageKey = `${section.id}::${subject.id}`;
              subjectUsageBySectionSubject.set(usageKey, (subjectUsageBySectionSubject.get(usageKey) || 0) + 1);
              passProgress += 1;
              assigned = true;
              break;
            }

            if (assigned) break;
          }
        }
      }

      if (passProgress === 0) {
        break;
      }
    }

    const emptySlots = [];
    for (const slot of orderedSlots) {
      for (const section of sectionsResult.rows) {
        if (!schedulingState.sectionSlotUsed.has(`${section.id}-${slot.id}`)) {
          emptySlots.push({
            section_id: Number(section.id),
            section_name: String(section.section_name || `Section#${section.id}`),
            day_of_week: Number(slot.day_of_week),
            slot_number: Number(slot.slot_number),
            timeslot_id: Number(slot.id),
          });
        }
      }
    }

    if (emptySlots.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Mandatory fill failed. Some timetable slots are still empty.",
        precheck_summary: buildPrecheckSummary(precheckStatus),
        assigned_entries: entries.length,
        empty_slots_count: emptySlots.length,
        empty_slots: emptySlots.slice(0, 200),
      });
    }

    const sectionSubjectFacultySet = new Map();
    entries.forEach((entry) => {
      const key = toSectionSubjectKey(entry.section_id, entry.subject_id);
      if (!sectionSubjectFacultySet.has(key)) {
        sectionSubjectFacultySet.set(key, new Set());
      }
      sectionSubjectFacultySet.get(key).add(Number(entry.faculty_id));
    });

    const inconsistentFacultyAssignments = [];
    sectionSubjectFacultySet.forEach((facultyIds, key) => {
      if (facultyIds.size <= 1) return;
      const [sectionIdText, subjectIdText] = key.split("::");
      const sectionId = Number(sectionIdText);
      const subjectId = Number(subjectIdText);
      const sectionName = String(sectionById.get(sectionId)?.section_name || `Section#${sectionId}`);
      const subjectName = String(subjectById.get(subjectId)?.subject_name || `Subject#${subjectId}`);
      inconsistentFacultyAssignments.push({
        section_id: sectionId,
        section_name: sectionName,
        subject_id: subjectId,
        subject_name: subjectName,
        faculty_ids: [...facultyIds],
      });
    });

    if (inconsistentFacultyAssignments.length > 0) {
      const firstInconsistency = inconsistentFacultyAssignments[0];
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: `Faculty consistency violation for ${firstInconsistency.section_name} - ${firstInconsistency.subject_name}`,
        precheck_summary: buildPrecheckSummary(precheckStatus),
        assigned_entries: entries.length,
        conflicts_count: conflicts.length,
        conflicts,
        inconsistent_faculty_assignments: inconsistentFacultyAssignments,
      });
    }

    const sectionCoverage = sectionsResult.rows.map((section) => {
      const sectionId = Number(section.id);
      const required = Number(requiredRequestCountBySection.get(sectionId) || 0);
      const assigned = Number(schedulingState.sectionAssignedCount.get(sectionId) || 0);
      return {
        section_id: sectionId,
        section_name: String(section.section_name || `Section#${sectionId}`),
        required_sessions: required,
        assigned_sessions: assigned,
        missing_sessions: Math.max(0, required - assigned),
        completion_ratio: required > 0 ? Number((assigned / required).toFixed(3)) : 1,
      };
    });
    const facultyLoad = [...schedulingState.facultyLoadState.entries()]
      .map(([facultyId, value]) => {
        const assigned = Number(value?.assigned || 0);
        const max = Number(value?.max || 0);
        return {
          faculty_id: Number(facultyId),
          faculty_name: String(value?.name || `Faculty#${facultyId}`),
          assigned_classes: assigned,
          max_classes_per_week: max,
          load_ratio: max > 0 ? Number((assigned / max).toFixed(3)) : null,
        };
      })
      .sort((a, b) => {
        const aRatio = a.load_ratio === null ? Number.POSITIVE_INFINITY : a.load_ratio;
        const bRatio = b.load_ratio === null ? Number.POSITIVE_INFINITY : b.load_ratio;
        if (aRatio !== bRatio) return aRatio - bRatio;
        if (a.assigned_classes !== b.assigned_classes) return a.assigned_classes - b.assigned_classes;
        return String(a.faculty_name).localeCompare(String(b.faculty_name));
      });

    const uniqueAssignedRoomIds = [...new Set(entries.map((entry) => Number(entry.classroom_id)).filter((id) => Number.isInteger(id) && id > 0))];
    const roomValidationResult = uniqueAssignedRoomIds.length
      ? await client.query(
          `SELECT id, room_number, room_type
           FROM classrooms
           WHERE id = ANY($1::int[])`,
          [uniqueAssignedRoomIds]
        )
      : { rows: [] };
    const validatedRoomTypeById = new Map(
      roomValidationResult.rows.map((room) => [Number(room.id), String(room.room_type || "").toLowerCase()])
    );
    const validatedRoomNumberById = new Map(
      roomValidationResult.rows.map((room) => [Number(room.id), String(room.room_number || "").trim()])
    );
    const subjectNameById = new Map(subjectsResult.rows.map((subject) => [Number(subject.id), String(subject.subject_name || "").trim()]));
    const sectionNameById = new Map(sectionsResult.rows.map((section) => [Number(section.id), String(section.section_name || "").trim()]));

    const roomTypeMismatches = [];
    for (const entry of entries) {
      const roomId = Number(entry.classroom_id);
      const actualRoomType = validatedRoomTypeById.get(roomId) || roomTypeById.get(roomId) || "";
      const actualRoomNumber = validatedRoomNumberById.get(roomId) || roomNumberById.get(roomId) || "";
      const expectedRoomType = entry.session_mode === "Practical" ? "lab" : "lecture";
      const hasMismatch = actualRoomType !== expectedRoomType;
      const hasRoom112TheoryMisuse = actualRoomNumber === "112" && entry.session_mode !== "Practical";

      if (!hasMismatch && !hasRoom112TheoryMisuse) {
        continue;
      }

      const sectionName = sectionNameById.get(Number(entry.section_id)) || `Section#${entry.section_id}`;
      const subjectName = subjectNameById.get(Number(entry.subject_id)) || `Subject#${entry.subject_id}`;
      const conflictItem = `${sectionName} - ${subjectName}`;
      roomTypeMismatches.push({
        section_id: entry.section_id,
        section_name: sectionName,
        subject_id: entry.subject_id,
        subject_name: subjectName,
        mode: entry.session_mode,
        classroom_id: roomId,
        room_number: actualRoomNumber || "-",
        expected_room_type: expectedRoomType,
        actual_room_type: actualRoomType || "unknown",
      });

      if (entry.session_mode === "Practical") {
        conflictSummaryBuckets.no_lab_available.add(conflictItem);
      } else {
        conflictSummaryBuckets.no_classroom_available.add(conflictItem);
      }
      conflicts.push({
        section_id: entry.section_id,
        section_name: sectionName,
        subject_id: entry.subject_id,
        subject_name: subjectName,
        mode: entry.session_mode,
        requested_per_week: 1,
        reason: `Room type mismatch for subject ${subjectName}`,
        reason_key: "room_type_mismatch",
      });
    }

    if (roomTypeMismatches.length > 0) {
      const firstMismatch = roomTypeMismatches[0];
      const conflictSummary = buildGroupedItems(conflictSummaryBuckets, CONFLICT_SUMMARY_LABELS);
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: `Room type mismatch for subject ${firstMismatch.subject_name}`,
        precheck_summary: buildPrecheckSummary(precheckStatus),
        assigned_entries: entries.length,
        conflicts_count: conflicts.length,
        conflicts,
        room_type_mismatches: roomTypeMismatches,
        conflict_summary: conflictSummary,
        errors: flattenGroupItems(conflictSummary),
      });
    }

    if (simulateOnly) {
      const conflictSummary = buildGroupedItems(conflictSummaryBuckets, CONFLICT_SUMMARY_LABELS);
      await client.query("ROLLBACK");
      return res.status(200).json({
        message:
          conflicts.length === 0
            ? "Simulation successful. Timetable generation is feasible."
            : "Simulation completed with conflicts.",
        simulation_mode: true,
        generation_strategy: generationStrategy,
        faculty_overuse_threshold: facultyOveruseThreshold,
        feasible: conflicts.length === 0,
        assigned_entries: entries.length,
        conflicts_count: conflicts.length,
        conflicts,
        precheck_summary: buildPrecheckSummary(precheckStatus),
        section_coverage: sectionCoverage,
        faculty_load: facultyLoad,
        faculty_max_classes_per_day: facultyMaxClassesPerDay,
        auto_room_expansion: autoRoomExpansion,
        auto_created_rooms: autoCreatedRooms,
        conflict_summary: conflictSummary,
        errors: flattenGroupItems(conflictSummary),
      });
    }

    const insertColumns = ["timetable_id", "section_id", "subject_id", "faculty_id", "classroom_id", "timeslot_id"];
    if (hasSessionModeColumn) {
      insertColumns.push("session_mode");
    }
    if (hasDayColumn) {
      insertColumns.push('"day"');
    } else if (hasDayOfWeekColumn) {
      insertColumns.push("day_of_week");
    }
    if (hasSlotNumberColumn) {
      insertColumns.push("slot_number");
    }
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
    const insertEntrySql = `INSERT INTO timetable_entries (${insertColumns.join(", ")}) VALUES (${placeholders})`;

    for (const entry of entries) {
      const values = [
        entry.timetable_id,
        entry.section_id,
        entry.subject_id,
        entry.faculty_id,
        entry.classroom_id,
        entry.timeslot_id,
      ];
      if (hasSessionModeColumn) {
        values.push(entry.session_mode);
      }
      if (hasDayColumn || hasDayOfWeekColumn) {
        values.push(entry.day_of_week);
      }
      if (hasSlotNumberColumn) {
        values.push(entry.slot_number);
      }
      await client.query(insertEntrySql, values);
    }

    if (hasSubjectFacultyAssignmentTable) {
      const assignmentRowsByKey = new Map();
      entries.forEach((entry) => {
        const key = toSectionSubjectKey(entry.section_id, entry.subject_id);
        if (!assignmentRowsByKey.has(key)) {
          assignmentRowsByKey.set(key, {
            section_id: Number(entry.section_id),
            subject_id: Number(entry.subject_id),
            faculty_id: Number(entry.faculty_id),
          });
        }
      });

      for (const assignment of assignmentRowsByKey.values()) {
        await client.query(
          `INSERT INTO subject_faculty_assignment (section_id, subject_id, faculty_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (section_id, subject_id)
           DO UPDATE SET faculty_id = EXCLUDED.faculty_id`,
          [assignment.section_id, assignment.subject_id, assignment.faculty_id]
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
      generation_strategy: generationStrategy,
      faculty_overuse_threshold: facultyOveruseThreshold,
      timetable: {
        ...timetableResult.rows[0],
        total_weeks: totalWeeks,
        department_id: departmentId,
      },
      total_weeks: totalWeeks,
      assigned_entries: entries.length,
      conflicts_count: conflicts.length,
      conflicts,
      precheck_summary: buildPrecheckSummary(precheckStatus),
      section_coverage: sectionCoverage,
      faculty_load: facultyLoad,
      faculty_max_classes_per_day: facultyMaxClassesPerDay,
      auto_room_expansion: autoRoomExpansion,
      auto_created_rooms: autoCreatedRooms,
      conflict_summary: buildGroupedItems(conflictSummaryBuckets, CONFLICT_SUMMARY_LABELS),
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
  requireRoles("admin"),
  body("semester_id").isInt({ min: 1 }),
  body("version_name").trim().notEmpty(),
  body("generation_strategy").optional().isIn(["balanced", "compact", "faculty_friendly"]),
  body("faculty_overuse_threshold").optional().isInt({ min: 0, max: 20 }),
  body("faculty_assignment_overrides").optional().isArray(),
  body("auto_room_expansion").optional().isBoolean(),
  body("reuse_saved_faculty_assignments").optional().isBoolean(),
  validateRequest,
  generateTimetableHandler,
];

const getTimetableHistoryMiddleware = [authRequired, requireRoles("admin"), getTimetableHistoryHandler];

router.post("/generate", ...generateTimetableMiddleware);
router.get("/history", ...getTimetableHistoryMiddleware);

router.get("/", authRequired, requireRoles("admin"), async (req, res, next) => {
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

router.get("/:id", authRequired, requireRoles("admin"), async (req, res, next) => {
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

router.delete("/:id", authRequired, requireRoles("admin"), async (req, res, next) => {
  const client = await pool.connect();
  const removedHistoryRows = [];
  let transactionStarted = false;

  try {
    if (!ensureAdmin(req, res)) return;

    const timetableId = Number(req.params.id);
    if (!Number.isInteger(timetableId) || timetableId <= 0) {
      return res.status(400).json({ message: "Invalid timetable id" });
    }

    const historyIdRaw = String(req.query.history_id || "").trim();
    const historyId = historyIdRaw ? Number(historyIdRaw) : null;
    if (historyIdRaw && (!Number.isInteger(historyId) || historyId <= 0)) {
      return res.status(400).json({ message: "Invalid history id" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const timetableResult = await client.query(
      `SELECT id, version_name, semester_id
       FROM timetables
       WHERE id = $1`,
      [timetableId]
    );
    if (timetableResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Timetable not found" });
    }
    const timetable = timetableResult.rows[0];

    let deletedHistoryResult;
    if (historyId) {
      deletedHistoryResult = await client.query(
        `DELETE FROM timetable_history
         WHERE id = $1
           AND semester_id = $2
           AND version_name = $3
         RETURNING id, pdf_path`,
        [historyId, timetable.semester_id, timetable.version_name]
      );
      if (deletedHistoryResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Selected history record does not match this timetable" });
      }
    } else {
      deletedHistoryResult = await client.query(
        `DELETE FROM timetable_history th
         WHERE th.id IN (
           SELECT th2.id
           FROM timetable_history th2
           LEFT JOIN LATERAL (
             SELECT t.id
             FROM timetables t
             WHERE t.semester_id = th2.semester_id
               AND t.version_name = th2.version_name
             ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - th2.created_at))) ASC, t.id DESC
             LIMIT 1
           ) mapped_timetable ON TRUE
           WHERE mapped_timetable.id = $1
         )
         RETURNING id, pdf_path`,
        [timetableId]
      );
    }

    removedHistoryRows.push(...deletedHistoryResult.rows);

    const deleteTimetableResult = await client.query(
      `DELETE FROM timetables
       WHERE id = $1
       RETURNING id`,
      [timetableId]
    );
    if (deleteTimetableResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Timetable not found" });
    }

    await client.query("COMMIT");
    transactionStarted = false;

    for (const row of removedHistoryRows) {
      const pdfPath = String(row.pdf_path || "").trim();
      if (!pdfPath) continue;

      const stillReferencedResult = await pool.query(
        `SELECT 1
         FROM timetable_history
         WHERE pdf_path = $1
         LIMIT 1`,
        [pdfPath]
      );
      if (stillReferencedResult.rowCount === 0) {
        try {
          await removeHistoryPdfFile(pdfPath);
        } catch (fileErr) {
          // Timetable data is already deleted; keep response successful even if cleanup fails.
          console.warn("Failed to remove timetable PDF file", fileErr);
        }
      }
    }

    await logActivity(
      req.user.userId,
      "Timetable Deleted",
      `timetable_id=${timetableId}, history_removed=${removedHistoryRows.length}`
    );

    return res.json({
      message: "Timetable deleted successfully",
      timetable_id: timetableId,
      history_removed: removedHistoryRows.length,
    });
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return next(err);
  } finally {
    client.release();
  }
});

router.post(
  "/:id/approval",
  authRequired,
  requireRoles("admin"),
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

router.get("/reports/workload", authRequired, requireRoles("admin"), async (req, res, next) => {
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

router.get("/reports/room-utilization", authRequired, requireRoles("admin"), async (req, res, next) => {
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

router.get("/reports/subject-distribution", authRequired, requireRoles("admin"), async (req, res, next) => {
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

router.get("/reports/conflicts", authRequired, requireRoles("admin"), async (req, res, next) => {
  try {
    const [facultyConflict, roomConflict, sectionConflict, subjectFacultyConflict] = await Promise.all([
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
      pool.query(
        `SELECT te.timetable_id, te.section_id, sec.section_name, te.subject_id, sub.subject_name,
                COUNT(DISTINCT te.faculty_id)::int AS faculty_count
         FROM timetable_entries te
         JOIN sections sec ON sec.id = te.section_id
         JOIN subjects sub ON sub.id = te.subject_id
         GROUP BY te.timetable_id, te.section_id, sec.section_name, te.subject_id, sub.subject_name
         HAVING COUNT(DISTINCT te.faculty_id) > 1`
      ),
    ]);

    return res.json({
      faculty_conflicts: facultyConflict.rows,
      classroom_conflicts: roomConflict.rows,
      section_conflicts: sectionConflict.rows,
      section_subject_faculty_conflicts: subjectFacultyConflict.rows,
      has_conflicts:
        facultyConflict.rowCount > 0 ||
        roomConflict.rowCount > 0 ||
        sectionConflict.rowCount > 0 ||
        subjectFacultyConflict.rowCount > 0,
    });
  } catch (err) {
    return next(err);
  }
});

router.generateTimetableMiddleware = generateTimetableMiddleware;
router.getTimetableHistoryMiddleware = getTimetableHistoryMiddleware;

module.exports = router;
