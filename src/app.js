const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

function normalizePublicApiBase(value) {
  const base = String(value || "").trim();
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function parseCorsOrigins(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "*") {
    return { allowAll: true, origins: [] };
  }
  const origins = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { allowAll: origins.includes("*"), origins };
}

function buildCorsOptions() {
  const configured = parseCorsOrigins(process.env.CORS_ORIGIN);

  return {
    origin(origin, callback) {
      if (!origin || configured.allowAll || configured.origins.includes(origin)) {
        return callback(null, true);
      }
      if (String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/runtime-config.js", (req, res) => {
  const apiBaseUrl = normalizePublicApiBase(process.env.PUBLIC_API_BASE_URL);
  const payload = JSON.stringify({ apiBaseUrl });

  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(
    `window.__RUNTIME_CONFIG__ = ${payload};\nwindow.__API_BASE_URL__ = window.__RUNTIME_CONFIG__.apiBaseUrl || window.__API_BASE_URL__ || "";\n`
  );
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api", routes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.get("/faculty-timetable", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "faculty-timetable.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "profile.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
