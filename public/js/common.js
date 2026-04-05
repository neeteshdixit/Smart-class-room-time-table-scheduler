const DEFAULT_API_BASE = "/api";
const API_BASE_STORAGE_KEY = "api_base_url";
const AUTH_STORAGE_KEY = "auth_token";
const LOGIN_PAGE_PATH = "/login";
const REFRESH_TOKEN_ENDPOINT = "/auth/refresh-token";
const AUTH_TOKEN_KEYS = [AUTH_STORAGE_KEY, "token", "jwt", "jwt_token", "access_token"];
let refreshRequestPromise = null;

function normalizeApiBase(value) {
  const base = String(value || "").trim();
  if (!base) return DEFAULT_API_BASE;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function readQueryApiBase() {
  try {
    const value = new URLSearchParams(window.location.search).get("api_base_url");
    if (value) {
      return normalizeApiBase(value);
    }
  } catch (err) {
    // ignore malformed URL/query parsing errors
  }

  return "";
}

const queryApiBase = readQueryApiBase();
let activeApiBase = queryApiBase || localStorage.getItem(API_BASE_STORAGE_KEY) || DEFAULT_API_BASE;
if (queryApiBase) {
  localStorage.setItem(API_BASE_STORAGE_KEY, queryApiBase);
}

function readRuntimeApiBase() {
  try {
    const fromWindow =
      window.API_BASE_URL || window.__API_BASE_URL__ || window.__RUNTIME_CONFIG__?.apiBaseUrl;
    if (fromWindow) return normalizeApiBase(fromWindow);

    const metaTag = document.querySelector('meta[name="api-base-url"]');
    if (metaTag?.content) return normalizeApiBase(metaTag.content);
  } catch (err) {
    // ignore runtime config read errors
  }

  return "";
}

function isSecurePage() {
  return String(window.location.protocol || "").toLowerCase() === "https:";
}

function isHttpUrl(value) {
  return /^http:\/\//i.test(String(value || ""));
}

function getApiBaseCandidates() {
  const runtimeApiBase = readRuntimeApiBase();
  const candidates = [runtimeApiBase, normalizeApiBase(activeApiBase), DEFAULT_API_BASE];
  const hostname = window.location.hostname || "localhost";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  if (window.location.origin && window.location.origin !== "null") {
    candidates.push(`${window.location.origin}/api`);
  }

  // Only try localhost hardcoded dev fallbacks in local/dev browsing contexts.
  if (!isSecurePage() || isLocalHost) {
    candidates.push(`http://${hostname}:5000/api`);
    if (hostname !== "127.0.0.1") {
      candidates.push("http://127.0.0.1:5000/api");
    }
    if (hostname !== "localhost") {
      candidates.push("http://localhost:5000/api");
    }
  }

  const normalized = [...new Set(candidates.filter(Boolean).map(normalizeApiBase))];
  if (!isSecurePage()) return normalized;

  // On HTTPS pages, skip insecure absolute HTTP targets to avoid mixed-content failures.
  return normalized.filter((candidate) => !isHttpUrl(candidate));
}

function setActiveApiBase(base) {
  activeApiBase = normalizeApiBase(base);
  localStorage.setItem(API_BASE_STORAGE_KEY, activeApiBase);
}

function buildApiUrl(apiBase, endpoint) {
  const path = String(endpoint || "").startsWith("/") ? endpoint : `/${endpoint || ""}`;
  return `${normalizeApiBase(apiBase)}${path}`;
}

function stripInternalRequestOptions(options = {}) {
  const cleaned = { ...options };
  delete cleaned._skipAuthRefresh;
  delete cleaned._retryAfterRefresh;
  return cleaned;
}

function applyDefaultFetchOptions(options = {}) {
  const cleaned = stripInternalRequestOptions(options);
  if (!cleaned.credentials) {
    cleaned.credentials = "include";
  }
  return cleaned;
}

async function parseApiResponseBody(response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (err) {
    return { _rawText: text };
  }
}

function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(String(text || "").slice(0, 200));
}

function getFallbackErrorMessage(response, parsedBody, requestUrl) {
  const apiMessage = String(parsedBody?.message || "").trim();
  if (apiMessage) return apiMessage;

  const rawText = String(parsedBody?._rawText || "").trim();
  if (rawText && !looksLikeHtml(rawText)) {
    return rawText.slice(0, 220);
  }

  if (response.status === 404) {
    return `API route not found (404) for ${requestUrl}. Check deployed API base URL.`;
  }

  if ([502, 503, 504].includes(response.status)) {
    return `API gateway error (${response.status}). Check backend health, SMTP settings, and network/firewall rules.`;
  }

  return `Request failed (${response.status})`;
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

function shouldSkipAuthRefresh(endpoint, options = {}) {
  if (options._skipAuthRefresh) return true;
  const normalizedEndpoint = String(endpoint || "").trim().toLowerCase();
  if (!normalizedEndpoint) return false;
  if (normalizedEndpoint.startsWith(REFRESH_TOKEN_ENDPOINT)) return true;
  if (normalizedEndpoint.startsWith("/auth/login")) return true;
  if (normalizedEndpoint.startsWith("/auth/verify-login-otp")) return true;
  if (normalizedEndpoint.startsWith("/auth/resend-otp")) return true;
  if (normalizedEndpoint.startsWith("/auth/forgot-password")) return true;
  if (normalizedEndpoint.startsWith("/auth/verify-otp")) return true;
  if (normalizedEndpoint.startsWith("/auth/reset-password")) return true;
  return false;
}

async function requestAccessTokenRefresh() {
  if (refreshRequestPromise) {
    return refreshRequestPromise;
  }

  refreshRequestPromise = (async () => {
    const candidates = getApiBaseCandidates();
    let lastError = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const base = candidates[index];
      const requestUrl = buildApiUrl(base, REFRESH_TOKEN_ENDPOINT);

      try {
        const response = await fetch(requestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await parseApiResponseBody(response);

        if (response.ok) {
          const token = String(data?.access_token || data?.token || "").trim();
          if (token) {
            setAuthToken(token);
          }
          setActiveApiBase(base);
          return data;
        }

        const error = new Error(getFallbackErrorMessage(response, data, requestUrl));
        error.status = response.status;
        lastError = error;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unable to refresh session");
  })().finally(() => {
    refreshRequestPromise = null;
  });

  return refreshRequestPromise;
}

async function apiRequest(endpoint, options = {}) {
  const candidates = getApiBaseCandidates();
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const base = candidates[index];
    const isLast = index === candidates.length - 1;
    const requestUrl = buildApiUrl(base, endpoint);

    try {
      const response = await fetch(requestUrl, applyDefaultFetchOptions(options));
      const data = await parseApiResponseBody(response);

      if (response.ok) {
        setActiveApiBase(base);
        const responseToken = String(data?.access_token || "").trim();
        if (responseToken) {
          setAuthToken(responseToken);
        }
        return data;
      }

      if (response.status === 401 && !shouldSkipAuthRefresh(endpoint, options) && !options._retryAfterRefresh) {
        try {
          await requestAccessTokenRefresh();
          return apiRequest(endpoint, {
            ...options,
            _retryAfterRefresh: true,
          });
        } catch (refreshError) {
          // Continue with standard error handling below.
        }
      }

      // Try the next candidate when current base likely does not host API routes.
      if (!isLast && [404, 502, 503, 504].includes(response.status)) {
        continue;
      }

      const message = getFallbackErrorMessage(response, data, requestUrl);
      const error = new Error(message);
      error.validationErrors = Array.isArray(data.errors) ? data.errors : [];
      error.responseData = data;
      error.status = response.status;
      error.apiBase = base;
      throw error;
    } catch (error) {
      lastError = error;
      if (!isLast && error.name === "TypeError") {
        continue;
      }
      throw error;
    }
  }

  if (lastError?.name === "TypeError") {
    throw new Error(
      "Unable to reach the server. Check backend status, API base URL, CORS, HTTPS/mixed-content rules, and firewall settings."
    );
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
    await apiRequest("/auth/logout", {
      method: "POST",
      headers: token ? authHeaders() : { "Content-Type": "application/json" },
      _skipAuthRefresh: true,
    });
  } catch (err) {
    // ignore logout API failures and continue client-side sign-out
  } finally {
    clearAuthToken();
    sessionStorage.removeItem("login_token");
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
