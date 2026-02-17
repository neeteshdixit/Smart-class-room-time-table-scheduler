requireAuth();

const statsCards = document.getElementById("statsCards");
const entityCards = document.getElementById("entityCards");
const workloadTableBody = document.getElementById("workloadTableBody");
const roomTableBody = document.getElementById("roomTableBody");
const generationResult = document.getElementById("generationResult");
const semesterSelect = document.getElementById("semesterSelect");
const timetableHistoryBody = document.getElementById("timetableHistoryBody");
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
  history: { page: 1, limit: 8, total: 0, q: "" },
  activity: { page: 1, limit: 10, total: 0, q: "" },
  info: { resource: null, page: 1, limit: 8, total: 0, q: "", rows: [] },
};

const entityOrder = ["departments", "branches", "sections", "faculty", "subjects", "semesters"];

const entityConfig = {
  departments: {
    title: "Departments",
    endpoint: "/departments",
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
  faculty: {
    title: "Faculty",
    endpoint: "/faculty",
    countKey: "faculty",
    tone: "entity-tone-faculty",
    addLabel: "Add Faculty",
    infoLabel: "See Faculty Info",
    readOnly: true,
    addAction: "/signup.html",
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

function handleRequestError(err) {
  if (String(err.message || "").toLowerCase().includes("token")) {
    logout();
    return;
  }
  showAlert(dashboardAlertId, err.message || "Request failed");
  showToast(err.message || "Request failed", "danger");
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
  return apiRequest(`${endpoint}${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
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
        const result = await fetchList("/departments", { page: 1, limit: 200 });
        optionMap.departments = result.data;
      } else if (key === "branches") {
        const result = await fetchList("/branches", { page: 1, limit: 300 });
        optionMap.branches = result.data;
      } else if (key === "semesters") {
        const result = await fetchList("/semesters", { page: 1, limit: 300 });
        optionMap.semesters = result.data;
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
  return "";
}

function renderForm(resourceKey, optionsByKey) {
  if (!entityFormBody || !entityFormTitle) return;
  const config = entityConfig[resourceKey];
  entityFormTitle.textContent = config.addLabel;

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
    subjects: ["department_id", "branch_id", "semester_id"],
    semesters: ["branch_id", "semester_number"],
  };

  (toIntKeys[resourceKey] || []).forEach((key) => {
    if (converted[key] !== undefined) {
      converted[key] = Number(converted[key]);
    }
  });

  if (resourceKey === "sections" && converted.student_strength === undefined) {
    converted.student_strength = 60;
  }

  if (resourceKey === "branches" && !converted.program_type) {
    converted.program_type = "UG";
  }

  return converted;
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
  const optionsByKey = await getFormOptions(resourceKey);
  renderForm(resourceKey, optionsByKey);
  formModal.show();
}

function renderEntityInfoTableHeader(resourceKey) {
  if (!entityInfoHead) return;
  const config = entityConfig[resourceKey];
  entityInfoHead.innerHTML = `<tr>${config.columns.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>`;
}

function renderEntityInfoRows(resourceKey, rows) {
  if (!entityInfoBody) return;
  const config = entityConfig[resourceKey];
  if (!rows.length) {
    entityInfoBody.innerHTML = `<tr><td colspan="${config.columns.length}" class="text-secondary">No data</td></tr>`;
    return;
  }

  entityInfoBody.innerHTML = rows
    .map((row) => {
      const values = config.mapRow(row).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
      return `<tr>${values}</tr>`;
    })
    .join("");
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

  const result = await fetchList(config.endpoint, { page, limit, q });
  state.info.total = result.pagination.total;
  state.info.rows = result.data;

  renderEntityInfoRows(resource, result.data);
  updatePager(
    { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.total },
    entityInfoPageLabel,
    "entityInfoPrev",
    "entityInfoNext"
  );
}

async function openEntityInfo(resourceKey) {
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
  await loadEntityInfo();
  infoModal.show();
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
  const semesters = await fetchList("/semesters", { page: 1, limit: 200 });
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
      </tr>`,
    5
  );

  updatePager(
    { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.total },
    historyPageLabel,
    "historyPrev",
    "historyNext"
  );
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
    activityList.innerHTML = result.data
      .map(
        (item) => `
          <li class="list-group-item">
            <div class="fw-semibold">${escapeHtml(item.action_type)}</div>
            <div class="small text-secondary">${escapeHtml(item.details || "-")}</div>
            <div class="small text-muted">${escapeHtml(item.actor_name || "System")} | ${escapeHtml(
              formatDateTime(item.created_at)
            )}</div>
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
    if (!resource || !entityConfig[resource]) return;

    const formData = new FormData(entityForm);
    const payload = normalizePayload(resource, Object.fromEntries(formData.entries()));
    const submitBtn = document.getElementById("entitySubmitBtn");
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      await withLoading(() =>
        apiRequest(entityConfig[resource].endpoint, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        })
      );

      formModal.hide();
      entityForm.reset();
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
    } catch (err) {
      handleRequestError(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save";
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

async function initializeDashboard() {
  hideAlert(dashboardAlertId);

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
