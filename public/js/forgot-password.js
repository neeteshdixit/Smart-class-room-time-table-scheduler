const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("forgotPasswordAlert");

    const identifier = forgotPasswordForm.elements.identifier.value.trim();
    const payload = isEmailLike(identifier) ? { email: identifier } : { faculty_id: identifier };

    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = "Sending...";

    try {
      const result = await apiRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      sessionStorage.setItem("reset_email", result.email);
      if (result.otp_preview) {
        sessionStorage.setItem("reset_otp_preview", result.otp_preview);
      }

      showAlert("forgotPasswordAlert", result.message, "success");
      setTimeout(() => {
        window.location.href = "/forgot-otp.html";
      }, 900);
    } catch (err) {
      showAlert("forgotPasswordAlert", err.message);
    } finally {
      forgotPasswordBtn.disabled = false;
      forgotPasswordBtn.textContent = "Send OTP";
    }
  });
}
