requireAuth();

const statsCards = document.getElementById("statsCards");
const recentActivity = document.getElementById("recentActivity");
const departmentsTableBody = document.getElementById("departmentsTableBody");
const timetableTableBody = document.getElementById("timetableTableBody");
const workloadTableBody = document.getElementById("workloadTableBody");
const roomTableBody = document.getElementById("roomTableBody");
const generationResult = document.getElementById("generationResult");

function buildStatsCards(totals, metrics) {
  const cards = [
    ["Departments", totals.departments],
    ["Branches", totals.branches],
    ["Sections", totals.sections],
    ["Faculty", totals.faculty],
    ["Classrooms", totals.classrooms],
    ["Labs", totals.labs],
    ["Subjects", totals.subjects],
    ["Semesters", totals.semesters],
    ["Avg Workload", metrics.average_faculty_workload],
    ["Room Utilization %", metrics.room_utilization_percent],
  ];

  statsCards.innerHTML = cards
    .map(
      ([title, value]) => `
        <div class="col-6 col-md-4 col-xl-2">
          <div class="card stat-card h-100">
            <div class="card-body">
              <small class="text-secondary">${title}</small>
              <div class="stat-value">${value ?? 0}</div>
            </div>
          </div>
        </div>`
    )
    .join("");
}

function renderRecentActivity(items) {
  if (!items.length) {
    recentActivity.innerHTML = '<li class="list-group-item text-secondary">No recent activity found.</li>';
    return;
  }
  recentActivity.innerHTML = items
    .map(
      (item) => `
      <li class="list-group-item">
        <strong>${item.action_type}</strong>
        <div class="small text-secondary">${item.details || "-"} | ${new Date(item.created_at).toLocaleString()}</div>
      </li>`
    )
    .join("");
}

function renderTableRows(target, rows, formatter) {
  if (!rows.length) {
    target.innerHTML = '<tr><td colspan="6" class="text-secondary">No data</td></tr>';
    return;
  }
  target.innerHTML = rows.map(formatter).join("");
}

async function createMasterRecord(resource, payload) {
  return apiRequest(`/master/${resource}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

function attachFormHandler(formId, resource, transform = null) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("dashboardAlert");

    const payload = Object.fromEntries(new FormData(form).entries());
    const finalPayload = transform ? transform(payload) : payload;

    try {
      await createMasterRecord(resource, finalPayload);
      showAlert("dashboardAlert", "Record saved successfully.", "success");
      form.reset();
      await loadDashboard();
    } catch (err) {
      showAlert("dashboardAlert", err.message);
    }
  });
}

async function loadReports() {
  const [workload, rooms] = await Promise.all([
    apiRequest("/timetable/reports/workload", { headers: authHeaders() }),
    apiRequest("/timetable/reports/room-utilization", { headers: authHeaders() }),
  ]);

  renderTableRows(
    workloadTableBody,
    workload.data.slice(0, 12),
    (row) => `<tr><td>${row.full_name}</td><td>${row.assigned_slots}</td><td>${row.max_workload_per_week}</td></tr>`
  );
  renderTableRows(
    roomTableBody,
    rooms.data.slice(0, 12),
    (row) => `<tr><td>${row.room_number}</td><td>${row.room_type}</td><td>${row.used_slots}</td></tr>`
  );
}

async function loadDashboard() {
  hideAlert("dashboardAlert");

  try {
    const [stats, departments, timetables] = await Promise.all([
      apiRequest("/stats", { headers: authHeaders() }),
      apiRequest("/master/departments?limit=8", { headers: authHeaders() }),
      apiRequest("/timetable", { headers: authHeaders() }),
    ]);

    buildStatsCards(stats.totals, stats.metrics);
    renderRecentActivity(stats.recent_activity || []);

    renderTableRows(
      departmentsTableBody,
      departments.data,
      (row) => `<tr><td>${row.id}</td><td>${row.department_name}</td><td>${row.department_code}</td></tr>`
    );

    renderTableRows(
      timetableTableBody,
      timetables.data.slice(0, 10),
      (row) =>
        `<tr><td>${row.id}</td><td>${row.version_name}</td><td>${row.status}</td><td>${row.total_entries}</td></tr>`
    );

    await loadReports();
  } catch (err) {
    if (err.message.toLowerCase().includes("token")) {
      logout();
      return;
    }
    showAlert("dashboardAlert", err.message);
  }
}

attachFormHandler("departmentForm", "departments");
attachFormHandler("blockForm", "blocks", (payload) => ({
  ...payload,
  number_of_floors: Number(payload.number_of_floors),
}));
attachFormHandler("classroomForm", "classrooms", (payload) => ({
  ...payload,
  capacity: Number(payload.capacity),
  block_id: Number(payload.block_id),
  floor_number: Number(payload.floor_number),
}));
attachFormHandler("timeslotForm", "time-slots", (payload) => ({
  ...payload,
  day_of_week: Number(payload.day_of_week),
  slot_number: Number(payload.slot_number),
}));

const generateForm = document.getElementById("generateTimetableForm");
const generateBtn = document.getElementById("generateBtn");
if (generateForm) {
  generateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("dashboardAlert");
    generationResult.innerHTML = "";

    const payload = Object.fromEntries(new FormData(generateForm).entries());
    payload.semester_id = Number(payload.semester_id);

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
      const result = await apiRequest("/timetable/generate", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      generationResult.innerHTML = `
        <div class="alert alert-success">
          Timetable generated. Assigned entries: <strong>${result.assigned_entries}</strong>,
          Conflicts: <strong>${result.conflicts_count}</strong>.
        </div>
      `;

      if (result.conflicts_count > 0) {
        const items = result.conflicts
          .slice(0, 8)
          .map(
            (c) =>
              `<li>${c.section_name} - ${c.subject_name} (${c.mode}) : ${c.reason}</li>`
          )
          .join("");
        generationResult.innerHTML += `<ul class="small">${items}</ul>`;
      }

      await loadDashboard();
    } catch (err) {
      showAlert("dashboardAlert", err.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Timetable";
    }
  });
}

loadDashboard();

