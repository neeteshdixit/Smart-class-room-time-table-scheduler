requireAuth();

const alertId = "facultyTimetableAlert";
const facultyIdentity = document.getElementById("facultyIdentity");
const timetableSelect = document.getElementById("facultyTimetableSelect");
const gridHeader = document.getElementById("facultyGridHeader");
const gridContainer = document.getElementById("facultyGridContainer");
const gridFooter = document.getElementById("facultyGridFooter");

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

function buildCell(entry, colspan = 1) {
  if (!entry) {
    return '<td><div class="timetable-cell text-secondary">-</div></td>';
  }

  const mode = String(entry.session_mode || "").toLowerCase();
  const cellClass = mode === "practical" ? "timetable-cell-practical" : "timetable-cell-theory";
  const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : "";
  const modeText = mode === "practical" ? "Lab (2 slots)" : "Theory";

  return `
    <td${colspanAttr} class="${cellClass}">
      <div class="timetable-cell">
        <div class="timetable-cell-code">${escapeHtml(entry.subject_code || "-")}</div>
        <div class="timetable-cell-title">${escapeHtml(entry.subject_name || "-")}</div>
        <div class="timetable-cell-detail">${escapeHtml(entry.section_name || "-")}</div>
        <div class="timetable-cell-room">${escapeHtml(entry.room_number || "-")} | ${escapeHtml(modeText)}</div>
      </div>
    </td>
  `;
}

function renderPlaceholder(message) {
  if (gridHeader) gridHeader.innerHTML = "";
  if (gridFooter) gridFooter.innerHTML = "";
  if (gridContainer) {
    gridContainer.innerHTML = `<div class="text-secondary py-3 text-center">${escapeHtml(message)}</div>`;
  }
}

function renderTimetable(data) {
  const timetable = data?.timetable || null;
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const timeSlots = Array.isArray(data?.time_slots) ? data.time_slots : [];

  if (!timetable) {
    renderPlaceholder("No timetable assigned.");
    return;
  }

  const slotColumns = Array.from(
    new Map(
      timeSlots
        .map((slot) => [Number(slot.slot_number), slot])
        .sort((a, b) => a[0] - b[0])
    ).values()
  ).sort((a, b) => Number(a.slot_number) - Number(b.slot_number));

  if (!slotColumns.length) {
    renderPlaceholder("No time slots configured for this timetable.");
    return;
  }

  const workingDayNumbers = Array.from(
    new Set(timeSlots.map((slot) => Number(slot.day_of_week)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))
  ).sort((a, b) => a - b);
  if (!workingDayNumbers.length) {
    renderPlaceholder("No working days found.");
    return;
  }

  const entryByDayAndSlot = new Map(
    entries.map((entry) => [`${entry.day_of_week}-${entry.slot_number}`, entry])
  );
  const breakInsertIndex = detectBreakInsertIndex(slotColumns);

  const headerCells = slotColumns
    .map((slot, index) => {
      const header = `
        <th class="timetable-slot-col">
          <div>${escapeHtml(slot.slot_number)}</div>
          <div class="small fw-normal">${escapeHtml(formatClockTime(slot.start_time))} - ${escapeHtml(
        formatClockTime(slot.end_time)
      )}</div>
        </th>
      `;
      if (breakInsertIndex > 0 && index === breakInsertIndex - 1) {
        return `${header}<th class="timetable-lunch-col">Break</th>`;
      }
      return header;
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

        cells.push(buildCell(entry, consumedSpan));

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

  if (gridHeader) {
    gridHeader.innerHTML = `
      <div class="timetable-session-title">Session ${escapeHtml(timetable.academic_year || "-")}</div>
      <div class="timetable-program-title">Semester ${escapeHtml(timetable.semester_number || "-")}</div>
      <div class="small text-secondary">${escapeHtml(timetable.department_name || "-")} | ${escapeHtml(
      timetable.branch_name || "-"
    )}</div>
    `;
  }

  if (gridContainer) {
    gridContainer.innerHTML = `
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

  if (gridFooter) {
    gridFooter.innerHTML = `
      <span>Version: ${escapeHtml(timetable.version_name || "-")} | Status: ${escapeHtml(timetable.status || "-")}</span>
      <span>Generated: ${escapeHtml(formatDateTime(timetable.created_at))}</span>
    `;
  }
}

function renderTimetableSelector(data) {
  if (!timetableSelect) return;
  const timetables = Array.isArray(data?.timetables) ? data.timetables : [];
  if (!timetables.length) {
    timetableSelect.disabled = true;
    timetableSelect.innerHTML = '<option value="">No timetable</option>';
    return;
  }

  timetableSelect.disabled = false;
  timetableSelect.innerHTML = timetables
    .map(
      (row) =>
        `<option value="${escapeHtml(row.id)}">${escapeHtml(row.version_name)} | Sem ${escapeHtml(
          row.semester_number
        )} | ${escapeHtml(row.academic_year)}</option>`
    )
    .join("");
  timetableSelect.value = String(data.selected_timetable_id || timetables[0].id);
}

async function loadFacultyTimetable(timetableId = null) {
  hideAlert(alertId);
  const query = timetableId ? `?timetable_id=${encodeURIComponent(String(timetableId))}` : "";
  const response = await apiRequest(`/faculty/timetable${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (facultyIdentity) {
    const faculty = response?.faculty || {};
    facultyIdentity.textContent = `${faculty.full_name || "-"} (${faculty.faculty_id || "-"})`;
  }

  renderTimetableSelector(response);
  renderTimetable(response);
}

if (timetableSelect) {
  timetableSelect.addEventListener("change", async () => {
    const selectedId = Number(timetableSelect.value);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;

    try {
      await loadFacultyTimetable(selectedId);
    } catch (err) {
      showAlert(alertId, err.message || "Failed to load timetable.");
    }
  });
}

async function init() {
  ensureFacultyRole();
  try {
    await loadFacultyTimetable();
  } catch (err) {
    const message = String(err?.message || "").trim() || "Failed to load timetable.";
    showAlert(alertId, message);
    if (message.toLowerCase().includes("token")) {
      logout();
    } else {
      renderPlaceholder(message);
    }
  }
}

init();
