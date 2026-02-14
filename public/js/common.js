const API_BASE = "/api";
const AUTH_STORAGE_KEY = "auth_token";

function getAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function setAuthToken(token) {
  localStorage.setItem(AUTH_STORAGE_KEY, token);
}

function clearAuthToken() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || "Request failed";
    const error = new Error(message);
    error.validationErrors = Array.isArray(data.errors) ? data.errors : [];
    throw error;
  }
  return data;
}

function showAlert(containerId, message, type = "danger") {
  const alertEl = document.getElementById(containerId);
  if (!alertEl) return;
  alertEl.className = `alert alert-${type} alert-inline`;
  alertEl.textContent = message;
  alertEl.style.display = "block";
}

function hideAlert(containerId) {
  const alertEl = document.getElementById(containerId);
  if (!alertEl) return;
  alertEl.style.display = "none";
}

function requireAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = "/login.html";
  }
}

function logout() {
  clearAuthToken();
  sessionStorage.removeItem("login_token");
  window.location.href = "/login.html";
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString();
}
