export const roleThemes = {
  admin: {
    key: "admin",
    label: "Admin",
    accent: "#0066FF",
    accentSoft: "rgba(0, 102, 255, 0.16)",
    surfaceTint: "rgba(0, 102, 255, 0.12)",
    glow: "rgba(0, 102, 255, 0.25)",
    heroGradient: "linear-gradient(135deg, rgba(0,102,255,0.95), rgba(59,130,246,0.58))",
    chip: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  },
  faculty: {
    key: "faculty",
    label: "Faculty",
    accent: "#10B981",
    accentSoft: "rgba(16, 185, 129, 0.16)",
    surfaceTint: "rgba(16, 185, 129, 0.12)",
    glow: "rgba(16, 185, 129, 0.24)",
    heroGradient: "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(6,182,212,0.58))",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  },
  student: {
    key: "student",
    label: "Student",
    accent: "#FF8C42",
    accentSoft: "rgba(255, 140, 66, 0.16)",
    surfaceTint: "rgba(255, 140, 66, 0.12)",
    glow: "rgba(255, 140, 66, 0.25)",
    heroGradient: "linear-gradient(135deg, rgba(255,140,66,0.96), rgba(168,85,247,0.62))",
    chip: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  },
  user: {
    key: "student",
    label: "Student",
    accent: "#FF8C42",
    accentSoft: "rgba(255, 140, 66, 0.16)",
    surfaceTint: "rgba(255, 140, 66, 0.12)",
    glow: "rgba(255, 140, 66, 0.25)",
    heroGradient: "linear-gradient(135deg, rgba(255,140,66,0.96), rgba(168,85,247,0.62))",
    chip: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  },
};

export const subjectPalette = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F06292",
  "#7DD3FC",
];

export function getRoleTheme(role) {
  const normalized = String(role || "student").trim().toLowerCase();
  return roleThemes[normalized] || roleThemes.student;
}

export function roleToPath(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") return "/admin";
  if (normalized === "faculty") return "/faculty";
  return "/student";
}

export function subjectColorFor(value) {
  const seed = String(value || "subject").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  return subjectPalette[hash % subjectPalette.length];
}

export const adminNav = [
  { label: "Summary", to: "/admin", icon: "layout-dashboard" },
  { label: "Master Data", to: "/admin/master-data", icon: "database" },
  { label: "Timetable", to: "/admin/timetable", icon: "calendar-range" },
  { label: "Reports", to: "/admin/reports", icon: "chart-column" },
  { label: "Activity Logs", to: "/admin/activity-logs", icon: "notebook-text" },
  { label: "Profile", to: "/profile", icon: "user-round" },
];

export const facultyNav = [
  { label: "Dashboard", to: "/faculty", icon: "layout-dashboard" },
  { label: "My Timetable", to: "/faculty/timetable", icon: "calendar-range" },
  { label: "Student Timetable", to: "/faculty/student-timetable", icon: "share-2" },
  { label: "Profile", to: "/profile", icon: "user-round" },
];

export const studentNav = [
  { label: "Dashboard", to: "/student", icon: "layout-dashboard" },
  { label: "Full Timetable", to: "/student/timetable", icon: "calendar-range" },
  { label: "Profile", to: "/profile", icon: "user-round" },
];
