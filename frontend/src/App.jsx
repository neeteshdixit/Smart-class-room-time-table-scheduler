import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout";
import { useAuth } from "./context/AuthContext";
import { roleToPath } from "./lib/theme";
import {
  LoginPage,
  SignupPage,
  OtpPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from "./pages/AuthPages";

function lazyNamed(factory, exportName) {
  return lazy(() => factory().then((module) => ({ default: module[exportName] })));
}

const AdminDashboardPage = lazyNamed(() => import("./pages/AdminPages"), "AdminDashboardPage");
const MasterDataPage = lazyNamed(() => import("./pages/AdminPages"), "MasterDataPage");
const TimetablePage = lazyNamed(() => import("./pages/AdminPages"), "TimetablePage");
const ReportsPage = lazyNamed(() => import("./pages/AdminPages"), "ReportsPage");
const ActivityLogsPage = lazyNamed(() => import("./pages/AdminPages"), "ActivityLogsPage");
const FacultyDashboardPage = lazyNamed(() => import("./pages/FacultyPages"), "FacultyDashboardPage");
const FacultyTimetablePage = lazyNamed(() => import("./pages/FacultyPages"), "FacultyTimetablePage");
const FacultyStudentTimetablePage = lazyNamed(() => import("./pages/FacultyPages"), "FacultyStudentTimetablePage");
const StudentDashboardPage = lazyNamed(() => import("./pages/StudentPages"), "StudentDashboardPage");
const StudentTimetablePage = lazyNamed(() => import("./pages/StudentPages"), "StudentTimetablePage");
const ProfilePage = lazyNamed(() => import("./pages/ProfilePage"), "ProfilePage");
const NotFoundPage = lazyNamed(() => import("./pages/NotFoundPage"), "NotFoundPage");

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-3xl px-6 py-5 text-center">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[color:var(--accent)]"
          style={{ "--accent": "#0066FF" }}
        />
        <p className="mt-4 text-sm text-slate-300">Loading secure workspace...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, role, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && roles.length && !roles.includes(String(role || "").toLowerCase())) {
    return <Navigate to={roleToPath(role)} replace />;
  }
  return children;
}

function PublicRoute({ requirePendingLogin = false, children }) {
  const { isAuthenticated, role, isBootstrapping, pendingLogin } = useAuth();

  if (isBootstrapping) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to={roleToPath(role)} replace />;
  if (requirePendingLogin && !pendingLogin?.loginToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function ShellPage({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

function HomeRedirect() {
  const { isAuthenticated, role, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={roleToPath(role)} replace />;
}

function DashboardRedirect() {
  const { role } = useAuth();
  return <Navigate to={roleToPath(role)} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route
          path="/otp"
          element={
            <PublicRoute requirePendingLogin>
              <OtpPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

        <Route
          path="/admin"
          element={
            <ShellPage roles={["admin"]}>
              <AdminDashboardPage />
            </ShellPage>
          }
        />
        <Route
          path="/admin/master-data"
          element={
            <ShellPage roles={["admin"]}>
              <MasterDataPage />
            </ShellPage>
          }
        />
        <Route
          path="/admin/timetable"
          element={
            <ShellPage roles={["admin"]}>
              <TimetablePage />
            </ShellPage>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ShellPage roles={["admin"]}>
              <ReportsPage />
            </ShellPage>
          }
        />
        <Route
          path="/admin/activity-logs"
          element={
            <ShellPage roles={["admin"]}>
              <ActivityLogsPage />
            </ShellPage>
          }
        />

        <Route
          path="/faculty"
          element={
            <ShellPage roles={["faculty"]}>
              <FacultyDashboardPage />
            </ShellPage>
          }
        />
        <Route
          path="/faculty/timetable"
          element={
            <ShellPage roles={["faculty"]}>
              <FacultyTimetablePage />
            </ShellPage>
          }
        />
        <Route
          path="/faculty/student-timetable"
          element={
            <ShellPage roles={["faculty"]}>
              <FacultyStudentTimetablePage />
            </ShellPage>
          }
        />

        <Route
          path="/student"
          element={
            <ShellPage roles={["student", "user"]}>
              <StudentDashboardPage />
            </ShellPage>
          }
        />
        <Route
          path="/student/timetable"
          element={
            <ShellPage roles={["student", "user"]}>
              <StudentTimetablePage />
            </ShellPage>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppShell>
                <ProfilePage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
