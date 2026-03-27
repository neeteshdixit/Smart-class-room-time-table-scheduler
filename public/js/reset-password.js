const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const resetPasswordEmail = document.getElementById("resetPasswordEmail");

const verifiedResetEmail = sessionStorage.getItem("reset_otp_verified_email");

if (!verifiedResetEmail) {
  window.location.href = "/forgot-otp.html";
}

if (resetPasswordEmail && verifiedResetEmail) {
  resetPasswordEmail.textContent = `Email: ${verifiedResetEmail}`;
}

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("resetPasswordAlert");

    const newPassword = resetPasswordForm.elements.new_password.value.trim();
    const confirmPassword = resetPasswordForm.elements.confirm_password.value.trim();

    if (newPassword !== confirmPassword) {
      showAlert("resetPasswordAlert", "New password and confirm password do not match.");
      return;
    }

    resetPasswordBtn.disabled = true;
    resetPasswordBtn.textContent = "Updating...";

    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifiedResetEmail,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      sessionStorage.removeItem("reset_email");
      sessionStorage.removeItem("reset_otp_verified_email");
      window.location.href = `/login.html?message=${encodeURIComponent("Password reset successful")}`;
    } catch (err) {
      showAlert("resetPasswordAlert", err.message);
    } finally {
      resetPasswordBtn.disabled = false;
      resetPasswordBtn.textContent = "Reset Password";
    }
  });
}
