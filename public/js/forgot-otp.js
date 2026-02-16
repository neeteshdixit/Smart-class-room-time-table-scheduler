const forgotOtpForm = document.getElementById("forgotOtpForm");
const verifyResetOtpBtn = document.getElementById("verifyResetOtpBtn");
const resendResetOtpBtn = document.getElementById("resendResetOtpBtn");
const otpEmailHint = document.getElementById("otpEmailHint");
const resetOtpPreview = document.getElementById("resetOtpPreview");

const resetEmail = sessionStorage.getItem("reset_email");

if (!resetEmail) {
  window.location.href = "/forgot-password.html";
}

if (otpEmailHint && resetEmail) {
  otpEmailHint.textContent = `Email: ${resetEmail}`;
}

const previewCode = sessionStorage.getItem("reset_otp_preview");
if (resetOtpPreview && previewCode) {
  resetOtpPreview.textContent = `Development OTP: ${previewCode}`;
}

if (forgotOtpForm) {
  forgotOtpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("forgotOtpAlert");

    const otp = forgotOtpForm.elements.otp.value.trim();
    verifyResetOtpBtn.disabled = true;
    verifyResetOtpBtn.textContent = "Verifying...";

    try {
      await apiRequest("/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp }),
      });

      sessionStorage.setItem("reset_otp_verified_email", resetEmail);
      sessionStorage.removeItem("reset_otp_preview");
      showAlert("forgotOtpAlert", "OTP verified successfully", "success");
      setTimeout(() => {
        window.location.href = "/reset-password.html";
      }, 700);
    } catch (err) {
      showAlert("forgotOtpAlert", err.message);
    } finally {
      verifyResetOtpBtn.disabled = false;
      verifyResetOtpBtn.textContent = "Verify OTP";
    }
  });
}

if (resendResetOtpBtn) {
  resendResetOtpBtn.addEventListener("click", async () => {
    hideAlert("forgotOtpAlert");
    resendResetOtpBtn.disabled = true;
    resendResetOtpBtn.textContent = "Sending...";

    try {
      const result = await apiRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (result.otp_preview) {
        sessionStorage.setItem("reset_otp_preview", result.otp_preview);
        if (resetOtpPreview) {
          resetOtpPreview.textContent = `Development OTP: ${result.otp_preview}`;
        }
      }

      showAlert("forgotOtpAlert", result.message, "success");
    } catch (err) {
      showAlert("forgotOtpAlert", err.message);
    } finally {
      resendResetOtpBtn.disabled = false;
      resendResetOtpBtn.textContent = "Resend OTP";
    }
  });
}
