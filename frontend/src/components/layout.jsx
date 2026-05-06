import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  Database,
  CalendarRange,
  ChartColumn,
  NotebookText,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Share2,
  Settings,
  UserRound,
  X,
  LogOut,
} from "lucide-react";
import { adminNav, facultyNav, getRoleTheme, roleToPath, studentNav } from "../lib/theme";
import { initials, toTitleCase } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Badge, Button } from "./ui";

const ICONS = {
  "layout-dashboard": LayoutDashboard,
  database: Database,
  "calendar-range": CalendarRange,
  "chart-column": ChartColumn,
  "notebook-text": NotebookText,
  "user-round": UserRound,
  "share-2": Share2,
  settings: Settings,
};

function navForRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") return adminNav;
  if (normalized === "faculty") return facultyNav;
  return studentNav;
}

function NavItems({ items, onNavigate, collapsed = false }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon] || ChevronRight;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-transparent text-white shadow-soft"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
              ].join(" ")
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
            })}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5">
              <Icon className="h-4.5 w-4.5" />
            </span>
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}

function TopBar({ theme, onOpenSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const roleLabel = toTitleCase(user?.role || theme.label);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-soft md:flex"
            style={{ background: theme.heroGradient }}
          >
            <span className="font-display text-sm font-semibold tracking-wide">SC</span>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Smart Classroom
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate font-display text-lg font-semibold text-white md:text-xl">
                {roleLabel} Workspace
              </h2>
              <Badge className={theme.chip}>{roleLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="hidden min-w-[260px] max-w-md flex-1 md:block">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
            <Search className="h-4.5 w-4.5 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Search timetables, records, reports..."
            />
          </label>
        </div>

        <button className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 md:inline-flex">
          <Bell className="h-4.5 w-4.5" />
        </button>

        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 transition hover:bg-white/10">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: theme.heroGradient }}
            >
              <span className="text-xs font-semibold">{initials(user?.full_name || user?.faculty_id || roleLabel)}</span>
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-none text-white">
                {user?.full_name || "Signed in user"}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {roleLabel}
              </p>
            </div>
          </summary>
          <div className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-glow backdrop-blur-xl">
            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              <UserRound className="h-4 w-4" />
              Profile
            </NavLink>
            <NavLink
              to={roleToPath(user?.role || "student")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </details>
      </div>

      {location.pathname.startsWith("/admin") || location.pathname.startsWith("/faculty") || location.pathname.startsWith("/student") ? (
        <div className="border-t border-white/5 px-4 py-3 md:px-6 lg:hidden">
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {navForRole(user?.role).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-transparent text-white"
                        : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
                    ].join(" ")
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? "var(--accent-soft)" : "rgba(255,255,255,0.04)",
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function AppShell({ children }) {
  const { user } = useAuth();
  const role = String(user?.role || "student").trim().toLowerCase();
  const theme = useMemo(() => getRoleTheme(role), [role]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const items = navForRole(role);

  return (
    <div
      className="min-h-screen"
      style={{
        "--accent": theme.accent,
        "--accent-soft": theme.accentSoft,
      }}
    >
      {role === "admin" ? (
        <>
          <aside
            className={[
              "fixed inset-y-0 left-0 z-40 hidden border-r border-white/8 bg-slate-950/80 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
              collapsed ? "w-[96px]" : "w-72",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-soft"
                  style={{ background: theme.heroGradient }}
                >
                  <span className="font-display text-sm font-semibold tracking-wide">SC</span>
                </div>
                {!collapsed ? (
                  <div>
                    <p className="font-display text-lg font-semibold text-white">EduSched Pro</p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Admin portal</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
              >
                {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <NavItems items={items} collapsed={collapsed} />
            </div>
          </aside>

          {mobileOpen ? (
            <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0"
                aria-label="Close navigation"
              />
              <aside className="absolute left-0 top-0 flex h-full w-[84vw] max-w-sm flex-col border-r border-white/10 bg-slate-950 p-4 shadow-glow">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-white">EduSched Pro</p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Admin portal</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
                <NavItems items={items} onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          ) : null}
        </>
      ) : null}

      <div className={role === "admin" ? (collapsed ? "lg:pl-[96px]" : "lg:pl-72") : ""}>
        <TopBar theme={theme} onOpenSidebar={() => setMobileOpen(true)} />
        {role !== "admin" ? <RoleNavBar /> : null}
        <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function RoleRibbon({ className = "" }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  return (
    <div
      className={className}
      style={{
        background: theme.heroGradient,
      }}
    />
  );
}

export function RoleNavBar() {
  const { user } = useAuth();
  const items = navForRole(user?.role);
  const theme = getRoleTheme(user?.role);
  const location = useLocation();

  return (
    <div className="hidden border-b border-white/5 bg-white/[0.02] px-4 py-3 md:block md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  isActive ? "border-transparent text-white" : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? theme.accentSoft : "rgba(255,255,255,0.04)",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        {location.pathname.startsWith("/faculty") || location.pathname.startsWith("/student") ? (
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
            {toTitleCase(user?.role || theme.label)} mode
          </p>
        ) : null}
      </div>
    </div>
  );
}
