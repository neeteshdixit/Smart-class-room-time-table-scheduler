const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  findDuplicateByFacultyEmailMobile,
  countAdmins,
  createFacultyUser,
  findByIdentifier,
  findBasicById,
  findByEmail,
  findByEmailOrFacultyId,
  updatePasswordHash,
  updateLastLogin,
} = require("../models/facultyUserModel");
const { createOtpVerification, findValidOtp, markOtpUsed } = require("../models/otpModel");
const {
  cleanupExpiredResetOtps,
  deleteResetOtpsByUser,
  createPasswordResetOtp,
  findLatestActiveResetOtpByEmail,
  incrementResetOtpAttempt,
  markResetOtpVerified,
  findLatestVerifiedResetOtpByEmail,
  deleteResetOtpById,
} = require("../models/passwordResetModel");
const {
  listDepartments,
  listSubjects,
  getDepartmentsByIds,
  getSubjectsByIds,
  findOrCreateDepartmentByName,
  findOrCreateSubjectByName,
} = require("../models/academicLookupModel");
const { addFacultyDepartments, addFacultyUserSubjects } = require("../models/facultyMappingModel");
const { generateOtp, maskMobileNumber } = require("../utils/otp");
const { sendPasswordResetOtpEmail } = require("../utils/mailer");
const { logActivity } = require("../utils/activity");

const ROLE_FACULTY = "FACULTY";
const ROLE_ADMIN = "ADMIN";
const ROLE_USER = "USER";
const ADMIN_EXISTS_MESSAGE = "Admin account already exists. Contact administrator.";

function buildError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPositiveInt(rawValue, fallback) {
  const value = Number.parseInt(rawValue, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getResetOtpExpiryMinutes() {
  return toPositiveInt(process.env.PASSWORD_RESET_OTP_EXPIRES_MINUTES, 5);
}

function getResetOtpMaxAttempts() {
  return toPositiveInt(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS, 5);
}

function isTruthyEnvFlag(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function shouldIncludeOtpPreview() {
  const raw = String(process.env.OTP_PREVIEW_ENABLED || "").trim();
  if (raw) {
    return isTruthyEnvFlag(raw);
  }
  // Default disabled in production, enabled elsewhere for easier local testing.
  return String(process.env.NODE_ENV || "").trim().toLowerCase() !== "development";
}

function normalizeRole(inputRole) {
  const value = String(inputRole || ROLE_FACULTY).trim().toLowerCase();
  if (value === "admin") return ROLE_ADMIN;
  if (value === "user") return ROLE_USER;
  return ROLE_FACULTY;
}

function parseIdArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
      }
    } catch (err) {
      const parts = value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return [...new Set(parts)];
    }
  }

  return [];
}

function parseNameArray(value) {
  let candidates = [];

  if (Array.isArray(value)) {
    candidates = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        candidates = parsed;
      } else {
        candidates = value.split(",");
      }
    } catch (err) {
      candidates = value.split(",");
    }
  }

  const unique = new Map();
  candidates.forEach((entry) => {
    const normalized = String(entry || "").trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  });

  return [...unique.values()];
}

function isAdminActor(actorUser) {
  return String(actorUser?.role || "").toLowerCase() === "admin";
}

async function getSignupMeta(actorUser) {
  const totalAdmins = await countAdmins();
  const requesterIsAdmin = isAdminActor(actorUser);
  const adminExists = totalAdmins > 0;

  return {
    admin_exists: adminExists,
    admin_count: totalAdmins,
    requester_is_admin: requesterIsAdmin,
    admin_signup_enabled: !adminExists,
    allowed_roles: adminExists ? [ROLE_FACULTY, ROLE_USER] : [ROLE_ADMIN, ROLE_FACULTY, ROLE_USER],
  };
}

async function checkAdminAvailability() {
  const totalAdmins = await countAdmins();
  const adminExists = totalAdmins > 0;

  return {
    admin_exists: adminExists,
    admin_count: totalAdmins,
    admin_signup_enabled: !adminExists,
    message: adminExists ? ADMIN_EXISTS_MESSAGE : "Admin signup is available.",
  };
}

async function getSignupOptions() {
  const [departments, subjects] = await Promise.all([listDepartments(), listSubjects()]);
  return { departments, subjects };
}

async function getDepartments() {
  return listDepartments();
}

async function signup(payload, actorUser = null, uploadedFile = null, options = {}) {
  if (payload.password !== payload.confirm_password) {
    throw buildError(400, "Password and confirm password do not match");
  }

  const allowAdminRole = options.allowAdminRole !== false;
  const role = normalizeRole(payload.role);
  const departmentIds = parseIdArray(payload.department_ids);
  const departmentNames = parseNameArray(payload.department_names);
  const subjectIds = parseIdArray(payload.subject_ids);
  const subjectNames = parseNameArray(payload.subject_names);

  if (role === ROLE_ADMIN && !allowAdminRole) {
    throw buildError(403, "Use admin signup endpoint to create an admin account.");
  }

  if (role === ROLE_FACULTY && departmentIds.length === 0 && departmentNames.length === 0) {
    throw buildError(400, "At least one department is required for faculty registration.");
  }

  if (role === ROLE_FACULTY && subjectIds.length === 0 && subjectNames.length === 0) {
    throw buildError(400, "At least one subject is required for faculty registration.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const duplicate = await findDuplicateByFacultyEmailMobile(
      payload.faculty_id,
      payload.email,
      payload.mobile_number,
      client
    );

    if (duplicate) {
      const conflictFields = [];
      if (duplicate.faculty_id === payload.faculty_id) conflictFields.push("Faculty ID");
      if (duplicate.email === payload.email.toLowerCase()) conflictFields.push("Email");
      if (duplicate.mobile_number === payload.mobile_number) conflictFields.push("Mobile Number");

      throw buildError(409, `Account already exists with this ${conflictFields.join(" / ")}`);
    }

    if (role === ROLE_ADMIN) {
      const totalAdmins = await countAdmins(client);
      if (totalAdmins > 0) {
        throw buildError(409, ADMIN_EXISTS_MESSAGE);
      }
    }

    const [departmentsById, subjectsById] = await Promise.all([
      getDepartmentsByIds(departmentIds, client),
      getSubjectsByIds(subjectIds, client),
    ]);

    if (departmentIds.length > 0 && departmentsById.length !== departmentIds.length) {
      throw buildError(400, "One or more selected departments are invalid.");
    }

    if (subjectIds.length > 0 && subjectsById.length !== subjectIds.length) {
      throw buildError(400, "One or more selected subjects are invalid.");
    }

    const departmentMap = new Map(departmentsById.map((department) => [department.id, department]));
    for (const departmentName of departmentNames) {
      const department = await findOrCreateDepartmentByName(departmentName, client);
      departmentMap.set(department.id, department);
    }
    const resolvedDepartments = [...departmentMap.values()];
    const resolvedDepartmentIds = resolvedDepartments.map((department) => department.id);

    const subjectMap = new Map(subjectsById.map((subject) => [subject.id, subject]));
    let subjectDepartmentId = resolvedDepartmentIds[0] || null;
    if (!subjectDepartmentId && subjectNames.length > 0) {
      const availableDepartments = await listDepartments(client);
      subjectDepartmentId = availableDepartments[0]?.id || null;
    }
    for (const subjectName of subjectNames) {
      if (!subjectDepartmentId) {
        throw buildError(400, "At least one department is required before creating subjects.");
      }
      const subject = await findOrCreateSubjectByName(subjectName, subjectDepartmentId, client);
      subjectMap.set(subject.id, subject);
    }
    const resolvedSubjects = [...subjectMap.values()];
    const resolvedSubjectIds = resolvedSubjects.map((subject) => subject.id);

    if (role === ROLE_FACULTY && resolvedDepartmentIds.length === 0) {
      throw buildError(400, "At least one department is required for faculty registration.");
    }

    if (role === ROLE_FACULTY && resolvedSubjectIds.length === 0) {
      throw buildError(400, "At least one subject is required for faculty registration.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const departmentText =
      resolvedDepartments.length > 0 ? resolvedDepartments.map((d) => d.department_name).join(", ") : "General";
    const photoPath = uploadedFile ? `/uploads/profile-photos/${uploadedFile.filename}` : null;

    const user = await createFacultyUser(
      {
        ...payload,
        department: departmentText,
        profile_photo_url: photoPath,
        password_hash: passwordHash,
        role: role.charAt(0) + role.slice(1).toLowerCase(),
      },
      client
    );

    await addFacultyDepartments(user.id, resolvedDepartmentIds, client);
    await addFacultyUserSubjects(user.id, resolvedSubjectIds, client);

    await client.query("COMMIT");
    await logActivity(user.id, "User Signup", `Registered faculty_id=${payload.faculty_id}, role=${role}`);

    return {
      message: "Signup successful",
      user: {
        ...user,
        profile_photo_path: photoPath,
        department_ids: resolvedDepartmentIds,
        subject_ids: resolvedSubjectIds,
        department_names: resolvedDepartments.map((department) => department.department_name),
        subject_names: resolvedSubjects.map((subject) => subject.subject_name),
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      role === ROLE_ADMIN &&
      err.code === "23505" &&
      String(err.constraint || "").toLowerCase().includes("uq_single_admin_user")
    ) {
      throw buildError(409, ADMIN_EXISTS_MESSAGE);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function adminSignup(payload, uploadedFile = null) {
  const totalAdmins = await countAdmins();
  if (totalAdmins > 0) {
    throw buildError(409, ADMIN_EXISTS_MESSAGE);
  }

  const adminPayload = {
    ...payload,
    role: ROLE_ADMIN,
  };

  return signup(adminPayload, null, uploadedFile, { allowAdminRole: true });
}

async function login(payload) {
  const user = await findByIdentifier(payload.identifier);

  if (!user) {
    throw buildError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(payload.password, user.password_hash);
  if (!validPassword) {
    throw buildError(401, "Invalid credentials");
  }

  const normalizedRole = String(user.role || "")
    .trim()
    .toLowerCase();
  if (normalizedRole !== "admin" && normalizedRole !== "faculty") {
    throw buildError(403, "Login is allowed for Admin and Faculty roles only.");
  }

  const otpCode = generateOtp(6);
  await createOtpVerification(user.id, user.mobile_number, otpCode);

  const loginToken = jwt.sign({ userId: user.id, otpPending: true }, process.env.JWT_SECRET, {
    expiresIn: process.env.LOGIN_OTP_TOKEN_EXPIRES_IN || "10m",
  });

  await logActivity(user.id, "Login Initiated", `OTP sent to ${maskMobileNumber(user.mobile_number)}`);

  return {
    message: "Credentials verified. OTP sent to your registered mobile number.",
    role: normalizedRole.toUpperCase(),
    login_token: loginToken,
    mobile_number_masked: maskMobileNumber(user.mobile_number),
    otp_preview: shouldIncludeOtpPreview() ? otpCode : undefined,
  };
}

async function verifyLoginOtp(payload) {
  let decoded;
  try {
    decoded = jwt.verify(payload.login_token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw buildError(401, "Login session expired. Please login again.");
    }
    throw buildError(401, "Invalid login token");
  }

  if (!decoded.otpPending) {
    throw buildError(400, "Invalid login token state");
  }

  const otpRow = await findValidOtp(decoded.userId, payload.otp_code);
  if (!otpRow) {
    throw buildError(401, "Invalid or expired OTP");
  }

  await markOtpUsed(otpRow.id);

  const user = await findBasicById(decoded.userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  await updateLastLogin(user.id);
  await logActivity(user.id, "Login Successful", "OTP verified and dashboard access granted");

  const token = jwt.sign(
    {
      userId: user.id,
      facultyId: user.faculty_id,
      role: user.role,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30m" }
  );

  return {
    message: "OTP verified successfully",
    token,
    user,
  };
}

async function resendOtp(payload) {
  let decoded;
  try {
    decoded = jwt.verify(payload.login_token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw buildError(401, "Login session expired. Please login again.");
    }
    throw buildError(401, "Invalid login token");
  }

  if (!decoded.otpPending) {
    throw buildError(400, "Invalid login token state");
  }

  const user = await findBasicById(decoded.userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  const otpCode = generateOtp(6);
  await createOtpVerification(user.id, user.mobile_number, otpCode);
  await logActivity(user.id, "OTP Resent", `OTP resent to ${maskMobileNumber(user.mobile_number)}`);

  return {
    message: "OTP resent successfully",
    otp_preview: shouldIncludeOtpPreview() ? otpCode : undefined,
  };
}

async function forgotPassword(payload) {
  const identifier = String(payload.email || payload.faculty_id || "").trim();
  if (!identifier) {
    throw buildError(400, "Email or Faculty ID is required");
  }

  const user = await findByEmailOrFacultyId(identifier);
  if (!user) {
    throw buildError(404, "Account not found");
  }

  await cleanupExpiredResetOtps();

  const otpCode = generateOtp(6);
  const expiryMinutes = getResetOtpExpiryMinutes();
  await deleteResetOtpsByUser(user.id);
  await createPasswordResetOtp(user.id, user.email, otpCode, expiryMinutes);

  let emailDelivery = "sent";
  try {
    await sendPasswordResetOtpEmail(user.email, otpCode);
  } catch (err) {
    if (!shouldIncludeOtpPreview()) {
      await deleteResetOtpsByUser(user.id);
      if (err.statusCode) {
        throw err;
      }
      throw buildError(500, "Unable to send OTP email right now. Please try again.");
    }
    emailDelivery = "preview_only";
  }

  await logActivity(user.id, "Forgot Password Requested", "Password reset OTP sent to registered email");

  return {
    message:
      emailDelivery === "sent"
        ? "OTP sent to your registered email"
        : "SMTP delivery failed. OTP generated in preview mode for development.",
    email: user.email,
    delivery: emailDelivery,
    otp_preview: shouldIncludeOtpPreview() ? otpCode : undefined,
  };
}

async function verifyOtp(payload) {
  await cleanupExpiredResetOtps();

  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "Account not found");
  }

  const otpRow = await findLatestActiveResetOtpByEmail(user.email);
  if (!otpRow) {
    throw buildError(401, "Invalid or expired OTP");
  }

  const maxAttempts = getResetOtpMaxAttempts();
  if (otpRow.attempt_count >= maxAttempts) {
    await deleteResetOtpById(otpRow.id);
    throw buildError(401, "Invalid or expired OTP");
  }

  if (String(payload.otp || "").trim() !== otpRow.otp_code) {
    const updated = await incrementResetOtpAttempt(otpRow.id);
    if (updated && updated.attempt_count >= maxAttempts) {
      await deleteResetOtpById(otpRow.id);
    }
    throw buildError(401, "Invalid or expired OTP");
  }

  await markResetOtpVerified(otpRow.id);
  await logActivity(user.id, "Password Reset OTP Verified", "Password reset OTP verified successfully");

  return {
    message: "OTP verified successfully",
    can_reset_password: true,
    email: user.email,
  };
}

async function resetPassword(payload) {
  const confirmPassword = payload.confirm_password || payload.new_password;
  if (payload.new_password !== confirmPassword) {
    throw buildError(400, "New password and confirm password do not match.");
  }

  await cleanupExpiredResetOtps();

  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "Account not found");
  }

  const verifiedOtp = await findLatestVerifiedResetOtpByEmail(user.email);
  if (!verifiedOtp) {
    throw buildError(401, "OTP verification required");
  }

  const passwordHash = await bcrypt.hash(payload.new_password, 10);
  await updatePasswordHash(user.id, passwordHash);
  await deleteResetOtpsByUser(user.id);
  await logActivity(user.id, "Password Reset Successful", "Password was reset using OTP flow");

  return {
    message: "Password reset successful",
  };
}

module.exports = {
  signup,
  login,
  verifyLoginOtp,
  verifyOtp,
  resendOtp,
  getSignupMeta,
  checkAdminAvailability,
  getSignupOptions,
  getDepartments,
  adminSignup,
  forgotPassword,
  resetPassword,
};
