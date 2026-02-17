const signupForm = document.getElementById("signupForm");
const signupBtn = document.getElementById("signupBtn");
const roleSelect = document.getElementById("roleSelect");
const adminRoleOption = document.getElementById("adminRoleOption");
const adminRoleHelp = document.getElementById("adminRoleHelp");
const departmentSelect = document.getElementById("departmentSelect");
const subjectSelect = document.getElementById("subjectSelect");
const subjectCountHelp = document.getElementById("subjectCountHelp");
let adminExists = false;

function getSelectedValues(selectElement) {
  if (!selectElement) return [];
  return Array.from(selectElement.selectedOptions).map((option) => Number(option.value));
}

function updateSubjectCount() {
  if (!subjectCountHelp || !subjectSelect) return;
  subjectCountHelp.textContent = `Selected subjects: ${getSelectedValues(subjectSelect).length}`;
}

async function loadSignupOptions() {
  if (!departmentSelect || !subjectSelect) return;

  try {
    const data = await apiRequest("/auth/signup-options");

    departmentSelect.innerHTML = (data.departments || [])
      .map((item) => `<option value="${item.id}">${item.department_name} (${item.department_code})</option>`)
      .join("");

    subjectSelect.innerHTML = (data.subjects || [])
      .map((item) => `<option value="${item.id}">${item.subject_name} (${item.subject_code})</option>`)
      .join("");

    updateSubjectCount();
  } catch (err) {
    showAlert("signupAlert", "Unable to load departments/subjects. Please contact admin.");
  }
}

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

if (subjectSelect) {
  subjectSelect.addEventListener("change", updateSubjectCount);
}

if (signupForm) {
  loadSignupMeta();
  loadSignupOptions();

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("signupAlert");

    const roleValue = roleSelect ? roleSelect.value : "FACULTY";
    const departmentIds = getSelectedValues(departmentSelect);
    const subjectIds = getSelectedValues(subjectSelect);

    if (roleValue === "FACULTY" && departmentIds.length === 0) {
      showAlert("signupAlert", "Please select at least one department.");
      return;
    }

    if (roleValue === "FACULTY" && subjectIds.length === 0) {
      showAlert("signupAlert", "Please select at least one subject.");
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
    formData.set("department_ids", JSON.stringify(departmentIds));
    formData.set("subject_ids", JSON.stringify(subjectIds));
    if (roleValue === "ADMIN") {
      formData.set("role", "ADMIN");
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Registering...";

    try {
      const endpoint = roleValue === "ADMIN" ? "/api/auth/admin-signup" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: buildAuthHeader(),
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || "Signup failed");
        error.validationErrors = Array.isArray(data.errors) ? data.errors : [];
        throw error;
      }

      showAlert("signupAlert", "Registration successful.", "success");
      signupForm.reset();
      updateSubjectCount();
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
