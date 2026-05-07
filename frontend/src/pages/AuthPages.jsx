import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Clock3,
  KeyRound,
  Mail,
  LockKeyhole,
  UserPlus,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button, Card, Input, Badge, SectionHeader, Select, Textarea, OtpInputs } from "../components/ui";
import { getRoleTheme, roleToPath } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";
import { SmartSelect } from "../components/SmartSelect";

function AuthSurface({ title, subtitle, accent, children, hero }) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="absolute inset-0 soft-grid opacity-60" />
      <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-8"
        >
          <div className="space-y-5">
            <Badge className="border-0 bg-white/8 text-slate-200">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Smart Classroom Timetable Scheduler
            </Badge>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
                {subtitle}
              </p>
            </div>
          </div>

          {hero}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <ShieldCheck className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-sm font-semibold text-white">Secure access</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                OTP-backed authentication with refresh-token support.
              </p>
            </Card>
            <Card className="p-4">
              <Clock3 className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-sm font-semibold text-white">Fast workflows</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Login, verify, and land in the right dashboard in seconds.
              </p>
            </Card>
            <Card className="p-4">
              <KeyRound className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-sm font-semibold text-white">Role-aware UI</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Admin, faculty, and student views use the same design language.
              </p>
            </Card>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="relative"
        >
          <Card className="relative overflow-hidden p-6 md:p-8">
            <div
              className="absolute right-0 top-0 h-48 w-48 rounded-full blur-3xl"
              style={{ background: accent }}
            />
            <div className="relative">{children}</div>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}



export function LoginPage() {
  const navigate = useNavigate();
  const { login, isBusy, error } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const theme = getRoleTheme("student");

  async function handleSubmit(event) {
    event.preventDefault();
    const response = await login(identifier, password);
    if (response?.role) {
      navigate("/otp");
    }
  }

  return (
    <AuthSurface
      title="Welcome back."
      subtitle="Sign in to the redesigned timetable scheduler and jump straight into your role-specific workspace."
      accent={theme.heroGradient}
      hero={
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Hackathon-ready</p>
            <h3 className="mt-3 font-display text-2xl font-semibold text-white">Modern, focused, fast</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A clean interface tailored to admin, faculty, and student workflows.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Roles</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">Admin</Badge>
              <Badge tone="success">Faculty</Badge>
              <Badge tone="warning">Student</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              One backend, three optimized experiences.
            </p>
          </Card>
        </div>
      }
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Sign in"
          title="Access your workspace"
          description="Use your faculty ID, email, or registered identifier with your password. We'll take care of OTP verification next."
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Identifier"
            placeholder="Email or faculty ID"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Your account password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isBusy}>
            {isBusy ? "Starting secure login..." : "Continue"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link className="text-slate-300 transition hover:text-white" to="/forgot-password">
            Forgot password?
          </Link>
          <Link className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white" to="/signup">
            <UserPlus className="h-4 w-4" />
            Create account
          </Link>
        </div>
      </div>
    </AuthSurface>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { signup, isBusy, error } = useAuth();
  const theme = getRoleTheme("faculty");
  const [form, setForm] = useState({
    faculty_id: "",
    full_name: "",
    email: "",
    mobile_number: "",
    password: "",
    confirm_password: "",
    role: "USER",
    designation: "",
    department: "",
    gender: "",
    dob: "",
    qualification: "",
    experience_years: "",
    address: "",
    joining_date: "",
    role_type: "FACULTY_ONLY",
    employee_type: "",
    office_location: "",
    department_names: "",
    subject_names: "",
    mentor_section_ids: "",
  });
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await authApi.checkAdmin();
        if (res?.admin_exists) {
          setAdminExists(true);
        }
      } catch (err) {
        // Ignore
      }
    }
    check();
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await signup(form);
    navigate("/login", { replace: true });
  }

  const isStudent = form.role === "USER";
  const isFaculty = form.role === "FACULTY";
  const isAdmin = form.role === "ADMIN";

  return (
    <AuthSurface
      title="Create your account"
      subtitle="Register student, faculty, or admin access from one role-aware onboarding screen."
      accent={theme.heroGradient}
      hero={
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Signup restored</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Students see a shorter form. Faculty can add academic mappings. Admin can be created once until deleted.
          </p>
        </Card>
      }
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="New account"
          title="Register a user"
          description="The form adjusts to the selected role and sends only the fields the backend needs."
        />

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Student / Faculty ID" value={form.faculty_id} onChange={(e) => updateField("faculty_id", e.target.value)} required />
            <Input label="Full name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
            <Input label="Mobile number" value={form.mobile_number} onChange={(e) => updateField("mobile_number", e.target.value)} required />
            <Input label="Password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required />
            <Input label="Confirm password" type="password" value={form.confirm_password} onChange={(e) => updateField("confirm_password", e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Role" value={form.role} onChange={(e) => updateField("role", e.target.value)}>
              <option value="USER">Student</option>
              <option value="FACULTY">Faculty</option>
              {!adminExists && <option value="ADMIN">Admin</option>}
            </Select>
            {isFaculty ? (
              <Select label="Role type" value={form.role_type} onChange={(e) => updateField("role_type", e.target.value)}>
                <option value="FACULTY_ONLY">Faculty only</option>
                <option value="FACULTY_MENTOR">Faculty + Mentor</option>
              </Select>
            ) : (
              <SmartSelect
                label="Department"
                resource="departments"
                value={form.department}
                onChange={(val) => updateField("department", val)}
              />
            )}
          </div>

          {isStudent ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartSelect
                label="Branch"
                resource="branches"
                value={form.branch_id}
                onChange={(val) => {
                  updateField("branch_id", val);
                  updateField("semester_id", "");
                  updateField("office_location", "");
                }}
              />
              <SmartSelect
                label="Semester"
                resource="semesters"
                value={form.semester_id}
                filter={form.branch_id ? { branch_id: form.branch_id } : {}}
                disabled={!form.branch_id}
                onChange={(val) => {
                  updateField("semester_id", val);
                  updateField("office_location", "");
                }}
              />
              <SmartSelect
                label="Section"
                resource="sections"
                value={form.office_location}
                filter={form.semester_id ? { semester_id: form.semester_id } : {}}
                disabled={!form.semester_id}
                onChange={(val) => updateField("office_location", val)}
              />
              <Select label="Year" value={form.employee_type} onChange={(e) => updateField("employee_type", e.target.value)}>
                <option value="">Select year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </Select>
            </div>
          ) : null}

          {isFaculty ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Designation" value={form.designation} onChange={(e) => updateField("designation", e.target.value)} required />
              <Input label="Qualification" value={form.qualification} onChange={(e) => updateField("qualification", e.target.value)} required />
              <Input label="Experience years" type="number" min="0" step="0.5" value={form.experience_years} onChange={(e) => updateField("experience_years", e.target.value)} required />
              <Select label="Gender" value={form.gender} onChange={(e) => updateField("gender", e.target.value)} required>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Select>
              <Input label="Date of birth" type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} required />
              <Input label="Joining date" type="date" value={form.joining_date} onChange={(e) => updateField("joining_date", e.target.value)} required />
              <Textarea label="Address" rows={3} value={form.address} onChange={(e) => updateField("address", e.target.value)} required />
              <Input label="Office location" value={form.office_location} onChange={(e) => updateField("office_location", e.target.value)} />
              <Select label="Employee type" value={form.employee_type} onChange={(e) => updateField("employee_type", e.target.value)}>
                <option value="">Select type</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Guest">Guest</option>
              </Select>
              <SmartSelect
                label="Department"
                resource="departments"
                value={form.department}
                onChange={(val) => updateField("department", val)}
              />
              <Input label="Subject names" value={form.subject_names} onChange={(e) => updateField("subject_names", e.target.value)} hint="Comma-separated" />
              <SmartSelect
                label="Mentor Section"
                resource="sections"
                value={form.mentor_section_ids}
                onChange={(val) => updateField("mentor_section_ids", val)}
                hint="Assigned mentor section"
              />
            </div>
          ) : isAdmin ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Designation" value={form.designation} onChange={(e) => updateField("designation", e.target.value)} placeholder="Administrator" />
              <SmartSelect
                label="Department"
                resource="departments"
                value={form.department}
                onChange={(val) => updateField("department", val)}
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isBusy}>
            {isBusy ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white" to="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <span className="text-slate-500">Signup endpoint connected</span>
        </div>
      </div>
    </AuthSurface>
  );
}

export function OtpPage() {
  const navigate = useNavigate();
  const { pendingLogin, verifyLoginOtp, resendLoginOtp, isBusy, error } = useAuth();
  const [otp, setOtp] = useState("");
  const theme = getRoleTheme(pendingLogin?.role || "student");

  useEffect(() => {
    if (!pendingLogin?.loginToken) {
      navigate("/login", { replace: true });
    }
  }, [pendingLogin, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    const response = await verifyLoginOtp(otp);
    navigate(roleToPath(response?.user?.role || pendingLogin?.role || "student"), { replace: true });
  }

  async function handleResend() {
    await resendLoginOtp();
  }

  return (
    <AuthSurface
      title="Verify your OTP"
      subtitle={`We sent a 6-digit code to the registered account for ${pendingLogin?.identifier || "your login"}.`}
      accent={theme.heroGradient}
      hero={
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</p>
          <p className="mt-2 text-sm text-slate-300">
            OTP verification protects every dashboard session and keeps refresh-token flows secure.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="neutral">Access token</Badge>
            <Badge tone="neutral">Refresh token</Badge>
            <Badge tone="neutral">Role routing</Badge>
          </div>
        </Card>
      }
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Two-factor"
          title="Enter the OTP"
          description="Type the 6-digit code from your email to finish the login flow."
        />

        <form className="space-y-6" onSubmit={handleSubmit}>
          <OtpInputs value={otp} onChange={setOtp} autoFocus />

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="flex-1" disabled={isBusy || otp.length < 6}>
              {isBusy ? "Verifying..." : "Verify OTP"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleResend} disabled={isBusy}>
              Resend code
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white" to="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <span className="text-slate-500">Secure login is active</span>
        </div>
      </div>
    </AuthSurface>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { requestPasswordReset, verifyPasswordResetOtp, isBusy, error } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("request");
  const theme = getRoleTheme("student");

  async function handleRequest(event) {
    event.preventDefault();
    const response = await requestPasswordReset(identifier);
    setEmail(response.email || identifier);
    setStep("verify");
  }

  async function handleVerify(event) {
    event.preventDefault();
    await verifyPasswordResetOtp(email, otp);
    navigate("/reset-password", { replace: true });
  }

  return (
    <AuthSurface
      title="Recover your account"
      subtitle="We’ll send a password reset OTP to the email on file, then let you set a new password."
      accent={theme.heroGradient}
      hero={
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reset flow</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>1. Request OTP using email or faculty ID</p>
            <p>2. Verify the OTP</p>
            <p>3. Set a new password</p>
          </div>
        </Card>
      }
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Password recovery"
          title={step === "request" ? "Request a reset OTP" : "Verify the reset code"}
          description={
            step === "request"
              ? "Enter your registered email or faculty ID."
              : `We sent a code to ${email || "your email address"}.`
          }
        />

        {step === "request" ? (
          <form className="space-y-4" onSubmit={handleRequest}>
            <Input
              label="Email or faculty ID"
              placeholder="Enter your account identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isBusy}>
              {isBusy ? "Sending OTP..." : "Send reset code"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleVerify}>
            <OtpInputs value={otp} onChange={setOtp} autoFocus />
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isBusy || otp.length < 6}>
              {isBusy ? "Verifying..." : "Verify code"}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-between text-sm">
          <Link className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white" to="/login">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <span className="text-slate-500">OTP-based recovery</span>
        </div>
      </div>
    </AuthSurface>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetContext, completePasswordReset, isBusy, error } = useAuth();
  const [email, setEmail] = useState(resetContext?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const theme = getRoleTheme("student");

  useEffect(() => {
    if (resetContext?.email) {
      setEmail(resetContext.email);
    }
  }, [resetContext]);

  async function handleSubmit(event) {
    event.preventDefault();
    await completePasswordReset(email, newPassword, confirmPassword);
    navigate("/login", { replace: true });
  }

  return (
    <AuthSurface
      title="Create a new password"
      subtitle="Choose a strong password to lock down your account after OTP verification."
      accent={theme.heroGradient}
      hero={
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Security note</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Use at least 8 characters with a mix of letters, numbers, and symbols.
          </p>
        </Card>
      }
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Reset password"
          title="Set a new password"
          description="This will revoke the old session and update the backend record immediately."
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="New password"
            type="password"
            placeholder="Enter a secure password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat the password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isBusy}>
            {isBusy ? "Updating password..." : "Reset password"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white" to="/forgot-password">
            <ArrowLeft className="h-4 w-4" />
            Back to OTP
          </Link>
          <span className="text-slate-500">Refresh tokens are revoked on reset</span>
        </div>
      </div>
    </AuthSurface>
  );
}
