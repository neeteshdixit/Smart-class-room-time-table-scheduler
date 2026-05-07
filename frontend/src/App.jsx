import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "./components/layout";
import PageTransition from "./components/PageTransition";
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
    <div className="flex min-h-screen items-center justify-center px-4 bg-[#03050C]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center justify-center"
      >
        <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-[color:var(--accent)] blur-[60px] opacity-20" style={{ "--accent": "#00e5ff" }} />
        <div className="glass rounded-3xl px-8 py-8 text-center shadow-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="mx-auto h-12 w-12 rounded-full border-2 border-white/5 border-t-[color:var(--accent)]"
            style={{ "--accent": "#00e5ff" }}
          />
          <p className="mt-6 text-sm font-medium tracking-wide text-slate-300">Loading secure workspace...</p>
        </div>
      </motion.div>
    </div>
  );
}

function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, role, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <LoadingScreen />;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRole = String(role || "").toLowerCase();
  
  if (roles && roles.length && !roles.includes(normalizedRole)) {
    console.warn(`Access denied for role: ${normalizedRole}. Required: ${roles.join(", ")}`);
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
  return <PageTransition>{children}</PageTransition>;
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

function AuthenticatedRoutes() {
  const location = useLocation();
  const { role } = useAuth();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/dashboard" element={<DashboardRedirect />} />
          
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><PageTransition><AdminDashboardPage /></PageTransition></ProtectedRoute>} />
          <Route path="/admin/master-data" element={<ProtectedRoute roles={["admin"]}><PageTransition><MasterDataPage /></PageTransition></ProtectedRoute>} />
          <Route path="/admin/timetable" element={<ProtectedRoute roles={["admin"]}><PageTransition><TimetablePage /></PageTransition></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><PageTransition><ReportsPage /></PageTransition></ProtectedRoute>} />
          <Route path="/admin/activity-logs" element={<ProtectedRoute roles={["admin"]}><PageTransition><ActivityLogsPage /></PageTransition></ProtectedRoute>} />

          <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]}><PageTransition><FacultyDashboardPage /></PageTransition></ProtectedRoute>} />
          <Route path="/faculty/timetable" element={<ProtectedRoute roles={["faculty"]}><PageTransition><FacultyTimetablePage /></PageTransition></ProtectedRoute>} />
          <Route path="/faculty/student-timetable" element={<ProtectedRoute roles={["faculty"]}><PageTransition><FacultyStudentTimetablePage /></PageTransition></ProtectedRoute>} />

          <Route path="/student" element={<ProtectedRoute roles={["student", "user"]}><PageTransition><StudentDashboardPage /></PageTransition></ProtectedRoute>} />
          <Route path="/student/timetable" element={<ProtectedRoute roles={["student", "user"]}><PageTransition><StudentTimetablePage /></PageTransition></ProtectedRoute>} />

          <Route path="/profile" element={<ProtectedRoute><PageTransition><ProfilePage /></PageTransition></ProtectedRoute>} />
          
          <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
            <Route path="/otp" element={<PublicRoute requirePendingLogin><OtpPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<AuthenticatedRoutes />} />
      </Routes>
    </Suspense>
  );
}
