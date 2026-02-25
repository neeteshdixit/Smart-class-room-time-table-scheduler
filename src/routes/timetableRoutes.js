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
const DEFAULT_SLOT_DURATION_MINUTES = 50;
const DEFAULT_MAX_WORKLOAD_PER_WEEK = 30;

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

function getSessionDemands(subject, totalWeeks, slotDurationMinutes) {
  const subjectHours = resolveSubjectHourBreakdown(subject);

  if (subjectHours.type === "Theory") {
    return [{ count: computeWeeklySessions(subjectHours.totalHours, totalWeeks, slotDurationMinutes), mode: "Theory" }];
  }

  if (subjectHours.type === "Practical") {
    return [{ count: computeWeeklySessions(subjectHours.totalHours, totalWeeks, slotDurationMinutes), mode: "Practical" }];
  }

  return [
    { count: computeWeeklySessions(subjectHours.theoryHours, totalWeeks, slotDurationMinutes), mode: "Theory" },
    { count: computeWeeklySessions(subjectHours.practicalHours, totalWeeks, slotDurationMinutes), mode: "Practical" },
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

  await client.query(
    `DELETE FROM time_slots
     WHERE department_id = $1
       AND (
         NOT (day_of_week = ANY($2::int[]))
         OR NOT (slot_number = ANY($3::int[]))
       )`,
    [departmentId, workingDays, slotNumbers]
  );

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

const PRECHECK_LABELS = Object.freeze({
  departments_configured: "Departments configured",
  faculty_mapped: "Faculty mapped",
  rooms_available: "Rooms available",
  slots_generated: "Slots generated",
});

const CONFLICT_REASON = Object.freeze({
  MISSING_FACULTY: "missing_faculty",
  ROOM_CLASH: "room_clash",
  FACULTY_CLASH: "faculty_clash",
  SECTION_CLASH: "section_clash",
  WORKLOAD_EXCEEDED: "workload_exceeded",
  NO_LAB_AVAILABLE: "no_lab_available",
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
  [CONFLICT_REASON.NO_SUITABLE_ROOM]: "No suitable room available",
  [CONFLICT_REASON.NO_SLOT_AVAILABLE]: "No slot available",
});

const ISSUE_LABELS = Object.freeze({
  missing_faculty_mapping: "Missing Faculty Mapping",
  missing_department_assignment: "Missing Department Assignment",
  missing_workload_limit: "Missing Workload Limit",
  missing_working_hours: "Department Working Hours Not Configured",
  no_classroom_available: "No Classroom Available",
  no_lab_available: "No Lab Available",
  no_sections: "No Sections Configured",
  no_subjects: "No Subjects Configured",
  slot_generation_failed: "Slot Generation Failed",
});

const CONFLICT_SUMMARY_LABELS = Object.freeze({
  missing_faculty_mapping: "Missing Faculty Mapping",
  no_lab_available: "No Lab Available",
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
  if (firstGroup.key === "missing_working_hours") {
    return "Department working hours are not configured.";
  }
  if (firstGroup.key === "no_lab_available") {
    return "No lab room is configured for practical sessions.";
  }
  if (firstGroup.key === "no_classroom_available") {
    return "No lecture classroom is configured.";
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

    await client.query("BEGIN");

    const precheckStatus = {
      departments_configured: false,
      faculty_mapped: false,
      rooms_available: false,
      slots_generated: false,
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

    const departmentId = Number(semesterMetaResult.rows[0].department_id);
    const [departmentScheduleResult, semesterDurationResult, sectionsResult, subjectsResult, roomsResult] =
      await Promise.all([
        client.query(
          `SELECT id, department_id, start_time, end_time, slot_duration_minutes, break_duration_minutes,
                  break_after_slot_number, working_days
           FROM department_schedule_config
           WHERE department_id = $1
           LIMIT 1`,
          [departmentId]
        ),
        client.query(
          `SELECT start_date, end_date
           FROM semester_durations
           WHERE semester_id = $1
           LIMIT 1`,
          [semesterId]
        ),
        client.query(
          `SELECT id, section_name, student_strength
           FROM sections
           WHERE semester_id = $1
           ORDER BY section_name, id`,
          [semesterId]
        ),
        client.query(
          `SELECT id, subject_name, subject_type, total_hours, theory_hours, practical_hours, requires_lab
           FROM subjects
           WHERE semester_id = $1
           ORDER BY subject_name, id`,
          [semesterId]
        ),
        client.query(
          `SELECT id, room_number, room_type, capacity
           FROM classrooms
           ORDER BY room_number, id`
        ),
      ]);

    if (departmentScheduleResult.rowCount > 0) {
      precheckStatus.departments_configured = true;
    } else {
      addIssue(issues, "missing_working_hours", "Configure department schedule first");
    }

    if (sectionsResult.rowCount === 0) {
      addIssue(issues, "no_sections", "No sections found for this semester");
    }

    if (subjectsResult.rowCount === 0) {
      addIssue(issues, "no_subjects", "No subjects found for this semester");
    }

    const lectureRooms = roomsResult.rows.filter((room) => String(room.room_type || "").toLowerCase() === "lecture");
    const labRooms = roomsResult.rows.filter((room) => String(room.room_type || "").toLowerCase() === "lab");

    if (!lectureRooms.length) {
      addIssue(issues, "no_classroom_available", "Add at least one classroom with room type 'Lecture'");
    }
    if (!labRooms.length) {
      addIssue(issues, "no_lab_available", "Add at least one classroom with room type 'Lab'");
    }
    if (lectureRooms.length > 0 && labRooms.length > 0) {
      precheckStatus.rooms_available = true;
    }

    let slots = [];
    if (departmentScheduleResult.rowCount > 0) {
      try {
        slots = await ensureDepartmentTimeSlots(client, departmentId, departmentScheduleResult.rows[0]);
        if (slots.length > 0) {
          precheckStatus.slots_generated = true;
        } else {
          addIssue(issues, "slot_generation_failed", "No valid slots generated from department schedule");
        }
      } catch (scheduleErr) {
        addIssue(issues, "slot_generation_failed", scheduleErr.message || "Invalid department schedule configuration");
      }
    }

    await ensureFacultyDirectoryRowsForSemesterMappings(client, semesterId);

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
           WHERE s.semester_id = $1`
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
           WHERE s.semester_id = $1`,
      [semesterId]
    );

    const totalWeeks = calculateTotalWeeks(semesterDurationResult.rows[0]);
    const slotDurationMinutes = asNonNegativeInteger(
      departmentScheduleResult.rows[0]?.slot_duration_minutes,
      DEFAULT_SLOT_DURATION_MINUTES
    );

    const subjectById = new Map(subjectsResult.rows.map((subject) => [Number(subject.id), subject]));
    const subjectFacultyMap = new Map();
    const facultyWorkloadMap = new Map();

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

    if (
      issues.missing_faculty_mapping.size === 0 &&
      issues.missing_department_assignment.size === 0 &&
      issues.missing_workload_limit.size === 0
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
    const facultySlotUsed = new Set();
    const roomSlotUsed = new Set();
    const sectionSlotUsed = new Set();
    const entries = [];
    const conflicts = [];
    const conflictSummaryBuckets = createConflictSummaryBuckets();

    function roomCandidatesFor(mode, studentStrength) {
      const sourceRooms = mode === "Practical" ? labRooms : lectureRooms;
      const requiredStrength = Number(studentStrength || 0);
      const capacityMatched = sourceRooms.filter((room) => Number(room.capacity || 0) >= requiredStrength);
      if (capacityMatched.length > 0) {
        return capacityMatched;
      }
      return sourceRooms;
    }

    function rankFacultyCandidates(candidates) {
      return [...candidates].sort((a, b) => {
        const aLoad = facultyWorkloadMap.get(a.faculty_id) || { max: 0, assigned: 0 };
        const bLoad = facultyWorkloadMap.get(b.faculty_id) || { max: 0, assigned: 0 };
        const aRatio = aLoad.max > 0 ? aLoad.assigned / aLoad.max : Number.POSITIVE_INFINITY;
        const bRatio = bLoad.max > 0 ? bLoad.assigned / bLoad.max : Number.POSITIVE_INFINITY;

        if (aRatio !== bRatio) return aRatio - bRatio;
        if (aLoad.assigned !== bLoad.assigned) return aLoad.assigned - bLoad.assigned;
        return String(a.faculty_name || "").localeCompare(String(b.faculty_name || ""));
      });
    }

    function tryAssign(section, subject, mode) {
      const facultyCandidates = subjectFacultyMap.get(subject.id) || [];
      const rooms = roomCandidatesFor(mode, section.student_strength);
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

      for (const slot of slots) {
        const sectionSlotKey = `${section.id}-${slot.id}`;
        if (sectionSlotUsed.has(sectionSlotKey)) {
          counters[CONFLICT_REASON.SECTION_CLASH] += 1;
          continue;
        }

        const rankedFaculty = rankFacultyCandidates(facultyCandidates);

        for (const faculty of rankedFaculty) {
          const facultyId = faculty.faculty_id;
          const load = facultyWorkloadMap.get(facultyId);
          if (!load || load.assigned >= load.max) {
            counters[CONFLICT_REASON.WORKLOAD_EXCEEDED] += 1;
            continue;
          }

          const facultySlotKey = `${facultyId}-${slot.id}`;
          if (facultySlotUsed.has(facultySlotKey)) {
            counters[CONFLICT_REASON.FACULTY_CLASH] += 1;
            continue;
          }

          for (const room of rooms) {
            const roomSlotKey = `${room.id}-${slot.id}`;
            if (roomSlotUsed.has(roomSlotKey)) {
              counters[CONFLICT_REASON.ROOM_CLASH] += 1;
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
                day_of_week: slot.day_of_week,
                slot_number: slot.slot_number,
              },
            };
          }
        }
      }

      return { success: false, reason: pickDominantReason(counters) };
    }

    const sessionRequests = [];
    for (const section of sectionsResult.rows) {
      for (const subject of subjectsResult.rows) {
        const demands = getSessionDemands(subject, totalWeeks, slotDurationMinutes);
        for (const demand of demands) {
          for (let i = 0; i < demand.count; i += 1) {
            sessionRequests.push({
              section,
              subject,
              mode: demand.mode,
              requested_per_week: demand.count,
            });
          }
        }
      }
    }

    sessionRequests.sort((a, b) => {
      const aPractical = a.mode === "Practical" ? 0 : 1;
      const bPractical = b.mode === "Practical" ? 0 : 1;
      if (aPractical !== bPractical) return aPractical - bPractical;

      const aStrength = Number(a.section.student_strength || 0);
      const bStrength = Number(b.section.student_strength || 0);
      if (aStrength !== bStrength) return bStrength - aStrength;

      const bySection = String(a.section.section_name || "").localeCompare(String(b.section.section_name || ""));
      if (bySection !== 0) return bySection;
      return String(a.subject.subject_name || "").localeCompare(String(b.subject.subject_name || ""));
    });

    for (const request of sessionRequests) {
      const assigned = tryAssign(request.section, request.subject, request.mode);
      if (assigned.success) {
        entries.push(assigned.entry);
      } else {
        const reasonLabel = CONFLICT_REASON_LABELS[assigned.reason] || CONFLICT_REASON_LABELS[CONFLICT_REASON.NO_SLOT_AVAILABLE];
        const summaryKey = conflictReasonToSummaryKey(assigned.reason);
        const conflictItem = `${request.section.section_name} - ${request.subject.subject_name}`;
        conflicts.push({
          section_id: request.section.id,
          section_name: request.section.section_name,
          subject_id: request.subject.id,
          subject_name: request.subject.subject_name,
          mode: request.mode,
          requested_per_week: request.requested_per_week,
          reason: reasonLabel,
          reason_key: assigned.reason,
        });
        conflictSummaryBuckets[summaryKey].add(conflictItem);
      }
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
      precheck_summary: buildPrecheckSummary(precheckStatus),
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
