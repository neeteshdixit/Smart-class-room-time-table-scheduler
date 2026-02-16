const otpForm = document.getElementById("otpForm");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");
const otpPreview = document.getElementById("otpPreview");
const loginToken = sessionStorage.getItem("login_token");

if (!loginToken) {
  window.location.href = "/login.html";
}

const previewCode = sessionStorage.getItem("otp_preview");
if (otpPreview && previewCode) {
  otpPreview.textContent = `Development OTP: ${previewCode}`;
}

if (otpForm) {
  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("otpAlert");

    const otpCode = otpForm.elements.otp_code.value.trim();
    verifyOtpBtn.disabled = true;
    verifyOtpBtn.textContent = "Verifying...";

    try {
      const result = await apiRequest("/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_token: loginToken,
          otp_code: otpCode,
        }),
      });

      setAuthToken(result.token);
      sessionStorage.removeItem("otp_preview");
      showAlert("otpAlert", "OTP verified. Redirecting to dashboard.", "success");
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 800);
    } catch (err) {
      showAlert("otpAlert", err.message);
    } finally {
      verifyOtpBtn.disabled = false;
      verifyOtpBtn.textContent = "Verify OTP";
    }
  });
}

if (resendOtpBtn) {
  resendOtpBtn.addEventListener("click", async () => {
    hideAlert("otpAlert");
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = "Sending...";

    try {
      const result = await apiRequest("/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_token: loginToken }),
      });
      if (result.otp_preview) {
        otpPreview.textContent = `Development OTP: ${result.otp_preview}`;
      }
      showAlert("otpAlert", "OTP resent successfully.", "success");
    } catch (err) {
      showAlert("otpAlert", err.message);
    } finally {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = "Resend OTP";
    }
  });
}
