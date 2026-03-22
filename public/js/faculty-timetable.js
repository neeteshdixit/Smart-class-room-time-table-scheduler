requireAuth();

const alertId = "facultyTimetableAlert";
const facultyIdentity = document.getElementById("facultyIdentity");
const facultyTimetableSelect = document.getElementById("facultyTimetableSelect");
const facultyGridHeader = document.getElementById("facultyGridHeader");
const facultyGridContainer = document.getElementById("facultyGridContainer");
const facultyGridFooter = document.getElementById("facultyGridFooter");
const studentTimetableSelect = document.getElementById("studentTimetableSelect");
const studentSectionSelect = document.getElementById("studentSectionSelect");
const studentDownloadBtn = document.getElementById("studentDownloadBtn");
const studentShareBtn = document.getElementById("studentShareBtn");
const studentGridHeader = document.getElementById("studentGridHeader");
const studentGridContainer = document.getElementById("studentGridContainer");
const studentGridFooter = document.getElementById("studentGridFooter");

const state = {
  faculty: null,
  student: null,
};

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

function ensureFacultyRole() {
  const payload = decodeJwtPayload(getAuthToken());
  const role = String(payload?.role || "")
    .trim()
    .toLowerCase();
  if (role === "faculty") return;
  if (role === "admin") {
    window.location.replace("/dashboard.html");
    return;
  }
  logout();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dayOfWeekShortLabel(day) {
  const map = {
    1: "Mo",
    2: "Tu",
    3: "We",
    4: "Th",
    5: "Fr",
    6: "Sa",
    7: "Su",
  };
  return map[Number(day)] || String(day || "-");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
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

function detectBreakInsertIndex(slotColumns) {
  if (!slotColumns.length) return 0;
  for (let i = 0; i < slotColumns.length - 1; i += 1) {
    const endCurrent = toTimeMinutes(slotColumns[i].end_time);
    const startNext = toTimeMinutes(slotColumns[i + 1].start_time);
    if (endCurrent !== null && startNext !== null && startNext - endCurrent > 1) {
      return i + 1;
    }
  }
  return 0;
}

function samePracticalBlock(firstEntry, secondEntry) {
  if (!firstEntry || !secondEntry) return false;
  if (String(firstEntry.session_mode || "").toLowerCase() !== "practical") return false;
  if (String(secondEntry.session_mode || "").toLowerCase() !== "practical") return false;
  return (
    Number(firstEntry.subject_id) === Number(secondEntry.subject_id) &&
    Number(firstEntry.section_id) === Number(secondEntry.section_id) &&
    Number(firstEntry.classroom_id) === Number(secondEntry.classroom_id) &&
    Number(firstEntry.faculty_id) === Number(secondEntry.faculty_id)
  );
}

function buildTimetableOptions(timetables) {
  return timetables
    .map(
      (row) =>
        `<option value="${escapeHtml(row.id)}">${escapeHtml(row.version_name)} | Sem ${escapeHtml(
          row.semester_number
        )} | ${escapeHtml(row.academic_year)}</option>`
    )
    .join("");
}

function buildCell(entry, options = {}, colspan = 1) {
  if (!entry) {
    return '<td><div class="timetable-cell text-secondary">-</div></td>';
  }

  const mode = String(entry.session_mode || "").toLowerCase();
  const cellClass = mode === "practical" ? "timetable-cell-practical" : "timetable-cell-theory";
  const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : "";
  const modeText = mode === "practical" ? "Lab (2 slots)" : "Theory";
  const detailText = typeof options.detailFormatter === "function" ? options.detailFormatter(entry) : entry.section_name || "-";

  return `
    <td${colspanAttr} class="${cellClass}">
      <div class="timetable-cell">
        <div class="timetable-cell-code">${escapeHtml(entry.subject_code || "-")}</div>
        <div class="timetable-cell-title">${escapeHtml(entry.subject_name || "-")}</div>
        <div class="timetable-cell-detail">${escapeHtml(detailText || "-")}</div>
        <div class="timetable-cell-room">${escapeHtml(entry.room_number || "-")} | ${escapeHtml(modeText)}</div>
      </div>
    </td>
  `;
}

function renderPlaceholder({ header, container, footer, message }) {
  if (header) header.innerHTML = "";
  if (footer) footer.innerHTML = "";
  if (container) {
    container.innerHTML = `<div class="text-secondary py-3 text-center">${escapeHtml(message)}</div>`;
  }
}

function renderTimetableGrid({ header, container, footer, timetable, entries, timeSlots, placeholderMessage, detailFormatter }) {
  if (!timetable) {
    renderPlaceholder({ header, container, footer, message: placeholderMessage });
    return;
  }

  const slotColumns = Array.from(
    new Map(
      (Array.isArray(timeSlots) ? timeSlots : [])
        .map((slot) => [Number(slot.slot_number), slot])
        .sort((a, b) => a[0] - b[0])
    ).values()
  ).sort((a, b) => Number(a.slot_number) - Number(b.slot_number));

  if (!slotColumns.length) {
    renderPlaceholder({ header, container, footer, message: "No time slots configured for this timetable." });
    return;
  }

  const workingDayNumbers = Array.from(
    new Set(slotColumns.map((slot) => Number(slot.day_of_week)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))
  ).sort((a, b) => a - b);
  if (!workingDayNumbers.length) {
    renderPlaceholder({ header, container, footer, message: "No working days found." });
    return;
  }

  const entryByDayAndSlot = new Map(
    (Array.isArray(entries) ? entries : []).map((entry) => [`${entry.day_of_week}-${entry.slot_number}`, entry])
  );
  const breakInsertIndex = detectBreakInsertIndex(slotColumns);

  const headerCells = slotColumns
    .map((slot, index) => {
      const headerCell = `
        <th class="timetable-slot-col">
          <div>${escapeHtml(slot.slot_number)}</div>
          <div class="small fw-normal">${escapeHtml(formatClockTime(slot.start_time))} - ${escapeHtml(
        formatClockTime(slot.end_time)
      )}</div>
        </th>
      `;
      if (breakInsertIndex > 0 && index === breakInsertIndex - 1) {
        return `${headerCell}<th class="timetable-lunch-col">Break</th>`;
      }
      return headerCell;
    })
    .join("");

  const dayRows = workingDayNumbers
    .map((day) => {
      const cells = [];
      for (let slotIndex = 0; slotIndex < slotColumns.length; slotIndex += 1) {
        const slot = slotColumns[slotIndex];
        const entry = entryByDayAndSlot.get(`${day}-${slot.slot_number}`) || null;

        let consumedSpan = 1;
        if (entry && String(entry.session_mode || "").toLowerCase() === "practical") {
          const nextSlot = slotColumns[slotIndex + 1];
          const nextEntry = nextSlot ? entryByDayAndSlot.get(`${day}-${nextSlot.slot_number}`) || null : null;
          if (samePracticalBlock(entry, nextEntry)) {
            consumedSpan = 2;
          }
        }

        cells.push(buildCell(entry, { detailFormatter }, consumedSpan));

        if (breakInsertIndex > 0 && slotIndex === breakInsertIndex - 1) {
          cells.push('<td class="timetable-lunch-col">BREAK</td>');
        }

        if (consumedSpan > 1) {
          slotIndex += consumedSpan - 1;
        }
      }

      return `
        <tr>
          <td class="timetable-day-col">${escapeHtml(dayOfWeekShortLabel(day))}</td>
          ${cells.join("")}
        </tr>
      `;
    })
    .join("");

  if (header) {
    header.innerHTML = `
      <div class="timetable-session-title">Session ${escapeHtml(timetable.academic_year || "-")}</div>
      <div class="timetable-program-title">Semester ${escapeHtml(timetable.semester_number || "-")}</div>
      <div class="small text-secondary">${escapeHtml(timetable.department_name || "-")} | ${escapeHtml(
        timetable.branch_name || "-"
      )}</div>
    `;
  }

  if (container) {
    container.innerHTML = `
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
  }

  if (footer) {
    footer.innerHTML = `
      <span>Version: ${escapeHtml(timetable.version_name || "-")} | Status: ${escapeHtml(timetable.status || "-")}</span>
      <span>Generated: ${escapeHtml(formatDateTime(timetable.created_at))}</span>
    `;
  }
}

function renderFacultyTimetable(data) {
  renderTimetableGrid({
    header: facultyGridHeader,
    container: facultyGridContainer,
    footer: facultyGridFooter,
    timetable: data?.timetable || null,
    entries: Array.isArray(data?.entries) ? data.entries : [],
    timeSlots: Array.isArray(data?.time_slots) ? data.time_slots : [],
    placeholderMessage: "No timetable assigned.",
    detailFormatter: (entry) => entry.section_name || "-",
  });
}

function renderStudentTimetable(data) {
  const selectedSectionId = Number(data?.selected_section_id || 0);
  const entries = (Array.isArray(data?.entries) ? data.entries : []).filter(
    (entry) => !selectedSectionId || Number(entry.section_id) === selectedSectionId
  );

  renderTimetableGrid({
    header: studentGridHeader,
    container: studentGridContainer,
    footer: studentGridFooter,
    timetable: data?.timetable || null,
    entries,
    timeSlots: Array.isArray(data?.time_slots) ? data.time_slots : [],
    placeholderMessage: "No student timetable available.",
    detailFormatter: (entry) => entry.faculty_name || "-",
  });
}

function renderFacultySelector(data) {
  if (!facultyTimetableSelect) return;
  const timetables = Array.isArray(data?.timetables) ? data.timetables : [];
  if (!timetables.length) {
    facultyTimetableSelect.disabled = true;
    facultyTimetableSelect.innerHTML = '<option value="">No timetable</option>';
    return;
  }

  facultyTimetableSelect.disabled = false;
  facultyTimetableSelect.innerHTML = buildTimetableOptions(timetables);
  facultyTimetableSelect.value = String(data.selected_timetable_id || timetables[0].id);
}

function renderStudentControls(data) {
  if (studentTimetableSelect) {
    const timetables = Array.isArray(data?.timetables) ? data.timetables : [];
    if (!timetables.length) {
      studentTimetableSelect.disabled = true;
      studentTimetableSelect.innerHTML = '<option value="">No timetable</option>';
    } else {
      studentTimetableSelect.disabled = false;
      studentTimetableSelect.innerHTML = buildTimetableOptions(timetables);
      studentTimetableSelect.value = String(data.selected_timetable_id || timetables[0].id);
    }
  }

  if (studentSectionSelect) {
    const sections = Array.isArray(data?.sections) ? data.sections : [];
    if (!sections.length) {
      studentSectionSelect.disabled = true;
      studentSectionSelect.innerHTML = '<option value="">No section</option>';
    } else {
      studentSectionSelect.disabled = false;
      studentSectionSelect.innerHTML = sections
        .map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.name || `Section ${section.id}`)}</option>`)
        .join("");
      studentSectionSelect.value = String(data.selected_section_id || sections[0].id);
    }
  }

  if (studentDownloadBtn) {
    studentDownloadBtn.disabled = !data?.selected_timetable_id;
  }
  if (studentShareBtn) {
    studentShareBtn.disabled = !data?.selected_timetable_id;
  }
}

async function loadFacultyTimetable(timetableId = null) {
  hideAlert(alertId);
  const query = timetableId ? `?timetable_id=${encodeURIComponent(String(timetableId))}` : "";
  const response = await apiRequest(`/faculty/timetable${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  state.faculty = response;

  if (facultyIdentity) {
    const faculty = response?.faculty || {};
    facultyIdentity.textContent = `${faculty.full_name || "-"} (${faculty.faculty_id || "-"})`;
  }

  renderFacultySelector(response);
  renderFacultyTimetable(response);
  return response;
}

async function loadStudentTimetable(timetableId = null, sectionId = null) {
  const params = new URLSearchParams();
  if (timetableId) params.set("timetable_id", String(timetableId));
  if (sectionId) params.set("section_id", String(sectionId));
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await apiRequest(`/faculty/student-timetable${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  state.student = response;
  renderStudentControls(response);
  renderStudentTimetable(response);
  return response;
}

async function handleStudentShare() {
  const timetableId = Number(state.student?.selected_timetable_id || 0);
  if (!Number.isInteger(timetableId) || timetableId <= 0) {
    showAlert(alertId, "Select a student timetable first.");
    return;
  }

  const rawRecipients = window.prompt("Enter student group email addresses separated by commas:");
  if (!rawRecipients) return;
  const recipientEmails = rawRecipients
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!recipientEmails.length) {
    showAlert(alertId, "Please enter at least one email address.");
    return;
  }

  const message = window.prompt("Optional message for students:", "") || "";
  const payload = {
    timetable_id: timetableId,
    section_id: Number(state.student?.selected_section_id || 0) || undefined,
    recipient_emails: recipientEmails,
    message,
  };

  await apiRequest("/faculty/student-timetable/share", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  showAlert(alertId, "Student timetable shared successfully.", "success");
}

if (facultyTimetableSelect) {
  facultyTimetableSelect.addEventListener("change", async () => {
    const selectedId = Number(facultyTimetableSelect.value);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;

    try {
      await loadFacultyTimetable(selectedId);
      await loadStudentTimetable(selectedId, Number(state.student?.selected_section_id || 0) || null);
    } catch (err) {
      showAlert(alertId, err.message || "Failed to load timetable.");
    }
  });
}

if (studentTimetableSelect) {
  studentTimetableSelect.addEventListener("change", async () => {
    const selectedId = Number(studentTimetableSelect.value);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;

    try {
      await loadStudentTimetable(selectedId);
    } catch (err) {
      showAlert(alertId, err.message || "Failed to load student timetable.");
    }
  });
}

if (studentSectionSelect) {
  studentSectionSelect.addEventListener("change", async () => {
    const selectedTimetableId = Number(state.student?.selected_timetable_id || 0);
    const selectedSectionId = Number(studentSectionSelect.value);
    if (!Number.isInteger(selectedTimetableId) || selectedTimetableId <= 0) return;
    if (!Number.isInteger(selectedSectionId) || selectedSectionId <= 0) return;

    try {
      await loadStudentTimetable(selectedTimetableId, selectedSectionId);
    } catch (err) {
      showAlert(alertId, err.message || "Failed to load student timetable.");
    }
  });
}

if (studentDownloadBtn) {
  studentDownloadBtn.addEventListener("click", () => {
    const timetableId = Number(state.student?.selected_timetable_id || 0);
    if (!Number.isInteger(timetableId) || timetableId <= 0) {
      showAlert(alertId, "Select a student timetable first.");
      return;
    }

    const params = new URLSearchParams();
    params.set("timetable_id", String(timetableId));
    const sectionId = Number(state.student?.selected_section_id || 0);
    if (Number.isInteger(sectionId) && sectionId > 0) {
      params.set("section_id", String(sectionId));
    }

    const apiBase = readRuntimeApiBase() || activeApiBase || DEFAULT_API_BASE;
    const url = buildApiUrl(apiBase, `/faculty/student-timetable/download?${params.toString()}`);
    window.open(url, "_blank", "noopener");
  });
}

if (studentShareBtn) {
  studentShareBtn.addEventListener("click", () => {
    handleStudentShare().catch((err) => {
      showAlert(alertId, err.message || "Failed to share student timetable.");
    });
  });
}

async function init() {
  ensureFacultyRole();
  try {
    const facultyResponse = await loadFacultyTimetable();
    const selectedTimetableId = Number(facultyResponse?.selected_timetable_id || 0) || null;
    await loadStudentTimetable(selectedTimetableId);
  } catch (err) {
    const message = String(err?.message || "").trim() || "Failed to load timetable.";
    showAlert(alertId, message);
    if (message.toLowerCase().includes("token")) {
      logout();
    } else {
      renderPlaceholder({
        header: facultyGridHeader,
        container: facultyGridContainer,
        footer: facultyGridFooter,
        message,
      });
      renderPlaceholder({
        header: studentGridHeader,
        container: studentGridContainer,
        footer: studentGridFooter,
        message,
      });
    }
  }
}

init();
