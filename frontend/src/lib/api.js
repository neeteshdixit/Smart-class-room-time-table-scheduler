import axios from "axios";

const ACCESS_TOKEN_KEY = "scts_access_token";
const USER_KEY = "scts_user";
const ROLE_KEY = "scts_role";
const PENDING_LOGIN_KEY = "scts_pending_login";
const RESET_CONTEXT_KEY = "scts_reset_context";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const authKeys = {
  accessToken: ACCESS_TOKEN_KEY,
  user: USER_KEY,
  role: ROLE_KEY,
  pendingLogin: PENDING_LOGIN_KEY,
  resetContext: RESET_CONTEXT_KEY,
};

export function readStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function writeStoredAccessToken(token) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function writeStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function writeStoredRole(role) {
  if (role) {
    localStorage.setItem(ROLE_KEY, String(role).toLowerCase());
  } else {
    localStorage.removeItem(ROLE_KEY);
  }
}

export function clearStoredAuth() {
  [ACCESS_TOKEN_KEY, USER_KEY, ROLE_KEY].forEach((key) => localStorage.removeItem(key));
}

export function readPendingLogin() {
  const raw = sessionStorage.getItem(PENDING_LOGIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function writePendingLogin(payload) {
  if (payload) {
    sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(payload));
  } else {
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
  }
}

export function readResetContext() {
  const raw = sessionStorage.getItem(RESET_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function writeResetContext(payload) {
  if (payload) {
    sessionStorage.setItem(RESET_CONTEXT_KEY, JSON.stringify(payload));
  } else {
    sessionStorage.removeItem(RESET_CONTEXT_KEY);
  }
}

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

client.interceptors.request.use((config) => {
  const token = readStoredAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = client
      .post("/auth/refresh-token", {}, { _skipRefresh: true })
      .then((response) => {
        const token = String(response.data?.access_token || response.data?.token || "").trim();
        if (token) {
          writeStoredAccessToken(token);
        }
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error.config || {};
    const requestPath = String(originalRequest.url || "");
    const skipRefresh = originalRequest._skipRefresh || requestPath.includes("/auth/login") || requestPath.includes("/auth/verify-login-otp") || requestPath.includes("/auth/resend-otp") || requestPath.includes("/auth/forgot-password") || requestPath.includes("/auth/verify-otp") || requestPath.includes("/auth/reset-password");

    if (status === 401 && !skipRefresh && !originalRequest._retried) {
      originalRequest._retried = true;
      try {
        const refreshed = await refreshSession();
        const token = String(refreshed?.access_token || refreshed?.token || "").trim();
        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        clearStoredAuth();
      }
    }

    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";
    const normalized = new Error(message);
    normalized.status = status;
    normalized.response = error?.response;
    normalized.data = error?.response?.data;
    throw normalized;
  }
);

function unwrap(response) {
  return response?.data;
}

export const authApi = {
  login: (payload) => client.post("/auth/login", payload).then(unwrap),
  verifyLoginOtp: (payload) => client.post("/auth/verify-login-otp", payload).then(unwrap),
  resendOtp: (payload) => client.post("/auth/resend-otp", payload).then(unwrap),
  forgotPassword: (payload) => client.post("/auth/forgot-password", payload).then(unwrap),
  verifyOtp: (payload) => client.post("/auth/verify-otp", payload).then(unwrap),
  resetPassword: (payload) => client.post("/auth/reset-password", payload).then(unwrap),
  signupMeta: () => client.get("/auth/signup-meta").then(unwrap),
  signupOptions: () => client.get("/auth/signup-options").then(unwrap),
  signup: (payload) => client.post("/auth/signup", payload).then(unwrap),
  logout: () => client.post("/auth/logout", {}).then(unwrap),
};

export const profileApi = {
  get: () => client.get("/profile").then(unwrap),
  update: (payload) => client.put("/profile", payload).then(unwrap),
  deleteAccount: (payload) => client.delete("/profile/delete-account", { data: payload }).then(unwrap),
};

export const statsApi = {
  get: (includeActivity = false) =>
    client.get("/stats", { params: { include_activity: includeActivity ? "true" : "false" } }).then(unwrap),
};

export const dashboardApi = {
  activityLog: (params = {}) => client.get("/activity-log", { params }).then(unwrap),
  deleteActivity: (id) => client.delete(`/activity-log/${id}`).then(unwrap),
  timetableHistory: (params = {}) => client.get("/timetable/history", { params }).then(unwrap),
  timetableList: (params = {}) => client.get("/timetable", { params }).then(unwrap),
  timetableDetail: (id) => client.get(`/timetable/${id}`).then(unwrap),
  generateTimetable: (payload) => client.post("/timetable/generate", payload).then(unwrap),
  approveTimetable: (id, payload) => client.post(`/timetable/${id}/approval`, payload).then(unwrap),
  workloadReport: () => client.get("/timetable/reports/workload").then(unwrap),
  roomUtilizationReport: () => client.get("/timetable/reports/room-utilization").then(unwrap),
  subjectDistributionReport: () => client.get("/timetable/reports/subject-distribution").then(unwrap),
  conflictsReport: () => client.get("/timetable/reports/conflicts").then(unwrap),
};

export const masterApi = {
  list: (resource, params = {}) => client.get(`/master/${resource}`, { params }).then(unwrap),
  create: (resource, payload) => client.post(`/master/${resource}`, payload).then(unwrap),
  update: (resource, id, payload) => client.put(`/master/${resource}/${id}`, payload).then(unwrap),
  remove: (resource, id) => client.delete(`/master/${resource}/${id}`).then(unwrap),
};

export const facultyApi = {
  timetable: (params = {}) => client.get("/faculty/timetable", { params }).then(unwrap),
  studentTimetable: (params = {}) => client.get("/faculty/student-timetable", { params }).then(unwrap),
  downloadStudentTimetable: (params = {}) => client.get("/faculty/student-timetable/download", { params, responseType: "blob" }),
  shareStudentTimetable: (payload) => client.post("/faculty/student-timetable/share", payload).then(unwrap),
};

export function apiBaseUrl() {
  return BASE_URL;
}

export { client as apiClient };
