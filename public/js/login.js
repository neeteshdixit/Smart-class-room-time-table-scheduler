const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("loginAlert");

    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying...";

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      sessionStorage.setItem("login_token", result.login_token);
      if (result.otp_preview) {
        sessionStorage.setItem("otp_preview", result.otp_preview);
      }

      showAlert("loginAlert", result.message, "success");
      setTimeout(() => {
        window.location.href = "/otp.html";
      }, 900);
    } catch (err) {
      showAlert("loginAlert", err.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Send OTP";
    }
  });
}

