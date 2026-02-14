const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const {
  findDuplicateByFacultyEmailMobile,
  countAdmins,
  createFacultyUser,
  findByIdentifier,
  findBasicById,
  findByEmail,
  updatePasswordHash,
  updateLastLogin,
} = require("../models/facultyUserModel");
const { createOtpVerification, findValidOtp, markOtpUsed } = require("../models/otpModel");
const {
  invalidateActiveResetTokens,
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
} = require("../models/passwordResetModel");
const {
  listDepartments,
  listSubjects,
  getDepartmentsByIds,
  getSubjectsByIds,
} = require("../models/academicLookupModel");
const { addFacultyDepartments, addFacultyUserSubjects } = require("../models/facultyMappingModel");
const { generateOtp, maskMobileNumber } = require("../utils/otp");
const { logActivity } = require("../utils/activity");

const ROLE_FACULTY = "FACULTY";
const ROLE_ADMIN = "ADMIN";
const ROLE_USER = "USER";
const ADMIN_CREATE_RESTRICTED_MESSAGE =
  "Admin role is restricted. Only an existing admin can create another admin.";

function buildError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hashResetToken(resetToken) {
  return crypto.createHash("sha256").update(String(resetToken)).digest("hex");
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

function isAdminActor(actorUser) {
  return String(actorUser?.role || "").toLowerCase() === "admin";
}

async function getSignupMeta(actorUser) {
  const totalAdmins = await countAdmins();
  const requesterIsAdmin = isAdminActor(actorUser);

  return {
    admin_exists: totalAdmins > 0,
    requester_is_admin: requesterIsAdmin,
    admin_signup_enabled: requesterIsAdmin,
    allowed_roles: requesterIsAdmin
      ? [ROLE_ADMIN, ROLE_FACULTY, ROLE_USER]
      : [ROLE_FACULTY, ROLE_USER],
  };
}

async function getSignupOptions() {
  const [departments, subjects] = await Promise.all([listDepartments(), listSubjects()]);
  return { departments, subjects };
}

async function signup(payload, actorUser = null, uploadedFile = null) {
  if (payload.password !== payload.confirm_password) {
    throw buildError(400, "Password and confirm password do not match");
  }

  const role = normalizeRole(payload.role);
  const departmentIds = parseIdArray(payload.department_ids);
  const subjectIds = parseIdArray(payload.subject_ids);

  if (role === ROLE_ADMIN && !isAdminActor(actorUser)) {
    throw buildError(403, ADMIN_CREATE_RESTRICTED_MESSAGE);
  }

  if (role === ROLE_FACULTY && departmentIds.length === 0) {
    throw buildError(400, "At least one department must be selected for faculty registration.");
  }

  if (role === ROLE_FACULTY && subjectIds.length === 0) {
    throw buildError(400, "At least one subject must be selected for faculty registration.");
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
      if (totalAdmins > 0 && !isAdminActor(actorUser)) {
        throw buildError(403, ADMIN_CREATE_RESTRICTED_MESSAGE);
      }
    }

    const [departments, subjects] = await Promise.all([
      getDepartmentsByIds(departmentIds, client),
      getSubjectsByIds(subjectIds, client),
    ]);

    if (departmentIds.length > 0 && departments.length !== departmentIds.length) {
      throw buildError(400, "One or more selected departments are invalid.");
    }

    if (subjectIds.length > 0 && subjects.length !== subjectIds.length) {
      throw buildError(400, "One or more selected subjects are invalid.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const departmentText =
      departments.length > 0 ? departments.map((d) => d.department_name).join(", ") : "General";
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

    await addFacultyDepartments(user.id, departmentIds, client);
    await addFacultyUserSubjects(user.id, subjectIds, client);

    await client.query("COMMIT");
    await logActivity(user.id, "User Signup", `Registered faculty_id=${payload.faculty_id}, role=${role}`);

    return {
      message: "Signup successful",
      user: {
        ...user,
        profile_photo_path: photoPath,
        department_ids: departmentIds,
        subject_ids: subjectIds,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      role === ROLE_ADMIN &&
      err.code === "23505" &&
      String(err.constraint || "").toLowerCase().includes("uq_single_admin_user")
    ) {
      throw buildError(409, ADMIN_CREATE_RESTRICTED_MESSAGE);
    }
    throw err;
  } finally {
    client.release();
  }
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

  if (String(user.role || "").toLowerCase() !== "admin") {
    throw buildError(403, "Faculty can only register. Login access is allowed for Admin only.");
  }

  const otpCode = generateOtp(6);
  await createOtpVerification(user.id, user.mobile_number, otpCode);

  const loginToken = jwt.sign({ userId: user.id, otpPending: true }, process.env.JWT_SECRET, {
    expiresIn: process.env.LOGIN_OTP_TOKEN_EXPIRES_IN || "10m",
  });

  await logActivity(user.id, "Login Initiated", `OTP sent to ${maskMobileNumber(user.mobile_number)}`);

  return {
    message: "Credentials verified. OTP sent to your registered mobile number.",
    login_token: loginToken,
    mobile_number_masked: maskMobileNumber(user.mobile_number),
    otp_preview: process.env.NODE_ENV !== "production" ? otpCode : undefined,
  };
}

async function verifyOtp(payload) {
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
    otp_preview: process.env.NODE_ENV !== "production" ? otpCode : undefined,
  };
}

async function forgotPassword(payload) {
  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "User not found with this email.");
  }

  const resetToken = generateOtp(6);
  const resetTokenHash = hashResetToken(resetToken);

  await invalidateActiveResetTokens(user.id);
  await createPasswordResetToken(user.id, user.email, resetTokenHash);
  await logActivity(user.id, "Forgot Password Requested", "Password reset token generated");

  return {
    message: "Password reset token generated and valid for 10 minutes.",
    reset_token_preview: process.env.NODE_ENV !== "production" ? resetToken : undefined,
  };
}

async function verifyResetToken(payload) {
  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "User not found with this email.");
  }

  const tokenHash = hashResetToken(payload.reset_token);
  const tokenRow = await findValidPasswordResetToken(user.id, tokenHash);
  if (!tokenRow) {
    throw buildError(401, "Invalid or expired reset token.");
  }

  return {
    message: "Reset token verified successfully.",
    can_reset_password: true,
  };
}

async function resetPassword(payload) {
  if (payload.new_password !== payload.confirm_password) {
    throw buildError(400, "New password and confirm password do not match.");
  }

  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "User not found with this email.");
  }

  const tokenHash = hashResetToken(payload.reset_token);
  const tokenRow = await findValidPasswordResetToken(user.id, tokenHash);
  if (!tokenRow) {
    throw buildError(401, "Invalid or expired reset token.");
  }

  const passwordHash = await bcrypt.hash(payload.new_password, 10);
  await updatePasswordHash(user.id, passwordHash);
  await markPasswordResetTokenUsed(tokenRow.id);
  await logActivity(user.id, "Password Reset Successful", "Password was reset using forgot-password flow");

  return {
    message: "Password reset successful.",
  };
}

module.exports = {
  signup,
  login,
  verifyOtp,
  resendOtp,
  getSignupMeta,
  getSignupOptions,
  forgotPassword,
  verifyResetToken,
  resetPassword,
};

