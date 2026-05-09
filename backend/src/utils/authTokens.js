const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = "20m";
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = "3h";
const DEFAULT_LOGIN_OTP_TOKEN_EXPIRES_IN = "2m";

function parseDurationToMs(value, fallbackMs) {
  const raw = String(value || "").trim();
  if (!raw) return fallbackMs;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallbackMs;
  }

  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(raw);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;

  const unit = String(match[2] || "ms").toLowerCase();
  if (unit === "ms") return amount;
  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;
  return fallbackMs;
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
}

function getRefreshJwtSecret() {
  return String(process.env.JWT_REFRESH_SECRET || "").trim() || getJwtSecret();
}

function getAccessTokenExpiresIn() {
  return String(process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_EXPIRES_IN).trim();
}

function getRefreshTokenExpiresIn() {
  return String(process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRES_IN).trim();
}

function getLoginOtpTokenExpiresIn() {
  return String(process.env.LOGIN_OTP_TOKEN_EXPIRES_IN || DEFAULT_LOGIN_OTP_TOKEN_EXPIRES_IN).trim();
}

function getRefreshTokenTtlMs() {
  return parseDurationToMs(getRefreshTokenExpiresIn(), 3 * 60 * 60 * 1000);
}

function getLoginOtpTtlMs() {
  return parseDurationToMs(getLoginOtpTokenExpiresIn(), 2 * 60 * 1000);
}

function getRefreshTokenCookieName() {
  const name = String(process.env.REFRESH_TOKEN_COOKIE_NAME || "").trim();
  return name || "refresh_token";
}

function buildRefreshCookieOptions() {
  const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
  const configuredSecure = String(process.env.AUTH_COOKIE_SECURE || "").trim().toLowerCase();
  let secure = configuredSecure ? configuredSecure === "true" : isProduction;

  const configuredSameSite = String(process.env.AUTH_COOKIE_SAMESITE || "").trim().toLowerCase();
  let sameSite = configuredSameSite || (secure ? "none" : "lax");
  if (!["strict", "lax", "none"].includes(sameSite)) {
    sameSite = secure ? "none" : "lax";
  }
  if (sameSite === "none") {
    secure = true;
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api",
    maxAge: getRefreshTokenTtlMs(),
  };
}

function createAccessTokenForUser(user) {
  return jwt.sign(
    {
      tokenType: "access",
      userId: user.id,
      facultyId: user.faculty_id,
      role: user.role,
      fullName: user.full_name,
      isMentor: Boolean(user.is_mentor),
      sectionId: user.section_id || user.sectionId || (String(user.role).toLowerCase() === 'user' ? user.office_location : null)
    },
    getJwtSecret(),
    { expiresIn: getAccessTokenExpiresIn() }
  );
}

function createRefreshToken({ userId, tokenId }) {
  return jwt.sign(
    {
      tokenType: "refresh",
      userId,
      tokenId,
    },
    getRefreshJwtSecret(),
    { expiresIn: getRefreshTokenExpiresIn() }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshJwtSecret());
}

function createRefreshTokenId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function parseCookies(cookieHeader) {
  const result = {};
  String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const index = chunk.indexOf("=");
      if (index <= 0) return;
      const key = chunk.slice(0, index).trim();
      const value = chunk.slice(index + 1).trim();
      try {
        result[key] = decodeURIComponent(value);
      } catch (err) {
        result[key] = value;
      }
    });
  return result;
}

function readRefreshTokenFromRequest(req) {
  const cookieName = getRefreshTokenCookieName();
  const cookies = parseCookies(req?.headers?.cookie || "");
  const fromCookie = String(cookies[cookieName] || "").trim();
  if (fromCookie) return fromCookie;

  const fromBody = String(req?.body?.refresh_token || "").trim();
  if (fromBody) return fromBody;

  const authHeader = String(req?.headers?.authorization || "").trim();
  if (/^bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^bearer\s+/i, "").trim();
  }

  return "";
}

module.exports = {
  buildRefreshCookieOptions,
  createAccessTokenForUser,
  createRefreshToken,
  createRefreshTokenId,
  getLoginOtpTokenExpiresIn,
  getLoginOtpTtlMs,
  getRefreshTokenCookieName,
  getRefreshTokenTtlMs,
  parseDurationToMs,
  readRefreshTokenFromRequest,
  verifyRefreshToken,
};
