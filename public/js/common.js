const DEFAULT_API_BASE = "/api";
const API_BASE_STORAGE_KEY = "api_base_url";
const AUTH_STORAGE_KEY = "auth_token";
const LOGIN_PAGE_PATH = "/login";
const AUTH_TOKEN_KEYS = [AUTH_STORAGE_KEY, "token", "jwt", "jwt_token", "access_token"];
let activeApiBase = localStorage.getItem(API_BASE_STORAGE_KEY) || DEFAULT_API_BASE;

function normalizeApiBase(value) {
  const base = String(value || "").trim();
  if (!base) return DEFAULT_API_BASE;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function getApiBaseCandidates() {
  const candidates = [normalizeApiBase(activeApiBase), DEFAULT_API_BASE];
  const hostname = window.location.hostname || "localhost";
  candidates.push(`http://${hostname}:5000/api`);
  if (hostname !== "127.0.0.1") {
    candidates.push("http://127.0.0.1:5000/api");
  }
  if (hostname !== "localhost") {
    candidates.push("http://localhost:5000/api");
  }

  return [...new Set(candidates.map(normalizeApiBase))];
}

function setActiveApiBase(base) {
  activeApiBase = normalizeApiBase(base);
  localStorage.setItem(API_BASE_STORAGE_KEY, activeApiBase);
}

function buildApiUrl(apiBase, endpoint) {
  const path = String(endpoint || "").startsWith("/") ? endpoint : `/${endpoint || ""}`;
  return `${normalizeApiBase(apiBase)}${path}`;
}

function getAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function setAuthToken(token) {
  localStorage.setItem(AUTH_STORAGE_KEY, token);
}

function clearAuthToken() {
  AUTH_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
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
  const candidates = getApiBaseCandidates();
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const base = candidates[index];
    const isLast = index === candidates.length - 1;

    try {
      const response = await fetch(buildApiUrl(base, endpoint), options);
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setActiveApiBase(base);
        return data;
      }

      // Try the next candidate when current base likely does not host API routes.
      if (!isLast && [404, 502, 503, 504].includes(response.status)) {
        continue;
      }

      const message = data.message || "Request failed";
      const error = new Error(message);
      error.validationErrors = Array.isArray(data.errors) ? data.errors : [];
      error.responseData = data;
      error.status = response.status;
      throw error;
    } catch (error) {
      lastError = error;
      if (!isLast && error.name === "TypeError") {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Request failed");
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
    window.location.replace(LOGIN_PAGE_PATH);
  }
}

async function logout() {
  try {
    const token = getAuthToken();
    if (token) {
      await apiRequest("/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    }
  } catch (err) {
    // ignore logout API failures and continue client-side sign-out
  } finally {
    clearAuthToken();
    sessionStorage.removeItem("login_token");
    sessionStorage.removeItem("otp_preview");
    window.location.replace(LOGIN_PAGE_PATH);
  }
}

function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    if (button.dataset.logoutBound === "true") return;
    button.dataset.logoutBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindLogoutButtons);
} else {
  bindLogoutButtons();
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString();
}
