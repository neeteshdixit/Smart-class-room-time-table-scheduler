requireAuth();

const profileForm = document.getElementById("profileForm");
const saveProfileBtn = document.getElementById("saveProfileBtn");

function assignProfileToForm(profile) {
  Object.keys(profile).forEach((key) => {
    const field = profileForm.elements[key];
    if (!field) return;

    if (key === "dob" || key === "joining_date") {
      field.value = profile[key] ? profile[key].slice(0, 10) : "";
      return;
    }
    field.value = profile[key] ?? "";
  });
}

async function loadProfile() {
  hideAlert("profileAlert");
  try {
    const result = await apiRequest("/profile", {
      headers: authHeaders(),
    });
    assignProfileToForm(result.profile);
  } catch (err) {
    if (err.message.toLowerCase().includes("token")) {
      logout();
      return;
    }
    showAlert("profileAlert", err.message);
  }
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("profileAlert");

    const payload = Object.fromEntries(new FormData(profileForm).entries());
    delete payload.faculty_id;

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saving...";

    try {
      await apiRequest("/profile", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      showAlert("profileAlert", "Profile updated successfully.", "success");
      await loadProfile();
    } catch (err) {
      showAlert("profileAlert", err.message);
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = "Save Changes";
    }
  });
}

loadProfile();

