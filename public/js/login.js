const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

const messageFromQuery = new URLSearchParams(window.location.search).get("message");
if (messageFromQuery) {
  showAlert("loginAlert", messageFromQuery, "success");
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("loginAlert");

    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      sessionStorage.setItem("login_token", result.login_token);

      showAlert("loginAlert", result.message, "success");
      setTimeout(() => {
        window.location.href = "/otp.html";
      }, 900);
    } catch (err) {
      showAlert("loginAlert", err.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
    }
  });
}
