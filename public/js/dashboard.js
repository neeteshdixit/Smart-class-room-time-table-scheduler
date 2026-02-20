requireAuth();

const statsCards = document.getElementById("statsCards");
const entityCards = document.getElementById("entityCards");
const workloadTableBody = document.getElementById("workloadTableBody");
const roomTableBody = document.getElementById("roomTableBody");
const generationResult = document.getElementById("generationResult");
const semesterSelect = document.getElementById("semesterSelect");
const timetableHistoryBody = document.getElementById("timetableHistoryBody");
const timetableGridHeader = document.getElementById("timetableGridHeader");
const timetableGridContainer = document.getElementById("timetableGridContainer");
const timetableGridFooter = document.getElementById("timetableGridFooter");
const timetableSectionSelect = document.getElementById("timetableSectionSelect");
const activityList = document.getElementById("activityList");
const loadingOverlay = document.getElementById("loadingOverlay");
const statusToastEl = document.getElementById("statusToast");
const statusToastBody = document.getElementById("statusToastBody");
const entityFormBody = document.getElementById("entityFormBody");
const entityFormTitle = document.getElementById("entityFormTitle");
const entityInfoTitle = document.getElementById("entityInfoTitle");
const entityInfoHead = document.getElementById("entityInfoHead");
const entityInfoBody = document.getElementById("entityInfoBody");
const entityInfoSearch = document.getElementById("entityInfoSearch");
const activitySearch = document.getElementById("activitySearch");
const timetableHistorySearch = document.getElementById("timetableHistorySearch");
const historyPageLabel = document.getElementById("historyPageLabel");
const activityPageLabel = document.getElementById("activityPageLabel");
const entityInfoPageLabel = document.getElementById("entityInfoPageLabel");
const dashboardAlertId = "dashboardAlert";
const genericApiErrorMessage = "Something went wrong. Please try again.";
const operationFailedMessage = "Operation failed. Try again.";
const inFlightListRequests = new Map();

const bootstrapApi = window.bootstrap || null;

function createModal(id) {
  const el = document.getElementById(id);
  if (!el) {
    return { show() {}, hide() {} };
  }
  if (bootstrapApi?.Modal) {
    return new bootstrapApi.Modal(el);
  }
  return {
    show() {
      el.style.display = "block";
      el.classList.add("show");
    },
    hide() {
      el.style.display = "none";
      el.classList.remove("show");
    },
  };
}

const statusToast =
  statusToastEl && bootstrapApi?.Toast ? new bootstrapApi.Toast(statusToastEl, { delay: 2800 }) : null;
const formModal = createModal("entityFormModal");
const infoModal = createModal("entityInfoModal");

const state = {
  loadingCount: 0,
  activePanel: "summaryPanel",
  activityLoaded: false,
  currentFormResource: null,
  currentFormMode: "create",
  currentFormRecordId: null,
  returnToInfoAfterForm: false,
  history: { page: 1, limit: 8, total: 0, q: "", latestTimetableId: null },
  activity: { page: 1, limit: 10, total: 0, q: "" },
  info: { resource: null, page: 1, limit: 8, total: 0, q: "", rows: [] },
  timetableView: { detail: null, sectionId: null },
};

const entityOrder = [
  "departments",
  "branches",
  "sections",
  "blocks",
  "classrooms",
  "laboratories",
  "time_slots",
  "faculty",
  "subjects",
  "semesters",
];

const infoCrudResources = new Set(["departments", "branches", "sections", "faculty", "subjects", "semesters"]);

const entityConfig = {
  departments: {
    title: "Departments",
    endpoint: "/departments",
    fallbackEndpoint: "/master/departments",
    countKey: "departments",
    tone: "entity-tone-departments",
    addLabel: "Add Department",
    infoLabel: "See Departments Info",
    formFields: [
      { name: "department_name", label: "Department Name", type: "text", required: true },
      { name: "department_code", label: "Department Code", type: "text", required: true },
      { name: "hod_name", label: "HOD Name", type: "text" },
    ],
    columns: ["ID", "Name", "Code", "HOD"],
    mapRow: (row) => [row.id, row.department_name, row.department_code, row.hod_name || "-"],
  },
  branches: {
    title: "Branches",
    endpoint: "/branches",
    fallbackEndpoint: "/master/branches",
    countKey: "branches",
    tone: "entity-tone-branches",
    addLabel: "Add Branch",
    infoLabel: "See Branches Info",
    formFields: [
      { name: "branch_name", label: "Branch Name", type: "text", required: true },
      { name: "department_id", label: "Department", type: "select", optionsKey: "departments", required: true },
      { name: "branch_code", label: "Branch Code", type: "text", required: true },
    ],
    columns: ["ID", "Name", "Code", "Department"],
    mapRow: (row) => [row.id, row.branch_name, row.branch_code, row.department_name],
  },
  sections: {
    title: "Sections",
    endpoint: "/sections",
    fallbackEndpoint: "/master/sections",
    countKey: "sections",
    tone: "entity-tone-sections",
    addLabel: "Add Section",
    infoLabel: "See Sections Info",
    formFields: [
      { name: "section_name", label: "Section Name", type: "text", required: true },
      { name: "branch_id", label: "Branch", type: "select", optionsKey: "branches", required: true },
      { name: "semester_id", label: "Semester", type: "select", optionsKey: "semesters", required: true },
    ],
    columns: ["ID", "Section", "Branch", "Semester"],
    mapRow: (row) => [row.id, row.section_name, row.branch_name || "-", `${row.semester_number} (${row.academic_year})`],
  },
  blocks: {
    title: "Blocks",
    endpoint: "/master/blocks",
    countKey: "blocks",
    tone: "entity-tone-blocks",
    addLabel: "Add Block",
    infoLabel: "See Blocks Info",
    formFields: [
      { name: "block_name", label: "Block Name", type: "text", required: true },
      { name: "number_of_floors", label: "No. of Floors", type: "number", required: true, min: 1 },
    ],
    columns: ["ID", "Block", "Floors", "Created At"],
    mapRow: (row) => [row.id, row.block_name, row.number_of_floors, formatDateTime(row.created_at)],
  },
  classrooms: {
    title: "Classrooms",
    endpoint: "/master/classrooms",
    countKey: "classrooms",
    tone: "entity-tone-classrooms",
    addLabel: "Add Classroom",
    infoLabel: "See Classrooms Info",
    formFields: [
      { name: "room_number", label: "Room Number", type: "text", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true, min: 1 },
      { name: "block_id", label: "Block", type: "select", optionsKey: "blocks", required: true },
      { name: "floor_number", label: "Floor Number", type: "number", required: true, min: 0 },
      {
        name: "room_type",
        label: "Room Type",
        type: "select",
        required: true,
        staticOptions: [
          { value: "Lecture", label: "Lecture" },
          { value: "Lab", label: "Lab" },
        ],
      },
    ],
    columns: ["ID", "Room", "Capacity", "Block", "Floor", "Type"],
    mapRow: (row) => [row.id, row.room_number, row.capacity, row.block_id, row.floor_number, row.room_type],
  },
  laboratories: {
    title: "Labs",
    endpoint: "/master/laboratories",
    countKey: "labs",
    tone: "entity-tone-labs",
    addLabel: "Add Lab",
    infoLabel: "See Labs Info",
    formFields: [
      { name: "lab_name", label: "Lab Name", type: "text", required: true },
      { name: "department_id", label: "Department", type: "select", optionsKey: "departments", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true, min: 1 },
      { name: "equipment_type", label: "Equipment Type", type: "text" },
      { name: "lab_duration_preference", label: "Preferred Duration (min)", type: "number", min: 1 },
    ],
    columns: ["ID", "Lab", "Department ID", "Capacity", "Equipment"],
    mapRow: (row) => [row.id, row.lab_name, row.department_id, row.capacity, row.equipment_type || "-"],
  },
  time_slots: {
    title: "Time Slots",
    endpoint: "/master/time-slots",
    countKey: "time_slots",
    tone: "entity-tone-timeslots",
    addLabel: "Add Time Slot",
    infoLabel: "See Time Slots Info",
    formFields: [
      {
        name: "day_of_week",
        label: "Day",
        type: "select",
        required: true,
        staticOptions: [
          { value: "1", label: "Monday" },
          { value: "2", label: "Tuesday" },
          { value: "3", label: "Wednesday" },
          { value: "4", label: "Thursday" },
          { value: "5", label: "Friday" },
          { value: "6", label: "Saturday" },
          { value: "7", label: "Sunday" },
        ],
      },
      { name: "slot_number", label: "Slot Number", type: "number", required: true, min: 1 },
      { name: "start_time", label: "Start Time", type: "time", required: true },
      { name: "end_time", label: "End Time", type: "time", required: true },
    ],
    columns: ["ID", "Day", "Slot #", "Start", "End"],
    mapRow: (row) => [row.id, dayOfWeekLabel(row.day_of_week), row.slot_number, row.start_time, row.end_time],
  },
  faculty: {
    title: "Faculty",
    endpoint: "/faculty",
    fallbackEndpoint: "/master/faculty",
    countKey: "faculty",
    tone: "entity-tone-faculty",
    addLabel: "Add Faculty",
    infoLabel: "See Faculty Info",
    readOnly: true,
    addAction: "/signup.html",
    formFields: [
      { name: "faculty_id", label: "Faculty ID", type: "text", required: true },
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "mobile_number", label: "Mobile Number", type: "text", required: true },
    ],
    columns: ["ID", "Faculty ID", "Name", "Departments", "Subjects", "Registered"],
    mapRow: (row) => [
      row.id,
      row.faculty_id,
      row.full_name,
      row.departments,
      row.subjects,
      formatDateTime(row.created_at),
    ],
  },
  subjects: {
    title: "Subjects",
    endpoint: "/subjects",
    fallbackEndpoint: "/master/subjects",
    countKey: "subjects",
    tone: "entity-tone-subjects",
    addLabel: "Add Subject",
    infoLabel: "See Subjects Info",
    formFields: [
      { name: "subject_name", label: "Subject Name", type: "text", required: true },
      { name: "subject_code", label: "Subject Code", type: "text", required: true },
      { name: "department_id", label: "Department", type: "select", optionsKey: "departments", required: true },
      { name: "branch_id", label: "Branch", type: "select", optionsKey: "branches", required: true, dependsOn: "department_id" },
      { name: "semester_id", label: "Semester", type: "select", optionsKey: "semesters", required: true, dependsOn: "branch_id" },
      {
        name: "subject_type",
        label: "Type",
        type: "select",
        required: true,
        staticOptions: [
          { value: "Theory", label: "Theory" },
          { value: "Practical", label: "Practical" },
          { value: "Both", label: "Both" },
        ],
      },
    ],
    columns: ["ID", "Name", "Code", "Department", "Branch", "Semester", "Type"],
    mapRow: (row) => [
      row.id,
      row.subject_name,
      row.subject_code,
      row.department_name,
      row.branch_name,
      `${row.semester_number} (${row.academic_year})`,
      row.subject_type,
    ],
  },
  semesters: {
    title: "Semesters",
    endpoint: "/semesters",
    fallbackEndpoint: "/master/semesters",
    countKey: "semesters",
    tone: "entity-tone-semesters",
    addLabel: "Add Semester",
    infoLabel: "See Semester Info",
    formFields: [
      { name: "semester_number", label: "Semester Number", type: "number", required: true, min: 1, max: 10 },
      { name: "academic_year", label: "Academic Year", type: "text", required: true, placeholder: "2026-27" },
      { name: "branch_id", label: "Branch", type: "select", optionsKey: "branches", required: true },
    ],
    columns: ["ID", "Semester", "Academic Year", "Branch", "Department"],
    mapRow: (row) => [row.id, row.semester_number, row.academic_year, row.branch_name, row.department_name],
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function dayOfWeekLabel(day) {
  const map = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };
  return map[Number(day)] || String(day || "-");
}

function formatClockTime(value) {
  if (!value) return "-";
  const [hRaw, mRaw] = String(value).split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return String(value);
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function toTimeMinutes(value) {
  const [hRaw, mRaw] = String(value || "").split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function detectLunchInsertIndex(slotColumns) {
  if (!slotColumns.length) return 0;

  for (let i = 0; i < slotColumns.length - 1; i += 1) {
    const endCurrent = toTimeMinutes(slotColumns[i].end_time);
    const startNext = toTimeMinutes(slotColumns[i + 1].start_time);
    if (endCurrent !== null && startNext !== null && endCurrent <= 780 && startNext >= 780) {
      return i + 1;
    }
  }

  return Math.ceil(slotColumns.length / 2);
}

function renderTimetablePlaceholder(message = "Generate or select a timetable to view.") {
  if (timetableGridHeader) timetableGridHeader.innerHTML = "";
  if (timetableGridFooter) timetableGridFooter.innerHTML = "";
  if (timetableGridContainer) {
    timetableGridContainer.innerHTML = `<div class="text-secondary py-3 text-center">${escapeHtml(message)}</div>`;
  }
  if (timetableSectionSelect) {
    timetableSectionSelect.innerHTML = '<option value="">No section</option>';
    timetableSectionSelect.disabled = true;
  }
}

function buildTimetableCell(entry) {
  if (!entry) {
    return '<td><div class="timetable-cell text-secondary">-</div></td>';
  }

  const cellClass = String(entry.subject_type || "").toLowerCase() === "practical"
    ? "timetable-cell-practical"
    : "timetable-cell-theory";

  return `
    <td class="${cellClass}">
      <div class="timetable-cell">
        <div class="timetable-cell-code">${escapeHtml(entry.subject_code)}</div>
        <div class="timetable-cell-title">${escapeHtml(entry.subject_name)}</div>
        <div class="timetable-cell-detail">${escapeHtml(entry.faculty_name)}</div>
        <div class="timetable-cell-room">${escapeHtml(entry.room_number)}</div>
      </div>
    </td>
  `;
}

function renderTimetableGrid(detail, preferredSectionId = null) {
  if (!detail || !timetableGridContainer) {
    renderTimetablePlaceholder();
    return;
  }

  const entries = Array.isArray(detail.entries) ? detail.entries : [];
  const allSections = Array.from(
    new Map(entries.map((entry) => [entry.section_id, entry.section_name])).entries()
  ).map(([id, name]) => ({ id: Number(id), name }));

  if (!allSections.length) {
    renderTimetablePlaceholder("No timetable entries found for this version.");
    return;
  }

  let selectedSectionId = Number(preferredSectionId || state.timetableView.sectionId || allSections[0].id);
  if (!allSections.some((section) => section.id === selectedSectionId)) {
    selectedSectionId = allSections[0].id;
  }
  state.timetableView.sectionId = selectedSectionId;
  state.timetableView.detail = detail;

  if (timetableSectionSelect) {
    timetableSectionSelect.disabled = false;
    timetableSectionSelect.innerHTML = allSections
      .map((section) => `<option value="${section.id}">${escapeHtml(section.name)}</option>`)
      .join("");
    timetableSectionSelect.value = String(selectedSectionId);
  }

  const sectionEntries = entries.filter((entry) => Number(entry.section_id) === selectedSectionId);
  const sectionName = allSections.find((section) => section.id === selectedSectionId)?.name || "Section";
  const timeSlots = Array.isArray(detail.time_slots) ? detail.time_slots : [];

  const slotColumns = Array.from(
    new Map(
      timeSlots
        .map((slot) => [Number(slot.slot_number), slot])
        .sort((a, b) => a[0] - b[0])
    ).values()
  ).sort((a, b) => Number(a.slot_number) - Number(b.slot_number));

  if (!slotColumns.length) {
    renderTimetablePlaceholder("No time slots configured.");
    return;
  }

  const lunchInsertIndex = detectLunchInsertIndex(slotColumns);
  const timeSlotByDayAndNumber = new Map(
    timeSlots.map((slot) => [`${slot.day_of_week}-${slot.slot_number}`, slot])
  );
  const entryByTimeslotId = new Map(
    sectionEntries.map((entry) => [Number(entry.timeslot_id), entry])
  );

  const headerCells = slotColumns
    .map((slot, index) => {
      const header = `
        <th class="timetable-slot-col">
          <div>${escapeHtml(slot.slot_number)}</div>
          <div class="small fw-normal">${escapeHtml(formatClockTime(slot.start_time))} - ${escapeHtml(formatClockTime(slot.end_time))}</div>
        </th>
      `;
      if (index === lunchInsertIndex - 1) {
        return `${header}<th class="timetable-lunch-col">Lunch Break</th>`;
      }
      return header;
    })
    .join("");

  const dayRows = [
    { id: 1, label: "Mo" },
    { id: 2, label: "Tu" },
    { id: 3, label: "We" },
    { id: 4, label: "Th" },
    { id: 5, label: "Fr" },
  ]
    .map((day) => {
      const cells = slotColumns
        .map((slot, index) => {
          const daySlot = timeSlotByDayAndNumber.get(`${day.id}-${slot.slot_number}`);
          const entry = daySlot ? entryByTimeslotId.get(Number(daySlot.id)) : null;
          const cellHtml = buildTimetableCell(entry);
          if (index === lunchInsertIndex - 1) {
            return `${cellHtml}<td class="timetable-lunch-col">LUNCH</td>`;
          }
          return cellHtml;
        })
        .join("");
      return `
        <tr>
          <td class="timetable-day-col">${escapeHtml(day.label)}</td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  if (timetableGridHeader) {
    timetableGridHeader.innerHTML = `
      <div class="timetable-session-title">Session ${escapeHtml(detail.timetable.academic_year || "-")}</div>
      <div class="timetable-program-title">Semester ${escapeHtml(detail.timetable.semester_number || "-")} (${escapeHtml(sectionName)})</div>
      <div class="small text-secondary">${escapeHtml(detail.timetable.department_name || "-")} | ${escapeHtml(detail.timetable.branch_name || "-")}</div>
    `;
  }

  timetableGridContainer.innerHTML = `
    <table class="table table-bordered timetable-grid-table mb-0">
      <thead>
        <tr>
          <th class="timetable-day-col">Day</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${dayRows}
      </tbody>
    </table>
  `;

  if (timetableGridFooter) {
    timetableGridFooter.innerHTML = `
      <span>Generated: ${escapeHtml(formatDateTime(detail.timetable.created_at))}</span>
      <span>Smart Classroom Timetable Scheduler</span>
    `;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(window.atob(padded));
  } catch (err) {
    return null;
  }
}

function isAdminUser() {
  const payload = decodeJwtPayload(getAuthToken());
  return String(payload?.role || "").toLowerCase() === "admin";
}

function updateLoadingState(delta) {
  state.loadingCount = Math.max(0, state.loadingCount + delta);
  if (!loadingOverlay) return;
  loadingOverlay.classList.toggle("d-none", state.loadingCount === 0);
}

async function withLoading(action) {
  updateLoadingState(1);
  try {
    return await action();
  } finally {
    updateLoadingState(-1);
  }
}

function showToast(message, type = "success") {
  if (!statusToastEl) return;
  if (!statusToast) {
    showAlert(dashboardAlertId, message, type === "danger" ? "danger" : "success");
    return;
  }
  statusToastEl.className = `toast align-items-center text-bg-${type} border-0`;
  statusToastBody.textContent = message;
  statusToast.show();
}

function getRequestErrorMessage(err) {
  const message = String(err?.message || "").trim();
  return message && message.toLowerCase() !== "request failed" ? message : genericApiErrorMessage;
}

function handleRequestError(err) {
  if (String(err.message || "").toLowerCase().includes("token")) {
    logout();
    return;
  }
  const message = getRequestErrorMessage(err);
  showAlert(dashboardAlertId, message);
  showToast(message, "danger");
}

function getOperationErrorMessage(err) {
  const message = String(err?.message || "").trim();
  if (!message || message.toLowerCase() === "request failed") {
    return operationFailedMessage;
  }
  return message;
}

function canManageInfoResource(resourceKey) {
  return isAdminUser() && infoCrudResources.has(resourceKey);
}

function renderTableRows(target, rows, formatter, emptyColspan = 6) {
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="${emptyColspan}" class="text-secondary">No data</td></tr>`;
    return;
  }
  target.innerHTML = rows.map(formatter).join("");
}

function buildStatsCards(totals) {
  if (!statsCards) return;
  const cards = [
    ["Departments", totals.departments],
    ["Branches", totals.branches],
    ["Sections", totals.sections],
    ["Faculty", totals.faculty],
    ["Classrooms", totals.classrooms],
    ["Labs", totals.labs],
    ["Subjects", totals.subjects],
    ["Semesters", totals.semesters],
  ];

  statsCards.innerHTML = cards
    .map(
      ([title, value]) => `
        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card h-100">
            <div class="card-body">
              <small class="text-secondary">${escapeHtml(title)}</small>
              <div class="stat-value">${escapeHtml(value ?? 0)}</div>
            </div>
          </div>
        </div>`
    )
    .join("");
}

function renderEntityCards(totals) {
  if (!entityCards) return;
  entityCards.innerHTML = entityOrder
    .map((key) => {
      const config = entityConfig[key];
      const countValue = totals[config.countKey] ?? 0;

      return `
        <div class="col-md-6 col-xl-4">
          <div class="entity-card ${config.tone}">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h5 class="mb-0">${escapeHtml(config.title)}</h5>
              <span class="entity-count" id="entity-count-${escapeHtml(key)}">${escapeHtml(countValue)}</span>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-light btn-sm flex-fill" data-entity-action="add" data-entity-key="${escapeHtml(
                key
              )}">
                ${escapeHtml(config.addLabel)}
              </button>
              <button type="button" class="btn btn-outline-dark btn-sm flex-fill" data-entity-action="info" data-entity-key="${escapeHtml(
                key
              )}">
                ${escapeHtml(config.infoLabel)}
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function updateEntityCounts(totals) {
  if (!entityCards) return;
  entityOrder.forEach((key) => {
    const config = entityConfig[key];
    const el = document.getElementById(`entity-count-${key}`);
    if (el) {
      el.textContent = String(totals[config.countKey] ?? 0);
    }
  });
}

async function loadSummary() {
  const stats = await apiRequest("/stats", { headers: authHeaders() });
  buildStatsCards(stats.totals);
  if (entityCards && !entityCards.innerHTML.trim()) {
    renderEntityCards(stats.totals);
  } else {
    updateEntityCounts(stats.totals);
  }
}

async function loadReports() {
  const [workload, rooms] = await Promise.all([
    apiRequest("/timetable/reports/workload", { headers: authHeaders() }),
    apiRequest("/timetable/reports/room-utilization", { headers: authHeaders() }),
  ]);

  if (workloadTableBody) {
    renderTableRows(
      workloadTableBody,
      workload.data.slice(0, 12),
      (row) =>
        `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.assigned_slots)}</td><td>${escapeHtml(
          row.max_workload_per_week
        )}</td></tr>`,
      3
    );
  }

  if (roomTableBody) {
    renderTableRows(
      roomTableBody,
      rooms.data.slice(0, 12),
      (row) =>
        `<tr><td>${escapeHtml(row.room_number)}</td><td>${escapeHtml(row.room_type)}</td><td>${escapeHtml(
          row.used_slots
        )}</td></tr>`,
      3
    );
  }
}

async function fetchList(endpoint, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  const path = `${endpoint}${qs ? `?${qs}` : ""}`;
  if (inFlightListRequests.has(path)) {
    return inFlightListRequests.get(path);
  }

  const request = apiRequest(path, { headers: authHeaders() }).finally(() => {
    if (inFlightListRequests.get(path) === request) {
      inFlightListRequests.delete(path);
    }
  });

  inFlightListRequests.set(path, request);
  return request;
}

async function fetchListWithFallback(endpoint, fallbackEndpoint, params = {}) {
  try {
    return await fetchList(endpoint, params);
  } catch (err) {
    const shouldTryFallback =
      Boolean(fallbackEndpoint) && (typeof err.status !== "number" || err.status === 404);

    if (!shouldTryFallback) {
      throw err;
    }
    return fetchList(fallbackEndpoint, params);
  }
}

async function getFormOptions(resourceKey) {
  const config = entityConfig[resourceKey];
  if (!config?.formFields) {
    return {};
  }

  const keys = [...new Set(config.formFields.filter((f) => f.optionsKey).map((f) => f.optionsKey))];
  const optionMap = {};

  await Promise.all(
    keys.map(async (key) => {
      if (key === "departments") {
        const result = await fetchListWithFallback("/departments", "/master/departments", {
          page: 1,
          limit: 200,
        });
        optionMap.departments = result.data;
      } else if (key === "branches") {
        const result = await fetchListWithFallback("/branches", "/master/branches", {
          page: 1,
          limit: 300,
        });
        optionMap.branches = result.data;
      } else if (key === "semesters") {
        const result = await fetchListWithFallback("/semesters", "/master/semesters", {
          page: 1,
          limit: 300,
        });
        optionMap.semesters = result.data;
      } else if (key === "blocks") {
        const result = await fetchList("/master/blocks", { page: 1, limit: 300 });
        optionMap.blocks = result.data;
      }
    })
  );

  return optionMap;
}

function buildOptionsHtml(field, optionsByKey) {
  if (field.staticOptions) {
    return field.staticOptions
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
  }

  const list = optionsByKey[field.optionsKey] || [];
  if (field.optionsKey === "departments") {
    return list
      .map((item) => `<option value="${item.id}">${escapeHtml(item.department_name)} (${escapeHtml(item.department_code)})</option>`)
      .join("");
  }
  if (field.optionsKey === "branches") {
    return list
      .map(
        (item) =>
          `<option value="${item.id}" data-department-id="${item.department_id}">${escapeHtml(item.branch_name)} (${escapeHtml(
            item.branch_code
          )})</option>`
      )
      .join("");
  }
  if (field.optionsKey === "semesters") {
    return list
      .map(
        (item) =>
          `<option value="${item.id}" data-branch-id="${item.branch_id}">Sem ${escapeHtml(
            item.semester_number
          )} - ${escapeHtml(item.academic_year)} (${escapeHtml(item.branch_name)})</option>`
      )
      .join("");
  }
  if (field.optionsKey === "blocks") {
    return list
      .map((item) => `<option value="${item.id}">${escapeHtml(item.block_name)} (Floors: ${escapeHtml(item.number_of_floors)})</option>`)
      .join("");
  }
  return "";
}

function renderForm(resourceKey, optionsByKey) {
  if (!entityFormBody || !entityFormTitle) return;
  const config = entityConfig[resourceKey];
  entityFormTitle.textContent = state.currentFormMode === "edit" ? `Edit ${config.title}` : config.addLabel;

  entityFormBody.innerHTML = config.formFields
    .map((field) => {
      const required = field.required ? "required" : "";
      if (field.type === "select") {
        return `
          <div class="col-md-6">
            <label class="form-label">${escapeHtml(field.label)}</label>
            <select class="form-select" name="${escapeHtml(field.name)}" ${required}>
              <option value="">Select ${escapeHtml(field.label)}</option>
              ${buildOptionsHtml(field, optionsByKey)}
            </select>
          </div>
        `;
      }

      const minAttr = field.min !== undefined ? `min="${field.min}"` : "";
      const maxAttr = field.max !== undefined ? `max="${field.max}"` : "";
      const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "";
      return `
        <div class="col-md-6">
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input class="form-control" type="${escapeHtml(field.type)}" name="${escapeHtml(field.name)}" ${required} ${placeholder} ${minAttr} ${maxAttr} />
        </div>
      `;
    })
    .join("");

  const yearInput = entityFormBody.querySelector('input[name="academic_year"]');
  if (yearInput && !yearInput.value) {
    const year = new Date().getFullYear();
    yearInput.value = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  }

  const submitBtn = document.getElementById("entitySubmitBtn");
  if (submitBtn) {
    submitBtn.textContent = state.currentFormMode === "edit" ? "Update" : "Save";
  }

  bindDependentFormFilters(resourceKey);
}

function filterOptions(selectEl, dataKey, parentValue) {
  if (!selectEl) return;
  const options = [...selectEl.options].slice(1);
  options.forEach((option) => {
    const matches = !parentValue || String(option.dataset[dataKey] || "") === String(parentValue);
    option.hidden = !matches;
  });

  if (selectEl.value) {
    const selected = selectEl.options[selectEl.selectedIndex];
    if (selected && selected.hidden) {
      selectEl.value = "";
    }
  }
}

function bindDependentFormFilters(resourceKey) {
  if (!entityFormBody) return;
  if (resourceKey === "sections") {
    const branchSelect = entityFormBody.querySelector('select[name="branch_id"]');
    const semesterSelectEl = entityFormBody.querySelector('select[name="semester_id"]');
    if (branchSelect && semesterSelectEl) {
      const apply = () => filterOptions(semesterSelectEl, "branchId", branchSelect.value);
      branchSelect.addEventListener("change", apply);
      apply();
    }
    return;
  }

  if (resourceKey === "subjects") {
    const departmentSelect = entityFormBody.querySelector('select[name="department_id"]');
    const branchSelect = entityFormBody.querySelector('select[name="branch_id"]');
    const semesterSelectEl = entityFormBody.querySelector('select[name="semester_id"]');

    const applyBranch = () => {
      filterOptions(branchSelect, "departmentId", departmentSelect.value);
      filterOptions(semesterSelectEl, "branchId", branchSelect.value);
    };

    const applySemester = () => filterOptions(semesterSelectEl, "branchId", branchSelect.value);

    if (departmentSelect && branchSelect) {
      departmentSelect.addEventListener("change", applyBranch);
    }
    if (branchSelect && semesterSelectEl) {
      branchSelect.addEventListener("change", applySemester);
    }
    applyBranch();
  }
}

function normalizePayload(resourceKey, payload) {
  const converted = { ...payload };

  const toIntKeys = {
    branches: ["department_id"],
    sections: ["branch_id", "semester_id"],
    blocks: ["number_of_floors"],
    classrooms: ["capacity", "block_id", "floor_number"],
    laboratories: ["department_id", "capacity", "lab_duration_preference"],
    time_slots: ["day_of_week", "slot_number"],
    subjects: ["department_id", "branch_id", "semester_id"],
    semesters: ["branch_id", "semester_number"],
  };

  (toIntKeys[resourceKey] || []).forEach((key) => {
    if (converted[key] !== undefined) {
      if (converted[key] === "") {
        delete converted[key];
      } else {
        converted[key] = Number(converted[key]);
      }
    }
  });

  return converted;
}

function setEntityFormFieldValue(fieldName, value, triggerChange = false) {
  if (!entityFormBody) return;
  const field = entityFormBody.querySelector(`[name="${fieldName}"]`);
  if (!field) return;
  field.value = value === undefined || value === null ? "" : String(value);
  if (triggerChange && field.tagName === "SELECT") {
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function populateEntityForm(resourceKey, row) {
  const config = entityConfig[resourceKey];
  if (!config?.formFields || !entityFormBody) return;

  if (resourceKey === "subjects") {
    setEntityFormFieldValue("department_id", row.department_id, true);
    setEntityFormFieldValue("branch_id", row.branch_id, true);
    setEntityFormFieldValue("semester_id", row.semester_id, true);
  } else if (resourceKey === "sections") {
    setEntityFormFieldValue("branch_id", row.branch_id, true);
    setEntityFormFieldValue("semester_id", row.semester_id, true);
  }

  config.formFields.forEach((field) => {
    if (resourceKey === "subjects" && ["department_id", "branch_id", "semester_id"].includes(field.name)) {
      return;
    }
    if (resourceKey === "sections" && ["branch_id", "semester_id"].includes(field.name)) {
      return;
    }
    setEntityFormFieldValue(field.name, row[field.name]);
  });
}

function closeEntityForm({ restoreInfoModal = false } = {}) {
  const shouldRestoreInfo =
    restoreInfoModal &&
    state.currentFormMode === "edit" &&
    state.returnToInfoAfterForm &&
    Boolean(state.info.resource);

  const entityForm = document.getElementById("entityForm");
  if (entityForm) {
    entityForm.reset();
  }
  hideAlert(dashboardAlertId);

  state.currentFormResource = null;
  state.currentFormMode = "create";
  state.currentFormRecordId = null;
  state.returnToInfoAfterForm = false;

  formModal.hide();
  if (shouldRestoreInfo) {
    infoModal.show();
  }
}

function closeEntityInfoModal() {
  infoModal.hide();
}

async function openEntityForm(resourceKey) {
  const config = entityConfig[resourceKey];
  if (config.readOnly && config.addAction) {
    window.location.href = config.addAction;
    return;
  }

  if (!entityFormBody || !entityFormTitle) {
    showAlert(dashboardAlertId, "Form modal is not available on this page.");
    return;
  }

  hideAlert(dashboardAlertId);
  state.currentFormResource = resourceKey;
  state.currentFormMode = "create";
  state.currentFormRecordId = null;
  state.returnToInfoAfterForm = false;

  const optionsByKey = await getFormOptions(resourceKey);
  renderForm(resourceKey, optionsByKey);
  formModal.show();
}

async function openEntityEditForm(resourceKey, recordId) {
  const config = entityConfig[resourceKey];
  if (!config?.formFields) {
    showToast(operationFailedMessage, "danger");
    return;
  }

  const normalizedId = Number(recordId);
  const row = state.info.rows.find((item) => Number(item.id) === normalizedId);
  if (!row) {
    showToast(operationFailedMessage, "danger");
    return;
  }

  hideAlert(dashboardAlertId);
  state.currentFormResource = resourceKey;
  state.currentFormMode = "edit";
  state.currentFormRecordId = normalizedId;
  state.returnToInfoAfterForm = true;

  const optionsByKey = await getFormOptions(resourceKey);
  renderForm(resourceKey, optionsByKey);
  populateEntityForm(resourceKey, row);
  closeEntityInfoModal();
  formModal.show();
}

function renderEntityInfoTableHeader(resourceKey) {
  if (!entityInfoHead) return;
  const config = entityConfig[resourceKey];
  const showActions = canManageInfoResource(resourceKey);
  entityInfoHead.innerHTML = `
    <tr>
      ${config.columns.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}
      ${showActions ? '<th class="text-end">Actions</th>' : ""}
    </tr>
  `;
}

function renderEntityInfoRows(resourceKey, rows) {
  if (!entityInfoBody) return;
  const config = entityConfig[resourceKey];
  const showActions = canManageInfoResource(resourceKey);
  const colspan = config.columns.length + (showActions ? 1 : 0);

  if (!rows.length) {
    entityInfoBody.innerHTML = `<tr><td colspan="${colspan}" class="text-secondary">No records found.</td></tr>`;
    return;
  }

  entityInfoBody.innerHTML = rows
    .map((row) => {
      const values = config.mapRow(row).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      const actions = showActions
        ? `
          <td class="text-end">
            <div class="d-flex justify-content-end flex-wrap gap-1">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm"
                data-entity-row-action="edit"
                data-entity-row-id="${escapeHtml(row.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-outline-danger btn-sm"
                data-entity-row-action="delete"
                data-entity-row-id="${escapeHtml(row.id)}"
              >
                Delete
              </button>
            </div>
          </td>
        `
        : "";

      return `<tr>${values}${actions}</tr>`;
    })
    .join("");
}

function renderEntityInfoLoading(resourceKey) {
  if (!entityInfoBody) return;
  const config = entityConfig[resourceKey];
  if (!config) return;
  const colspan = config.columns.length + (canManageInfoResource(resourceKey) ? 1 : 0);
  entityInfoBody.innerHTML = `<tr><td colspan="${colspan}" class="text-secondary">Loading...</td></tr>`;
}

function updatePager({ page, limit, total }, labelEl, prevBtnId, nextBtnId) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (labelEl) {
    labelEl.textContent = `Page ${page} of ${totalPages}`;
  }

  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

async function loadEntityInfo() {
  const { resource, page, limit, q } = state.info;
  const config = entityConfig[resource];
  if (!config || !entityInfoBody) return;

  const result = await fetchListWithFallback(config.endpoint, config.fallbackEndpoint, {
    page,
    limit,
    q,
  });
  const resultData = Array.isArray(result?.data) ? result.data : [];
  const resultPagination = result?.pagination || {};
  const resolvedPage = Number(resultPagination.page) || page;
  const resolvedLimit = Number(resultPagination.limit) || limit;
  const resolvedTotal = Number(resultPagination.total);

  state.info.total = Number.isFinite(resolvedTotal) ? resolvedTotal : resultData.length;
  state.info.rows = resultData;

  renderEntityInfoRows(resource, resultData);
  updatePager(
    { page: resolvedPage, limit: resolvedLimit, total: state.info.total },
    entityInfoPageLabel,
    "entityInfoPrev",
    "entityInfoNext"
  );
}

async function openEntityInfo(resourceKey) {
  if (!entityConfig[resourceKey]) return;

  state.info.resource = resourceKey;
  state.info.page = 1;
  state.info.q = "";
  state.info.rows = [];

  if (entityInfoSearch) {
    entityInfoSearch.value = "";
  }
  if (entityInfoTitle) {
    entityInfoTitle.textContent = entityConfig[resourceKey].infoLabel;
  }
  renderEntityInfoTableHeader(resourceKey);
  renderEntityInfoLoading(resourceKey);
  infoModal.show();
  await loadEntityInfo();
}

async function deleteEntityRecord(resourceKey, recordId) {
  const config = entityConfig[resourceKey];
  if (!config) {
    throw new Error(operationFailedMessage);
  }

  await apiRequest(`${config.endpoint}/${recordId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportEntityInfoCsv() {
  const config = entityConfig[state.info.resource];
  if (!config || !state.info.rows.length) {
    showToast("No data available for export", "warning");
    return;
  }

  const header = config.columns.map(csvEscape).join(",");
  const body = state.info.rows
    .map((row) => config.mapRow(row).map((value) => csvEscape(value)).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.info.resource}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadSemesterOptionsForGenerator() {
  if (!semesterSelect) return;
  const semesters = await fetchListWithFallback("/semesters", "/master/semesters", {
    page: 1,
    limit: 200,
  });
  const options = semesters.data
    .map(
      (row) =>
        `<option value="${row.id}">Semester ${escapeHtml(row.semester_number)} - ${escapeHtml(row.academic_year)} (${escapeHtml(
          row.branch_name
        )})</option>`
    )
    .join("");

  semesterSelect.innerHTML = options || '<option value="">No semesters available</option>';
}

async function loadTimetableHistory() {
  if (!timetableHistoryBody) return;
  const result = await fetchList("/timetable-history", {
    page: state.history.page,
    limit: state.history.limit,
    q: state.history.q,
  });

  state.history.total = result.pagination.total;
  state.history.latestTimetableId = Number(result.data?.[0]?.timetable_id || 0) || null;

  renderTableRows(
    timetableHistoryBody,
    result.data,
    (row) => `
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.version_name)}</td>
        <td>${escapeHtml(row.semester_number)} (${escapeHtml(row.academic_year)})</td>
        <td>${escapeHtml(formatDateTime(row.created_at))}</td>
        <td><a class="btn btn-outline-primary btn-sm" href="${escapeHtml(row.pdf_path)}" target="_blank" rel="noopener">Download PDF</a></td>
        <td>
          ${
            row.timetable_id
              ? `<button type="button" class="btn btn-outline-secondary btn-sm" data-view-timetable-id="${escapeHtml(
                  row.timetable_id
                )}">View Grid</button>`
              : '<span class="text-secondary small">N/A</span>'
          }
        </td>
      </tr>`,
    6
  );

  updatePager(
    { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.total },
    historyPageLabel,
    "historyPrev",
    "historyNext"
  );
}

async function loadTimetableDetails(timetableId, preferredSectionId = null) {
  const detail = await apiRequest(`/timetable/${timetableId}`, {
    headers: authHeaders(),
  });
  renderTimetableGrid(detail, preferredSectionId);
}

async function loadActivityLog() {
  if (!activityList) return;
  const result = await fetchList("/activity-log", {
    page: state.activity.page,
    limit: state.activity.limit,
    q: state.activity.q,
  });

  state.activity.total = result.pagination.total;
  state.activityLoaded = true;

  if (!result.data.length) {
    activityList.innerHTML = '<li class="list-group-item text-secondary">No recent activity found.</li>';
  } else {
    const canDelete = isAdminUser();
    activityList.innerHTML = result.data
      .map(
        (item) => `
          <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-semibold">${escapeHtml(item.action_type)}</div>
                <div class="small text-secondary">${escapeHtml(item.details || "-")}</div>
                <div class="small text-muted">${escapeHtml(item.actor_name || "System")} | ${escapeHtml(
                  formatDateTime(item.created_at)
                )}</div>
              </div>
              ${
                canDelete
                  ? `<button type="button" class="btn btn-outline-danger btn-sm" data-delete-activity-id="${escapeHtml(
                      item.id
                    )}">Delete</button>`
                  : ""
              }
            </div>
          </li>`
      )
      .join("");
  }

  updatePager(
    { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.total },
    activityPageLabel,
    "activityPrev",
    "activityNext"
  );
}

async function refreshSummaryCounts() {
  try {
    await loadSummary();
  } catch (err) {
    // avoid disrupting the page for background refreshes
  }
}

function switchPanel(panelId) {
  state.activePanel = panelId;

  document.querySelectorAll(".dashboard-panel").forEach((panel) => {
    panel.classList.toggle("d-none", panel.id !== panelId);
  });

  document.querySelectorAll(".dashboard-tab-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tabTarget === panelId);
  });

  if (panelId === "activityPanel" && !state.activityLoaded) {
    withLoading(loadActivityLog).catch(handleRequestError);
  }

  if (panelId === "timetablePanel" && !state.timetableView.detail && state.history.latestTimetableId) {
    withLoading(() => loadTimetableDetails(state.history.latestTimetableId)).catch(handleRequestError);
  }
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", handler);
  }
}

function bindEntityFormCloseActions() {
  document.querySelectorAll("[data-entity-form-close]").forEach((button) => {
    if (button.dataset.formCloseBound === "true") return;
    button.dataset.formCloseBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeEntityForm({ restoreInfoModal: true });
    });
  });
}

function bindEntityInfoCloseActions() {
  document.querySelectorAll("[data-entity-info-close]").forEach((button) => {
    if (button.dataset.infoCloseBound === "true") return;
    button.dataset.infoCloseBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeEntityInfoModal();
    });
  });
}

bindEntityFormCloseActions();
bindEntityInfoCloseActions();

document.querySelectorAll(".dashboard-tab-link").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.tabTarget));
});

if (entityCards) {
  entityCards.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-entity-action]");
    if (!trigger) return;

    const action = trigger.dataset.entityAction;
    const key = trigger.dataset.entityKey;
    if (!entityConfig[key]) return;

    if (action === "add") {
      withLoading(() => openEntityForm(key)).catch(handleRequestError);
    } else if (action === "info") {
      withLoading(() => openEntityInfo(key)).catch(handleRequestError);
    }
  });
}

const entityForm = document.getElementById("entityForm");
if (entityForm) {
  entityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(dashboardAlertId);

    const resource = state.currentFormResource;
    const mode = state.currentFormMode;
    const recordId = state.currentFormRecordId;
    if (!resource || !entityConfig[resource]) return;

    const formData = new FormData(entityForm);
    const payload = normalizePayload(resource, Object.fromEntries(formData.entries()));
    const submitBtn = document.getElementById("entitySubmitBtn");
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = mode === "edit" ? "Updating..." : "Saving...";

    try {
      const endpoint = mode === "edit" ? `${entityConfig[resource].endpoint}/${recordId}` : entityConfig[resource].endpoint;
      const method = mode === "edit" ? "PUT" : "POST";

      if (mode === "edit" && (!Number.isInteger(recordId) || recordId <= 0)) {
        throw new Error(operationFailedMessage);
      }

      await withLoading(() =>
        apiRequest(endpoint, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(payload),
        })
      );

      if (mode === "edit") {
        await withLoading(async () => {
          if (state.info.resource === resource) {
            await loadEntityInfo();
          }
          if (resource === "semesters" || resource === "branches") {
            await loadSemesterOptionsForGenerator();
          }
        });

        closeEntityForm({ restoreInfoModal: true });
        showToast("Updated successfully", "success");
      } else {
        closeEntityForm();
        showToast(`${entityConfig[resource].title} saved successfully.`, "success");

        await withLoading(async () => {
          await loadSummary();
          if (state.info.resource === resource) {
            await loadEntityInfo();
          }
          if (resource === "semesters" || resource === "branches") {
            await loadSemesterOptionsForGenerator();
          }
        });
      }
    } catch (err) {
      const message = mode === "edit" ? getOperationErrorMessage(err) : getRequestErrorMessage(err);
      showAlert(dashboardAlertId, message);
      showToast(message, "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "edit" ? "Update" : "Save";
    }
  });
}

if (entityInfoSearch) {
  entityInfoSearch.addEventListener(
    "input",
    debounce(() => {
      state.info.q = entityInfoSearch.value.trim();
      state.info.page = 1;
      withLoading(loadEntityInfo).catch(handleRequestError);
    }, 300)
  );
}

bindClick("entityInfoPrev", () => {
  state.info.page = Math.max(1, state.info.page - 1);
  withLoading(loadEntityInfo).catch(handleRequestError);
});

bindClick("entityInfoNext", () => {
  const maxPage = Math.max(1, Math.ceil(state.info.total / state.info.limit));
  state.info.page = Math.min(maxPage, state.info.page + 1);
  withLoading(loadEntityInfo).catch(handleRequestError);
});

bindClick("entityExportBtn", exportEntityInfoCsv);

if (entityInfoBody) {
  entityInfoBody.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("[data-entity-row-action]");
    if (!actionBtn) return;

    const resourceKey = state.info.resource;
    const config = entityConfig[resourceKey];
    if (!config || !canManageInfoResource(resourceKey)) return;

    const action = actionBtn.dataset.entityRowAction;
    const recordId = Number(actionBtn.dataset.entityRowId);
    if (!Number.isInteger(recordId) || recordId <= 0) return;

    if (action === "edit") {
      try {
        await withLoading(() => openEntityEditForm(resourceKey, recordId));
      } catch (err) {
        const message = getOperationErrorMessage(err);
        showToast(message, "danger");
      }
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Are you sure you want to delete this record?");
      if (!confirmed) return;

      try {
        await withLoading(() => deleteEntityRecord(resourceKey, recordId));
        showToast("Deleted successfully", "success");

        const projectedTotal = Math.max(0, state.info.total - 1);
        const projectedMaxPage = Math.max(1, Math.ceil(projectedTotal / state.info.limit));
        if (state.info.page > projectedMaxPage) {
          state.info.page = projectedMaxPage;
        }

        await withLoading(async () => {
          await loadEntityInfo();
          await loadSummary();
          if (resourceKey === "branches" || resourceKey === "semesters") {
            await loadSemesterOptionsForGenerator();
          }
        });
      } catch (err) {
        const message = getOperationErrorMessage(err);
        showToast(message, "danger");
      }
    }
  });
}

const generateForm = document.getElementById("generateTimetableForm");
const generateBtn = document.getElementById("generateBtn");
if (generateForm && generateBtn && generationResult) {
  generateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(dashboardAlertId);
    generationResult.innerHTML = "";

    const payload = Object.fromEntries(new FormData(generateForm).entries());
    payload.semester_id = Number(payload.semester_id);

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
      const result = await withLoading(() =>
        apiRequest("/generate-timetable", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        })
      );

      generationResult.innerHTML = `
        <div class="alert alert-success">
          Timetable generated. Assigned entries: <strong>${escapeHtml(result.assigned_entries)}</strong>,
          Conflicts: <strong>${escapeHtml(result.conflicts_count)}</strong>.
          ${
            result.pdf_path
              ? `<div class="mt-2"><a class="btn btn-outline-success btn-sm" href="${escapeHtml(
                  result.pdf_path
                )}" target="_blank" rel="noopener">Download PDF</a></div>`
              : ""
          }
        </div>
      `;

      if (Array.isArray(result.conflicts) && result.conflicts.length > 0) {
        const items = result.conflicts
          .slice(0, 10)
          .map((conflict) => `<li>${escapeHtml(conflict.section_name)} - ${escapeHtml(conflict.subject_name)}: ${escapeHtml(conflict.reason)}</li>`)
          .join("");
        generationResult.innerHTML += `<ul class="small">${items}</ul>`;
      }

      showToast("Timetable generated successfully.", "success");

      await withLoading(async () => {
        await loadSummary();
        await loadTimetableHistory();
        if (result?.timetable?.id) {
          await loadTimetableDetails(result.timetable.id);
        }
      });
    } catch (err) {
      handleRequestError(err);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Timetable";
    }
  });
}

if (timetableHistorySearch) {
  timetableHistorySearch.addEventListener(
    "input",
    debounce(() => {
      state.history.q = timetableHistorySearch.value.trim();
      state.history.page = 1;
      withLoading(loadTimetableHistory).catch(handleRequestError);
    }, 300)
  );
}

bindClick("historyPrev", () => {
  state.history.page = Math.max(1, state.history.page - 1);
  withLoading(loadTimetableHistory).catch(handleRequestError);
});

bindClick("historyNext", () => {
  const maxPage = Math.max(1, Math.ceil(state.history.total / state.history.limit));
  state.history.page = Math.min(maxPage, state.history.page + 1);
  withLoading(loadTimetableHistory).catch(handleRequestError);
});

if (timetableHistoryBody) {
  timetableHistoryBody.addEventListener("click", (event) => {
    const viewBtn = event.target.closest("[data-view-timetable-id]");
    if (!viewBtn) return;

    const timetableId = Number(viewBtn.dataset.viewTimetableId);
    if (!Number.isInteger(timetableId) || timetableId <= 0) return;

    withLoading(() => loadTimetableDetails(timetableId)).catch(handleRequestError);
  });
}

if (timetableSectionSelect) {
  timetableSectionSelect.addEventListener("change", () => {
    const selected = Number(timetableSectionSelect.value);
    if (!state.timetableView.detail || !Number.isInteger(selected) || selected <= 0) return;
    renderTimetableGrid(state.timetableView.detail, selected);
  });
}

if (activitySearch) {
  activitySearch.addEventListener(
    "input",
    debounce(() => {
      state.activity.q = activitySearch.value.trim();
      state.activity.page = 1;
      withLoading(loadActivityLog).catch(handleRequestError);
    }, 300)
  );
}

bindClick("activityPrev", () => {
  state.activity.page = Math.max(1, state.activity.page - 1);
  withLoading(loadActivityLog).catch(handleRequestError);
});

bindClick("activityNext", () => {
  const maxPage = Math.max(1, Math.ceil(state.activity.total / state.activity.limit));
  state.activity.page = Math.min(maxPage, state.activity.page + 1);
  withLoading(loadActivityLog).catch(handleRequestError);
});

if (activityList) {
  activityList.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-delete-activity-id]");
    if (!deleteBtn) return;

    const activityId = Number(deleteBtn.dataset.deleteActivityId);
    if (!Number.isInteger(activityId) || activityId <= 0) return;

    const confirmed = window.confirm("Delete this activity entry?");
    if (!confirmed) return;

    try {
      await withLoading(() =>
        apiRequest(`/activity-log/${activityId}`, {
          method: "DELETE",
          headers: authHeaders(),
        })
      );

      showToast("Activity deleted successfully.", "success");

      const maxPageBeforeReload = Math.max(1, Math.ceil(Math.max(0, state.activity.total - 1) / state.activity.limit));
      if (state.activity.page > maxPageBeforeReload) {
        state.activity.page = maxPageBeforeReload;
      }

      await withLoading(loadActivityLog);
    } catch (err) {
      handleRequestError(err);
    }
  });
}

async function initializeDashboard() {
  hideAlert(dashboardAlertId);
  renderTimetablePlaceholder();

  await withLoading(async () => {
    const results = await Promise.allSettled([
      loadSummary(),
      loadReports(),
      loadSemesterOptionsForGenerator(),
      loadTimetableHistory(),
    ]);

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      const summaryFailed = results[0]?.status === "rejected";
      if (summaryFailed) {
        handleRequestError(results[0].reason);
      } else {
        const firstError = failed[0].reason;
        showToast(firstError?.message || "Some dashboard widgets could not load.", "warning");
      }
    }
  });

  setInterval(refreshSummaryCounts, 30000);
}

initializeDashboard();
