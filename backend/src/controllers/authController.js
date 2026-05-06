const authService = require("../services/authService");

function handleError(err, next, res) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return next(err);
}

function setRefreshCookie(res, refreshToken) {
  const { cookieName, cookieOptions } = authService.getRefreshCookieConfig();
  res.cookie(cookieName, refreshToken, cookieOptions);
}

function clearRefreshCookie(res) {
  const { cookieName, cookieOptions } = authService.getRefreshCookieConfig();
  res.clearCookie(cookieName, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
  });
}

async function getSignupMeta(req, res, next) {
  try {
    const meta = await authService.getSignupMeta(req.user || null);
    return res.json(meta);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function getSignupOptions(req, res, next) {
  try {
    const response = await authService.getSignupOptions();
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function getDepartments(req, res, next) {
  try {
    const departments = await authService.getDepartments();
    return res.json({ departments });
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function checkAdmin(req, res, next) {
  try {
    const response = await authService.checkAdminAvailability();
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function signup(req, res, next) {
  try {
    const response = await authService.signup(req.body, req.user || null, req.file || null, {
      allowAdminRole: false,
    });
    return res.status(201).json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function adminSignup(req, res, next) {
  try {
    const response = await authService.adminSignup(req.body, req.file || null);
    return res.status(201).json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function login(req, res, next) {
  try {
    const response = await authService.login(req.body);
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function verifyLoginOtp(req, res, next) {
  try {
    const response = await authService.verifyLoginOtp(req.body);
    if (response?.refresh_token) {
      setRefreshCookie(res, response.refresh_token);
      delete response.refresh_token;
    }
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function resendOtp(req, res, next) {
  try {
    const response = await authService.resendOtp(req.body);
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const response = await authService.forgotPassword(req.body);
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const response = await authService.verifyOtp(req.body);
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function resetPassword(req, res, next) {
  try {
    const response = await authService.resetPassword(req.body);
    return res.json(response);
  } catch (err) {
    return handleError(err, next, res);
  }
}

async function refreshAccessToken(req, res, next) {
  try {
    const refreshToken = authService.readRefreshTokenFromRequest(req);
    const response = await authService.refreshAccessToken({ refresh_token: refreshToken });
    if (response?.refresh_token) {
      setRefreshCookie(res, response.refresh_token);
      delete response.refresh_token;
    }
    return res.json(response);
  } catch (err) {
    clearRefreshCookie(res);
    return handleError(err, next, res);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = authService.readRefreshTokenFromRequest(req);
    const response = await authService.logout({
      refresh_token: refreshToken,
      userId: req.user?.userId,
    });
    clearRefreshCookie(res);
    return res.json(response);
  } catch (err) {
    clearRefreshCookie(res);
    return handleError(err, next, res);
  }
}

module.exports = {
  getSignupMeta,
  checkAdmin,
  getSignupOptions,
  getDepartments,
  signup,
  adminSignup,
  login,
  verifyLoginOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
};
