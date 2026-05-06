const stores = {
  login: new Map(),
  passwordReset: new Map(),
};

function nowMs() {
  return Date.now();
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanupExpiredEntries() {
  const timestamp = nowMs();
  Object.values(stores).forEach((store) => {
    for (const [key, value] of store.entries()) {
      if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= timestamp) {
        store.delete(key);
      }
    }
  });
}

const cleanupTimer = setInterval(cleanupExpiredEntries, 30 * 1000);
if (typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

function setLoginOtpChallenge({ challengeId, userId, email, otpCode, ttlMs }) {
  const key = String(challengeId || "").trim();
  if (!key) return;
  stores.login.set(key, {
    userId: Number(userId),
    email: String(email || "").trim().toLowerCase(),
    otpCode: String(otpCode || "").trim(),
    expiresAt: nowMs() + Math.max(1, Number(ttlMs) || 0),
  });
}

function resetLoginOtpChallenge({ challengeId, otpCode, ttlMs }) {
  const key = String(challengeId || "").trim();
  if (!key) return false;
  const entry = stores.login.get(key);
  if (!entry) return false;
  entry.otpCode = String(otpCode || "").trim();
  entry.expiresAt = nowMs() + Math.max(1, Number(ttlMs) || 0);
  stores.login.set(key, entry);
  return true;
}

function getLoginOtpChallenge(challengeId) {
  const key = String(challengeId || "").trim();
  if (!key) return null;
  const entry = stores.login.get(key);
  if (!entry) return null;
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= nowMs()) {
    stores.login.delete(key);
    return null;
  }
  return { ...entry };
}

function consumeLoginOtpChallenge({ challengeId, userId, otpCode }) {
  const key = String(challengeId || "").trim();
  if (!key) return { ok: false, reason: "missing_challenge" };

  const entry = getLoginOtpChallenge(key);
  if (!entry) return { ok: false, reason: "expired" };

  if (Number(entry.userId) !== Number(userId)) {
    return { ok: false, reason: "invalid_challenge" };
  }

  if (String(entry.otpCode) !== String(otpCode || "").trim()) {
    return { ok: false, reason: "invalid_otp" };
  }

  stores.login.delete(key);
  return { ok: true, entry };
}

function invalidateLoginOtpChallenge(challengeId) {
  const key = String(challengeId || "").trim();
  if (!key) return;
  stores.login.delete(key);
}

function setPasswordResetOtp({ email, userId, otpCode, ttlMs }) {
  const key = normalizeKey(email);
  if (!key) return;

  stores.passwordReset.set(key, {
    userId: Number(userId),
    email: key,
    otpCode: String(otpCode || "").trim(),
    attempts: 0,
    verifiedUntil: 0,
    expiresAt: nowMs() + Math.max(1, Number(ttlMs) || 0),
  });
}

function verifyPasswordResetOtp({ email, otpCode, maxAttempts, verifiedTtlMs }) {
  const key = normalizeKey(email);
  if (!key) return { ok: false, reason: "missing_email" };

  const entry = stores.passwordReset.get(key);
  if (!entry) return { ok: false, reason: "expired" };

  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= nowMs()) {
    stores.passwordReset.delete(key);
    return { ok: false, reason: "expired" };
  }

  if (entry.verifiedUntil > nowMs()) {
    return { ok: true, alreadyVerified: true };
  }

  if (String(entry.otpCode) !== String(otpCode || "").trim()) {
    entry.attempts += 1;
    if (entry.attempts >= Math.max(1, Number(maxAttempts) || 1)) {
      stores.passwordReset.delete(key);
      return { ok: false, reason: "attempts_exceeded" };
    }
    stores.passwordReset.set(key, entry);
    return { ok: false, reason: "invalid_otp", attempts: entry.attempts };
  }

  const verificationTtl = Math.max(1, Number(verifiedTtlMs) || 0);
  entry.verifiedUntil = nowMs() + verificationTtl;
  entry.expiresAt = entry.verifiedUntil;
  entry.otpCode = "";
  entry.attempts = 0;
  stores.passwordReset.set(key, entry);

  return { ok: true, alreadyVerified: false };
}

function hasValidPasswordResetVerification(email) {
  const key = normalizeKey(email);
  if (!key) return false;
  const entry = stores.passwordReset.get(key);
  if (!entry) return false;
  if (!Number.isFinite(entry.verifiedUntil) || entry.verifiedUntil <= nowMs()) {
    stores.passwordReset.delete(key);
    return false;
  }
  return true;
}

function consumePasswordResetVerification(email) {
  const key = normalizeKey(email);
  if (!key) return;
  stores.passwordReset.delete(key);
}

function invalidatePasswordResetOtp(email) {
  const key = normalizeKey(email);
  if (!key) return;
  stores.passwordReset.delete(key);
}

module.exports = {
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
};
