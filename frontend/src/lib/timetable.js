import { formatTime } from "./format";
import { subjectColorFor } from "./theme";

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];
export const DAY_LABELS = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function normalizeDay(day) {
  const number = Number(day);
  return DAY_ORDER.includes(number) ? number : null;
}

export function createTimetableMatrix(entries = [], timeSlots = []) {
  const slotMap = new Map();
  const orderedSlots = [];

  timeSlots
    .slice()
    .sort((left, right) => {
      const dayDiff = Number(left.day_of_week) - Number(right.day_of_week);
      if (dayDiff !== 0) return dayDiff;
      return Number(left.slot_number) - Number(right.slot_number);
    })
    .forEach((slot) => {
      const day = normalizeDay(slot.day_of_week);
      const slotNumber = Number(slot.slot_number);
      if (!day || !slotNumber) return;
      const key = `${day}:${slotNumber}`;
      if (!slotMap.has(key)) {
        const cell = {
          key,
          day,
          slotNumber,
          startTime: slot.start_time,
          endTime: slot.end_time,
          entries: [],
        };
        slotMap.set(key, cell);
        orderedSlots.push(cell);
      }
    });

  entries.forEach((entry) => {
    const day = normalizeDay(entry.day_of_week);
    const slotNumber = Number(entry.slot_number);
    if (!day || !slotNumber) return;
    const key = `${day}:${slotNumber}`;
    if (!slotMap.has(key)) {
      const cell = {
        key,
        day,
        slotNumber,
        startTime: entry.start_time,
        endTime: entry.end_time,
        entries: [],
      };
      slotMap.set(key, cell);
      orderedSlots.push(cell);
    }
    slotMap.get(key).entries.push(entry);
  });

  orderedSlots.sort((left, right) => {
    if (left.slotNumber !== right.slotNumber) return left.slotNumber - right.slotNumber;
    return left.day - right.day;
  });

  const rowsBySlot = new Map();
  orderedSlots.forEach((cell) => {
    if (!rowsBySlot.has(cell.slotNumber)) {
      rowsBySlot.set(cell.slotNumber, {
        slotNumber: cell.slotNumber,
        startTime: cell.startTime,
        endTime: cell.endTime,
        cells: new Map(),
      });
    }
    rowsBySlot.get(cell.slotNumber).cells.set(cell.day, cell);
  });

  const rows = [...rowsBySlot.values()].sort((left, right) => left.slotNumber - right.slotNumber);

  return {
    rows,
    cells: orderedSlots,
  };
}

export function formatTimetableCell(entry) {
  if (!entry) return null;
  return {
    subject: entry.subject_name || entry.subject_code || "Untitled",
    subjectCode: entry.subject_code || "",
    faculty: entry.faculty_name || "Faculty",
    room: entry.room_number || "Room",
    mode: entry.session_mode || entry.subject_type || "Theory",
    section: entry.section_name || "",
    color: subjectColorFor(entry.subject_name || entry.subject_code || entry.id),
  };
}

export function summarizeTimetable(entries = []) {
  const uniqueSections = new Set();
  const uniqueSubjects = new Set();
  const uniqueRooms = new Set();
  entries.forEach((entry) => {
    if (entry.section_name) uniqueSections.add(entry.section_name);
    if (entry.subject_name) uniqueSubjects.add(entry.subject_name);
    if (entry.room_number) uniqueRooms.add(entry.room_number);
  });
  return {
    sectionCount: uniqueSections.size,
    subjectCount: uniqueSubjects.size,
    roomCount: uniqueRooms.size,
    entryCount: entries.length,
  };
}

export function dayLabel(day) {
  return DAY_LABELS[Number(day)] || "Day";
}

export function buildTimelineGroups(entries = []) {
  const groups = new Map();
  entries.forEach((entry) => {
    const day = normalizeDay(entry.day_of_week) || 0;
    if (!groups.has(day)) {
      groups.set(day, []);
    }
    groups.get(day).push(entry);
  });

  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([day, items]) => ({
      day,
      label: dayLabel(day),
      items: items.sort((left, right) => Number(left.slot_number) - Number(right.slot_number)),
    }));
}

export function getSlotLabel(slot) {
  if (!slot) return "—";
  const start = formatTime(slot.startTime || slot.start_time);
  const end = formatTime(slot.endTime || slot.end_time);
  if (start === "—" && end === "—") return `Slot ${slot.slotNumber}`;
  return `${start} - ${end}`;
}
