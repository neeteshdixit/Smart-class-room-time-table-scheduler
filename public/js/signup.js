const signupForm = document.getElementById("signupForm");
const signupBtn = document.getElementById("signupBtn");
const roleSelect = document.getElementById("roleSelect");
const adminRoleOption = document.getElementById("adminRoleOption");
const adminRoleHelp = document.getElementById("adminRoleHelp");
const subjectCountHelp = document.getElementById("subjectCountHelp");

const departmentTagInput = document.getElementById("departmentTagInput");
const departmentTagsList = document.getElementById("departmentTagsList");
const departmentNamesInput = document.getElementById("departmentNamesInput");
const departmentSuggestions = document.getElementById("departmentSuggestions");

const subjectTagInput = document.getElementById("subjectTagInput");
const subjectTagsList = document.getElementById("subjectTagsList");
const subjectNamesInput = document.getElementById("subjectNamesInput");
const subjectSuggestions = document.getElementById("subjectSuggestions");

let adminExists = false;

function normalizeTagValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function splitTagCandidates(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((part) => normalizeTagValue(part))
    .filter(Boolean);
}

function uniqueNames(items, keyField) {
  const values = new Map();
  (items || []).forEach((item) => {
    const normalized = normalizeTagValue(item?.[keyField]);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!values.has(key)) {
      values.set(key, normalized);
    }
  });
  return [...values.values()];
}

function updateSubjectCount(count) {
  if (!subjectCountHelp) return;
  subjectCountHelp.textContent = `Selected subjects: ${count}`;
}

function createTagManager({ inputEl, listEl, hiddenEl, suggestionsEl, onChange }) {
  if (!inputEl || !listEl || !hiddenEl) {
    return null;
  }

  const tags = new Map();

  function sync() {
    hiddenEl.value = JSON.stringify([...tags.values()]);
    if (onChange) {
      onChange([...tags.values()]);
    }
  }

  function render() {
    listEl.innerHTML = "";
    tags.forEach((tagValue, tagKey) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tagValue;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip-remove";
      removeBtn.dataset.removeKey = tagKey;
      removeBtn.setAttribute("aria-label", `Remove ${tagValue}`);
      removeBtn.textContent = "x";

      chip.appendChild(removeBtn);
      listEl.appendChild(chip);
    });
  }

  function addTag(rawValue) {
    const normalized = normalizeTagValue(rawValue);
    if (!normalized) return false;
    const key = normalized.toLowerCase();
    if (tags.has(key)) return false;
    tags.set(key, normalized);
    render();
    sync();
    return true;
  }

  function addMany(rawText) {
    splitTagCandidates(rawText).forEach((candidate) => addTag(candidate));
  }

  function flushInput() {
    if (!inputEl.value.trim()) return;
    addMany(inputEl.value);
    inputEl.value = "";
  }

  function clear() {
    tags.clear();
    inputEl.value = "";
    render();
    sync();
  }

  function getValues() {
    return [...tags.values()];
  }

  function setSuggestions(values) {
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = "";
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      suggestionsEl.appendChild(option);
    });
  }

  inputEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    flushInput();
  });

  inputEl.addEventListener("blur", () => {
    flushInput();
  });

  inputEl.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text");
    if (!text || !text.includes(",")) return;
    event.preventDefault();
    addMany(text);
    inputEl.value = "";
  });

  listEl.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".tag-chip-remove");
    if (!removeBtn) return;
    const key = removeBtn.dataset.removeKey;
    if (!key) return;
    tags.delete(key);
    render();
    sync();
    inputEl.focus();
  });

  sync();

  return {
    clear,
    flushInput,
    getValues,
    setSuggestions,
  };
}

const departmentTagManager = createTagManager({
  inputEl: departmentTagInput,
  listEl: departmentTagsList,
  hiddenEl: departmentNamesInput,
  suggestionsEl: departmentSuggestions,
});

const subjectTagManager = createTagManager({
  inputEl: subjectTagInput,
  listEl: subjectTagsList,
  hiddenEl: subjectNamesInput,
  suggestionsEl: subjectSuggestions,
  onChange: (values) => {
    updateSubjectCount(values.length);
  },
});

function applyAdminAvailability(meta) {
  if (!roleSelect || !adminRoleOption) return;

  adminExists = Boolean(meta?.admin_exists);
  adminRoleOption.disabled = adminExists;

  if (adminExists && roleSelect.value === "ADMIN") {
    roleSelect.value = "FACULTY";
  }

  if (adminRoleHelp) {
    adminRoleHelp.textContent = adminExists
      ? "Admin account already exists. Contact administrator."
      : "No admin account exists yet. You can create the first admin account.";
  }
}

function buildAuthHeader() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadSignupOptions() {
  if (!departmentTagManager || !subjectTagManager) return;

  try {
    const data = await apiRequest("/auth/signup-options");
    departmentTagManager.setSuggestions(uniqueNames(data.departments, "department_name"));
    subjectTagManager.setSuggestions(uniqueNames(data.subjects, "subject_name"));
  } catch (err) {
    showAlert("signupAlert", "Unable to load departments/subjects. Please contact admin.");
  }
}

async function loadSignupMeta() {
  if (!roleSelect || !adminRoleOption) return;

  try {
    const meta = await apiRequest("/auth/check-admin", {
      headers: buildAuthHeader(),
    });
    applyAdminAvailability(meta);
  } catch (err) {
    if (adminRoleHelp) {
      adminRoleHelp.textContent = "Could not verify admin availability right now.";
    }
  }
}

if (signupForm) {
  updateSubjectCount(0);
  loadSignupMeta();
  loadSignupOptions();

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("signupAlert");

    const roleValue = roleSelect ? roleSelect.value : "FACULTY";
    departmentTagManager?.flushInput();
    subjectTagManager?.flushInput();

    const departmentNames = departmentTagManager ? departmentTagManager.getValues() : [];
    const subjectNames = subjectTagManager ? subjectTagManager.getValues() : [];

    if (roleValue === "FACULTY" && departmentNames.length === 0) {
      showAlert("signupAlert", "Please add at least one department.");
      return;
    }

    if (roleValue === "FACULTY" && subjectNames.length === 0) {
      showAlert("signupAlert", "Please add at least one subject.");
      return;
    }

    if (roleValue === "ADMIN") {
      try {
        const adminStatus = await apiRequest("/auth/check-admin", {
          headers: buildAuthHeader(),
        });
        applyAdminAvailability(adminStatus);
      } catch (err) {
        showAlert("signupAlert", "Unable to verify admin availability right now.");
        return;
      }

      if (adminExists) {
        showAlert("signupAlert", "Admin account already exists. Contact administrator.");
        return;
      }
    }

    const formData = new FormData(signupForm);
    formData.set("department_names", JSON.stringify(departmentNames));
    formData.set("subject_names", JSON.stringify(subjectNames));
    if (roleValue === "ADMIN") {
      formData.set("role", "ADMIN");
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Registering...";

    try {
      const endpoint = roleValue === "ADMIN" ? "/auth/admin-signup" : "/auth/signup";
      await apiRequest(endpoint, {
        method: "POST",
        headers: buildAuthHeader(),
        body: formData,
      });

      showAlert("signupAlert", "Registration successful.", "success");
      signupForm.reset();
      departmentTagManager?.clear();
      subjectTagManager?.clear();
      await loadSignupMeta();
      await loadSignupOptions();
    } catch (err) {
      if (err.validationErrors && err.validationErrors.length > 0) {
        const first = err.validationErrors[0];
        showAlert("signupAlert", `${first.path || "field"}: ${first.msg || "Invalid input"}`);
      } else {
        showAlert("signupAlert", err.message);
      }
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = "Register";
    }
  });
}
