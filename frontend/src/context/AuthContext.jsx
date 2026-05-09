import React, { createContext, useContext, useEffect, useState } from "react";
import {
  authApi,
  clearStoredAuth,
  profileApi,
  readPendingLogin,
  readResetContext,
  readStoredAccessToken,
  readStoredUser,
  writePendingLogin,
  writeResetContext,
  writeStoredAccessToken,
  writeStoredRole,
  writeStoredUser,
} from "../lib/api";

const AuthContext = createContext(null);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [role, setRole] = useState(() => normalizeRole(readStoredUser()?.role || localStorage.getItem("scts_role")));
  const [accessToken, setAccessToken] = useState(() => readStoredAccessToken());
  const [pendingLogin, setPendingLoginState] = useState(() => readPendingLogin());
  const [resetContext, setResetContextState] = useState(() => readResetContext());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);
      const storedToken = readStoredAccessToken();
      const storedUser = readStoredUser();
      const storedPendingLogin = readPendingLogin();
      const storedResetContext = readResetContext();

      if (!cancelled) {
        setAccessToken(storedToken);
        setUser(storedUser);
        setRole(normalizeRole(storedUser?.role || localStorage.getItem("scts_role")));
        setPendingLoginState(storedPendingLogin);
        setResetContextState(storedResetContext);
      }

      if (!storedToken) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const response = await profileApi.get();
        if (cancelled) return;
        const profile = response?.profile || null;
        setUser(profile);
        setRole(normalizeRole(profile?.role || storedUser?.role));
        writeStoredUser(profile);
        writeStoredRole(profile?.role || storedUser?.role);
      } catch (bootstrapError) {
        if (cancelled) return;
        clearStoredAuth();
        writePendingLogin(null);
        writeResetContext(null);
        setUser(null);
        setRole("");
        setAccessToken("");
        setPendingLoginState(null);
        setResetContextState(null);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateSessionFromUser(nextUser, nextToken) {
    const normalizedRole = normalizeRole(nextUser?.role);
    setUser(nextUser);
    setRole(normalizedRole);
    setAccessToken(nextToken || "");
    writeStoredUser(nextUser);
    writeStoredRole(nextUser?.role || normalizedRole);
    writeStoredAccessToken(nextToken || "");
  }

  async function login(identifier, password) {
    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.login({ identifier, password });
      const pending = {
        loginToken: response.login_token,
        role: normalizeRole(response.role),
        identifier,
        otpCode: response.otp_code,
      };
      setPendingLoginState(pending);
      writePendingLogin(pending);
      return response;
    } catch (loginError) {
      setError(loginError?.data?.message || loginError?.response?.data?.message || loginError.message || "Unable to start login");
      throw loginError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signup(payload) {
    setIsBusy(true);
    setError("");
    try {
      return await authApi.signup(payload);
    } catch (signupError) {
      const backendError = signupError?.response?.data;
      let errorMsg = backendError?.message || signupError.message || "Unable to create account";

      if (backendError?.errors && Array.isArray(backendError.errors)) {
        const details = backendError.errors.map((e) => `${e.path || e.param}: ${e.msg}`).join(", ");
        errorMsg = `Validation failed: ${details}`;
      }

      setError(errorMsg);
      throw signupError;
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyLoginOtp(otpCode) {
    const currentPending = readPendingLogin();
    if (!currentPending?.loginToken) {
      throw new Error("Login session expired. Please login again.");
    }

    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.verifyLoginOtp({
        login_token: currentPending.loginToken,
        otp_code: otpCode,
      });
      updateSessionFromUser(response.user, response.access_token || response.token);
      writePendingLogin(null);
      setPendingLoginState(null);
      return response;
    } catch (verifyError) {
      const backendMessage =
        verifyError?.data?.message ||
        verifyError?.response?.data?.message ||
        verifyError?.message ||
        "Unable to verify OTP";
      setError(backendMessage);
      throw verifyError;
    } finally {
      setIsBusy(false);
    }
  }

  async function resendLoginOtp() {
    const currentPending = readPendingLogin();
    if (!currentPending?.loginToken) {
      throw new Error("Login session expired. Please login again.");
    }

    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.resendOtp({ login_token: currentPending.loginToken });
      if (response?.otp_code) {
        const nextPending = { ...currentPending, otpCode: response.otp_code };
        setPendingLoginState(nextPending);
        writePendingLogin(nextPending);
      }
      return response;
    } catch (resendError) {
      setError(resendError?.data?.message || resendError?.response?.data?.message || resendError.message || "Unable to resend OTP");
      throw resendError;
    } finally {
      setIsBusy(false);
    }
  }

  async function requestPasswordReset(identifier) {
    setIsBusy(true);
    setError("");
    try {
      const payload = identifier.includes("@")
        ? { email: identifier.trim() }
        : { faculty_id: identifier.trim() };
      const response = await authApi.forgotPassword(payload);
      const nextReset = {
        email: response.email || identifier.trim(),
        canReset: false,
      };
      setResetContextState(nextReset);
      writeResetContext(nextReset);
      return response;
    } catch (resetError) {
      setError(resetError?.data?.message || resetError?.response?.data?.message || resetError.message || "Unable to request password reset");
      throw resetError;
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyPasswordResetOtp(email, otp) {
    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.verifyOtp({ email, otp });
      const nextReset = {
        email,
        canReset: Boolean(response.can_reset_password),
      };
      setResetContextState(nextReset);
      writeResetContext(nextReset);
      return response;
    } catch (verifyError) {
      setError(verifyError?.data?.message || verifyError?.response?.data?.message || verifyError.message || "Unable to verify reset OTP");
      throw verifyError;
    } finally {
      setIsBusy(false);
    }
  }

  async function completePasswordReset(email, newPassword, confirmPassword) {
    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.resetPassword({
        email,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      writeResetContext(null);
      setResetContextState(null);
      return response;
    } catch (completeError) {
      setError(completeError?.data?.message || completeError?.response?.data?.message || completeError.message || "Unable to reset password");
      throw completeError;
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshProfile() {
    const response = await profileApi.get();
    const profile = response?.profile || null;
    setUser(profile);
    setRole(normalizeRole(profile?.role));
    writeStoredUser(profile);
    writeStoredRole(profile?.role);
    return profile;
  }

  async function updateProfile(nextProfile) {
    setIsBusy(true);
    setError("");
    try {
      const response = await profileApi.update(nextProfile);
      const profile = response?.profile || response?.data || null;
      if (profile) {
        setUser(profile);
        writeStoredUser(profile);
        writeStoredRole(profile?.role || role);
      }
      return response;
    } catch (profileError) {
      setError(profileError?.data?.message || profileError?.response?.data?.message || profileError.message || "Unable to update profile");
      throw profileError;
      setIsBusy(false);
    }
  }

  async function updateProfilePhoto(file) {
    setIsBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("profile_photo", file);
      const response = await profileApi.uploadPhoto(formData);
      if (response?.profile_photo_url) {
        const nextUser = { ...user, profile_photo_url: response.profile_photo_url };
        setUser(nextUser);
        writeStoredUser(nextUser);
      }
      return response;
    } catch (photoError) {
      setError(photoError?.data?.message || photoError.message || "Unable to update profile photo");
      throw photoError;
    } finally {
      setIsBusy(false);
    }
  }

  async function initiateAccountDelete(password) {
    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.initiateDeleteSelf({ password });
      return response;
    } catch (deleteError) {
      setError(deleteError?.data?.message || deleteError.message || "Unable to initiate account deletion");
      throw deleteError;
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmAccountDelete(otp_code) {
    setIsBusy(true);
    setError("");
    try {
      const response = await authApi.confirmDeleteSelf({ otp_code });
      await logout();
      return response;
    } catch (confirmError) {
      setError(confirmError?.data?.message || confirmError.message || "Unable to confirm account deletion");
      throw confirmError;
    } finally {
      setIsBusy(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (logoutError) {
      // Client-side sign-out should still continue even if the server is unavailable.
    } finally {
      clearStoredAuth();
      writePendingLogin(null);
      writeResetContext(null);
      setUser(null);
      setRole("");
      setAccessToken("");
      setPendingLoginState(null);
      setResetContextState(null);
    }
  }

  const value = {
    user,
    role,
    accessToken,
    pendingLogin,
    resetContext,
    isAuthenticated: Boolean(accessToken && user),
    isBootstrapping,
    isBusy,
    error,
    setError,
    setUser,
    setRole,
    login,
    signup,
    verifyLoginOtp,
    resendLoginOtp,
    requestPasswordReset,
    verifyPasswordResetOtp,
    completePasswordReset,
    refreshProfile,
    updateProfile,
    updateProfilePhoto,
    initiateAccountDelete,
    confirmAccountDelete,
    logout,
    setPendingLogin: (nextValue) => {
      setPendingLoginState(nextValue);
      writePendingLogin(nextValue);
    },
    setResetContext: (nextValue) => {
      setResetContextState(nextValue);
      writeResetContext(nextValue);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
