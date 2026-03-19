const jwt = require("jsonwebtoken");

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.otpPending) {
      return res
        .status(401)
        .json({ message: "OTP verification is required before access" });
    }

    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRoles(...roles) {
  const allowedRoles = [...new Set(roles.map((role) => normalizeRole(role)).filter(Boolean))];

  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: `Access denied. Allowed roles: ${allowedRoles.join(", ").toUpperCase()}`,
      });
    }
    return next();
  };
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.otpPending) {
      req.user = payload;
    }
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = { authRequired, requireRoles, optionalAuth };
