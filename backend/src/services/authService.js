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
const {
  listDepartments,
  listSubjects,
  listSections,
  getDepartmentsByIds,
  getSubjectsByIds,
  getSectionsByIds,
  findOrCreateDepartmentByName,
  findOrCreateSubjectByName,
} = require("../models/academicLookupModel");
const { addFacultyDepartments, addFacultyUserSubjects } = require("../models/facultyMappingModel");
const { addSectionMentorMappings } = require("../models/mentorMappingModel");
const { generateOtp } = require("../utils/otp");
const { sendLoginOtpEmail, sendPasswordResetOtpEmail, sendAccountDeleteOtpEmail } = require("../utils/mailer");
const { logActivity } = require("../utils/activity");
const {
  consumeLoginOtpChallenge,
  consumePasswordResetVerification,
  getLoginOtpChallenge,
  hasValidPasswordResetVerification,
  invalidateLoginOtpChallenge,
  invalidatePasswordResetOtp,
  resetLoginOtpChallenge,
  setLoginOtpChallenge,
  setPasswordResetOtp,
  verifyPasswordResetOtp,
  setAccountDeleteOtp,
  verifyAccountDeleteOtp,
  consumeAccountDeleteOtp,
} = require("../utils/transientOtpStore");
const {
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
} = require("../utils/authTokens");
const {
  createRefreshTokenRecord,
  deleteExpiredRefreshTokens,
  findRefreshTokenByTokenId,
  hashRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenByRawToken,
  revokeRefreshTokenByTokenId,
} = require("../models/refreshTokenModel");

const ROLE_FACULTY = "FACULTY";
const ROLE_ADMIN = "ADMIN";
const ROLE_USER = "USER";
const ROLE_TYPE_FACULTY_ONLY = "FACULTY_ONLY";
const ROLE_TYPE_FACULTY_MENTOR = "FACULTY_MENTOR";
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
  return toPositiveInt(process.env.PASSWORD_RESET_OTP_EXPIRES_MINUTES, 2);
}

function getResetOtpMaxAttempts() {
  return toPositiveInt(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS, 5);
}

function getResetOtpTtlMs() {
  const minutes = getResetOtpExpiryMinutes();
  return minutes * 60 * 1000;
}

function getResetVerificationTtlMs() {
  const fallbackMs = 10 * 60 * 1000;
  const raw = String(process.env.PASSWORD_RESET_VERIFIED_TTL || "").trim();
  if (raw) {
    return parseDurationToMs(raw, fallbackMs);
  }
  const minutes = toPositiveInt(process.env.PASSWORD_RESET_VERIFIED_TTL_MINUTES, 10);
  return minutes * 60 * 1000;
}

function getLoginOtpExpiryMinutes() {
  return Math.max(1, Math.ceil(getLoginOtpTtlMs() / (60 * 1000)));
}

function addMilliseconds(date, ms) {
  return new Date(date.getTime() + ms);
}

function normalizeRole(inputRole) {
  const value = String(inputRole || ROLE_FACULTY).trim().toLowerCase();
  if (value === "admin") return ROLE_ADMIN;
  if (value === "user") return ROLE_USER;
  return ROLE_FACULTY;
}

function getSafeString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeRoleType(inputRoleType, accountRole) {
  const normalizedRole = normalizeRole(accountRole);
  if (normalizedRole !== ROLE_FACULTY) {
    return ROLE_TYPE_FACULTY_ONLY;
  }

  const value = String(inputRoleType || ROLE_TYPE_FACULTY_ONLY)
    .trim()
    .toLowerCase();
  const token = value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  if (token === "faculty_mentor" || token === "faculty_plus_mentor" || token === "mentor") {
    return ROLE_TYPE_FACULTY_MENTOR;
  }

  return ROLE_TYPE_FACULTY_ONLY;
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
  const [departments, subjects, sections] = await Promise.all([listDepartments(), listSubjects(), listSections()]);
  return { departments, subjects, sections };
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
  const roleType = normalizeRoleType(payload.role_type, role);
  const isMentor = role === ROLE_FACULTY && roleType === ROLE_TYPE_FACULTY_MENTOR;
  const departmentIds = parseIdArray(payload.department_ids);
  const departmentNames = parseNameArray(payload.department_names);
  const subjectIds = parseIdArray(payload.subject_ids);
  const subjectNames = parseNameArray(payload.subject_names);
  const mentorSectionIds = isMentor ? parseIdArray(payload.mentor_section_ids) : [];
  const isStudent = role === ROLE_USER;

  if (role === ROLE_ADMIN && !allowAdminRole) {
    throw buildError(403, "Use admin signup endpoint to create an admin account.");
  }

  if (role === ROLE_FACULTY) {
    if (departmentIds.length === 0 && departmentNames.length === 0) {
      throw buildError(400, "At least one department is required for faculty registration.");
    }
    if (subjectIds.length === 0 && subjectNames.length === 0) {
      throw buildError(400, "At least one subject is required for faculty registration.");
    }
    if (isMentor && mentorSectionIds.length === 0) {
      throw buildError(400, "Select at least one section for Faculty + Mentor registration.");
    }
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

    if (isStudent && payload.faculty_id && String(payload.faculty_id).trim().length < 3) {
      throw buildError(400, "Student ID must be at least 3 characters long.");
    }

    const [departmentsById, subjectsById, mentorSectionsById] = await Promise.all([
      getDepartmentsByIds(departmentIds, client),
      getSubjectsByIds(subjectIds, client),
      getSectionsByIds(mentorSectionIds, client),
    ]);

    if (departmentIds.length > 0 && departmentsById.length !== departmentIds.length) {
      throw buildError(400, "One or more selected departments are invalid.");
    }

    if (subjectIds.length > 0 && subjectsById.length !== subjectIds.length) {
      throw buildError(400, "One or more selected subjects are invalid.");
    }

    if (isMentor && mentorSectionIds.length > 0 && mentorSectionsById.length !== mentorSectionIds.length) {
      throw buildError(400, "One or more selected mentor sections are invalid.");
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
    const resolvedMentorSectionIds = isMentor
      ? mentorSectionsById
          .map((section) => Number(section.id))
          .filter((sectionId) => Number.isInteger(sectionId) && sectionId > 0)
      : [];

    if (role === ROLE_FACULTY && resolvedDepartmentIds.length === 0) {
      throw buildError(400, "At least one department is required for faculty registration.");
    }

    if (role === ROLE_FACULTY && resolvedSubjectIds.length === 0) {
      throw buildError(400, "At least one subject is required for faculty registration.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const departmentText =
      resolvedDepartments.length > 0
        ? resolvedDepartments.map((d) => d.department_name).join(", ")
        : role === ROLE_USER
          ? getSafeString(payload.department, "Student")
          : "General";
    const designationText =
      role === ROLE_USER
        ? "Student"
        : getSafeString(payload.designation, role === ROLE_ADMIN ? "Administrator" : "Faculty");
    const genderText = getSafeString(payload.gender, role === ROLE_USER ? "Not specified" : "Unknown");
    const qualificationText = getSafeString(payload.qualification, role === ROLE_USER ? "Student" : "Unknown");
    const addressText = getSafeString(payload.address, role === ROLE_USER ? "Student" : "Address not provided");
    const joiningDateText = getSafeString(payload.joining_date, new Date().toISOString().slice(0, 10));
    const dobText = getSafeString(payload.dob, new Date().toISOString().slice(0, 10));
    const experienceYears = role === ROLE_USER ? 0 : Number(payload.experience_years || 0);
    const employeeTypeText = getSafeString(payload.employee_type, role === ROLE_USER ? "Student" : "Permanent");
    const photoPath = uploadedFile ? `/uploads/profile-photos/${uploadedFile.filename}` : null;

    const user = await createFacultyUser(
      {
        ...payload,
        department: departmentText,
        designation: designationText,
        gender: genderText,
        dob: dobText,
        qualification: qualificationText,
        experience_years: Number.isFinite(experienceYears) ? experienceYears : 0,
        address: addressText,
        joining_date: joiningDateText,
        profile_photo_url: photoPath,
        password_hash: passwordHash,
        role: role.charAt(0) + role.slice(1).toLowerCase(),
        is_mentor: isMentor,
        employee_type: employeeTypeText,
      },
      client
    );

    await addFacultyDepartments(user.id, resolvedDepartmentIds, client);
    await addFacultyUserSubjects(user.id, resolvedSubjectIds, client);
    await addSectionMentorMappings(user.id, resolvedMentorSectionIds, client);

    await client.query("COMMIT");
    await logActivity(
      user.id,
      "User Signup",
      `Registered faculty_id=${payload.faculty_id}, role=${role}, role_type=${roleType}`
    );

    return {
      message: "Signup successful",
      user: {
        ...user,
        profile_photo_path: photoPath,
        department_ids: resolvedDepartmentIds,
        subject_ids: resolvedSubjectIds,
        department_names: resolvedDepartments.map((department) => department.department_name),
        subject_names: resolvedSubjects.map((subject) => subject.subject_name),
        role_type: roleType,
        mentor_section_ids: resolvedMentorSectionIds,
        mentor_section_names: mentorSectionsById.map((section) => section.section_name),
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

function getRefreshCookieConfig() {
  return {
    cookieName: getRefreshTokenCookieName(),
    cookieOptions: buildRefreshCookieOptions(),
  };
}

function parseLoginToken(loginToken) {
  try {
    return jwt.verify(loginToken, process.env.JWT_SECRET);
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      throw buildError(401, "Login session expired. Please login again.");
    }
    throw buildError(401, "Invalid login token");
  }
}

async function issueSessionTokens(user, options = {}) {
  const refreshTokenId = createRefreshTokenId();
  const accessToken = createAccessTokenForUser(user);
  const refreshToken = createRefreshToken({ userId: user.id, tokenId: refreshTokenId });
  const refreshTokenExpiresAt = addMilliseconds(new Date(), getRefreshTokenTtlMs());
  const db = options.db || pool;

  if (options.rotateFromTokenId) {
    await revokeRefreshTokenByTokenId(
      String(options.rotateFromTokenId),
      { replacedByTokenId: refreshTokenId },
      db
    );
  }

  await createRefreshTokenRecord(
    {
      userId: user.id,
      tokenId: refreshTokenId,
      refreshToken,
      expiresAt: refreshTokenExpiresAt,
    },
    db
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenId,
    refreshTokenExpiresAt,
  };
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
  if (normalizedRole !== "admin" && normalizedRole !== "faculty" && normalizedRole !== "user") {
    throw buildError(403, "Login is allowed for Admin, Faculty, and Student roles only.");
  }

  const otpCode = generateOtp(6);
  const challengeId = createRefreshTokenId();
  setLoginOtpChallenge({
    challengeId,
    userId: user.id,
    email: user.email,
    otpCode,
    ttlMs: getLoginOtpTtlMs(),
  });

  // Send email in background to keep response fast
  sendLoginOtpEmail(user.email, otpCode, getLoginOtpExpiryMinutes()).catch((err) => {
    console.error("Background Login OTP Email Error:", err.message);
  });

  const loginToken = jwt.sign({ userId: user.id, otpPending: true, challengeId }, process.env.JWT_SECRET, {
    expiresIn: getLoginOtpTokenExpiresIn(),
  });

  await logActivity(user.id, "Login Initiated", "OTP sent to registered email");

  return {
    message: "Credentials verified. OTP sent to your registered email.",
    role: normalizedRole.toUpperCase(),
    login_token: loginToken,
    ...(String(process.env.NODE_ENV || "").toLowerCase() !== "production" ? { otp_code: otpCode } : {}),
  };
}

async function verifyLoginOtp(payload) {
  const decoded = parseLoginToken(payload.login_token);

  if (!decoded.otpPending || !decoded.challengeId) {
    throw buildError(400, "Invalid login token state");
  }

  const verified = consumeLoginOtpChallenge({
    challengeId: decoded.challengeId,
    userId: decoded.userId,
    otpCode: payload.otp_code,
  });
  if (!verified.ok) {
    throw buildError(401, "Invalid or expired OTP");
  }

  const user = await findBasicById(decoded.userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  await updateLastLogin(user.id);
  await logActivity(user.id, "Login Successful", "OTP verified and dashboard access granted");

  const tokens = await issueSessionTokens(user);
  await deleteExpiredRefreshTokens().catch(() => {});

  return {
    message: "OTP verified successfully",
    token: tokens.accessToken,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    refresh_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
    user,
  };
}

async function resendOtp(payload) {
  const decoded = parseLoginToken(payload.login_token);

  if (!decoded.otpPending || !decoded.challengeId) {
    throw buildError(400, "Invalid login token state");
  }

  const user = await findBasicById(decoded.userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  const challenge = getLoginOtpChallenge(decoded.challengeId);
  if (!challenge) {
    throw buildError(401, "Login session expired. Please login again.");
  }

  const otpCode = generateOtp(6);
  resetLoginOtpChallenge({
    challengeId: decoded.challengeId,
    otpCode,
    ttlMs: getLoginOtpTtlMs(),
  });

  // Send email in background to keep response fast
  // Send email in background to keep response fast
  sendLoginOtpEmail(user.email, otpCode, getLoginOtpExpiryMinutes()).catch((err) => {
    console.error("Background Resend OTP Email Error:", err.message);
  });

  await logActivity(user.id, "OTP Resent", "OTP resent to registered email");

  return {
    message: "OTP resent successfully to your registered email.",
    ...(String(process.env.NODE_ENV || "").toLowerCase() !== "production" ? { otp_code: otpCode } : {}),
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

  const otpCode = generateOtp(6);
  const expiryMinutes = getResetOtpExpiryMinutes();
  invalidatePasswordResetOtp(user.email);
  setPasswordResetOtp({
    email: user.email,
    userId: user.id,
    otpCode,
    ttlMs: getResetOtpTtlMs(),
  });

  // Send email in background to keep response fast
  sendPasswordResetOtpEmail(user.email, otpCode, expiryMinutes).catch((err) => {
    console.error("Background Password Reset OTP Email Error:", err.message);
  });

  await logActivity(user.id, "Forgot Password Requested", "Password reset OTP sent to registered email");

  return {
    message: "OTP sent to your registered email",
    email: user.email,
    ...(String(process.env.NODE_ENV || "").toLowerCase() !== "production" ? { otp_code: otpCode } : {}),
  };
}

async function verifyOtp(payload) {
  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "Account not found");
  }

  const verified = verifyPasswordResetOtp({
    email: user.email,
    otpCode: payload.otp,
    maxAttempts: getResetOtpMaxAttempts(),
    verifiedTtlMs: getResetVerificationTtlMs(),
  });
  if (!verified.ok) {
    throw buildError(401, "Invalid or expired OTP");
  }

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

  const user = await findByEmail(payload.email);
  if (!user) {
    throw buildError(404, "Account not found");
  }

  if (!hasValidPasswordResetVerification(user.email)) {
    throw buildError(401, "OTP verification required");
  }

  const passwordHash = await bcrypt.hash(payload.new_password, 10);
  await updatePasswordHash(user.id, passwordHash);
  consumePasswordResetVerification(user.email);
  await revokeAllRefreshTokensForUser(user.id);
  await logActivity(user.id, "Password Reset Successful", "Password was reset using OTP flow");

  return {
    message: "Password reset successful",
  };
}

async function refreshAccessToken(payload) {
  const refreshToken = String(payload?.refresh_token || "").trim();
  if (!refreshToken) {
    throw buildError(401, "Refresh token is required");
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      throw buildError(401, "Refresh token expired. Please login again.");
    }
    throw buildError(401, "Invalid refresh token");
  }

  if (String(decoded?.tokenType || "").toLowerCase() !== "refresh") {
    throw buildError(401, "Invalid refresh token");
  }

  const tokenId = String(decoded?.tokenId || "").trim();
  if (!tokenId) {
    throw buildError(401, "Invalid refresh token");
  }

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const storedToken = await findRefreshTokenByTokenId(tokenId, client);
    if (!storedToken || storedToken.revoked_at) {
      throw buildError(401, "Refresh token has been revoked. Please login again.");
    }

    if (new Date(storedToken.expires_at).getTime() <= Date.now()) {
      throw buildError(401, "Refresh token expired. Please login again.");
    }

    const incomingHash = hashRefreshToken(refreshToken);
    if (String(storedToken.token_hash || "") !== incomingHash) {
      await revokeRefreshTokenByTokenId(tokenId, {}, client);
      throw buildError(401, "Refresh token mismatch. Please login again.");
    }

    const user = await findBasicById(decoded.userId);
    if (!user) {
      await revokeRefreshTokenByTokenId(tokenId, {}, client);
      throw buildError(404, "User not found");
    }

    const issued = await issueSessionTokens(user, {
      rotateFromTokenId: tokenId,
      db: client,
    });

    await deleteExpiredRefreshTokens(client);
    await client.query("COMMIT");
    transactionStarted = false;

    return {
      message: "Access token refreshed",
      token: issued.accessToken,
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      refresh_expires_at: issued.refreshTokenExpiresAt.toISOString(),
      user,
    };
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function logout(payload = {}) {
  const refreshToken = String(payload.refresh_token || "").trim();
  const userId = Number(payload.userId);

  if (refreshToken) {
    await revokeRefreshTokenByRawToken(refreshToken).catch(() => {});
  } else if (Number.isInteger(userId) && userId > 0) {
    await revokeAllRefreshTokensForUser(userId).catch(() => {});
  }

  if (Number.isInteger(userId) && userId > 0) {
    await logActivity(userId, "Logout", "User logged out from dashboard");
  }

  return { success: true, message: "Logged out successfully" };
}

async function initiateAccountDelete(userId, payload) {
  const user = await findAuthById(userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  if (String(user.role || "").toLowerCase() !== "admin") {
    throw buildError(403, "Only administrators can initiate self-deletion via this secure flow.");
  }

  const validPassword = await bcrypt.compare(payload.password, user.password_hash);
  if (!validPassword) {
    throw buildError(401, "Invalid password. Account deletion aborted.");
  }

  const otpCode = generateOtp(6);
  setAccountDeleteOtp({
    email: user.email,
    userId: user.id,
    otpCode,
    ttlMs: 5 * 60 * 1000,
  });

  sendAccountDeleteOtpEmail(user.email, otpCode, 5).catch((err) => {
    console.error("Background Account Delete OTP Email Error:", err.message);
  });

  await logActivity(user.id, "Account Deletion Initiated", "OTP sent for final confirmation");

  return {
    message: "OTP sent to your registered email for final confirmation.",
    email: user.email,
    ...(String(process.env.NODE_ENV || "").toLowerCase() !== "production" ? { otp_code: otpCode } : {}),
  };
}

async function verifyAccountDelete(userId, payload) {
  const user = await findAuthById(userId);
  if (!user) {
    throw buildError(404, "User not found");
  }

  const verified = verifyAccountDeleteOtp({
    email: user.email,
    userId: user.id,
    otpCode: payload.otp_code,
  });

  if (!verified.ok) {
    throw buildError(401, "Invalid or expired OTP");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await revokeAllRefreshTokensForUser(user.id, client);
    const deleted = await deleteUserById(user.id, client);
    await client.query("COMMIT");
    await logActivity(user.id, "Account Deleted", "Admin account permanently removed via self-delete flow");

    return {
      message: "Account deleted successfully. You have been logged out.",
      deleted_user: deleted,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    consumeAccountDeleteOtp(user.email);
  }
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
  refreshAccessToken,
  logout,
  initiateAccountDelete,
  verifyAccountDelete,
  getRefreshCookieConfig,
  readRefreshTokenFromRequest,
};
