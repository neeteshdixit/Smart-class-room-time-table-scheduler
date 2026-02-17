const authService = require("../services/authService");

function handleError(err, next, res) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return next(err);
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
    const response = await authService.signup(req.body, req.user || null, req.file || null);
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

module.exports = {
  getSignupMeta,
  checkAdmin,
  getSignupOptions,
  signup,
  adminSignup,
  login,
  verifyLoginOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
};
