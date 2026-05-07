import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CircleSlash2,
  Database,
  Download,
  Layers3,
  LayoutGrid,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
  Building2,
  Clock3,
  Blocks,
  DoorOpen,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardApi, masterApi, statsApi } from "../lib/api";
import { formatDateTime, formatNumber, formatPercent } from "../lib/format";
import { summarizeTimetable } from "../lib/timetable";
import { adminNav } from "../lib/theme";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  SectionHeader,
  Select,
  StatCard,
  Textarea,
} from "../components/ui";
import { TimetableGrid, TimetableLegend, TimetableStatStrip } from "../components/timetable";
import { DeleteConfirmationModal } from "../components/ui";
import { WorkingDaySelector } from "../components/WorkingDaySelector";
import { SmartSelect } from "../components/SmartSelect";
import { FormSkeleton, GridSkeleton } from "../components/FormSkeletons";

const MASTER_RESOURCES = {
  departments: {
    title: "Departments",
    description: "Manage academic departments and their HOD assignments.",
    icon: Database,
    fields: [
      { name: "department_name", label: "Department name", type: "text", required: true },
      { name: "department_code", label: "Department code", type: "text", required: true },
      { name: "hod_name", label: "HOD name", type: "text" },
    ],
    columns: [
      { key: "department_name", label: "Department" },
      { key: "department_code", label: "Code" },
      { key: "hod_name", label: "HOD" },
    ],
  },
  "department-schedule-config": {
    title: "Department Working Hours",
    description: "Configure working hours, slot duration, and breaks for each department.",
    icon: Clock3,
    fields: [
      { name: "department_id", label: "Department", type: "smart-select", resource: "departments", required: true },
      { name: "start_time", label: "Start time", type: "time", required: true },
      { name: "end_time", label: "End time", type: "time", required: true },
      { name: "slot_duration_minutes", label: "Slot duration (minutes)", type: "number", required: true, defaultValue: 60 },
      { name: "break_duration_minutes", label: "Break duration (minutes)", type: "number", required: true, defaultValue: 15 },
      { name: "break_after_slot_number", label: "Break after slot number", type: "number", defaultValue: 2 },
      { name: "working_days", label: "Working Days Selection", type: "working-day-selector", required: true },
    ],
    columns: [
      { key: "department_id", label: "Dept ID" },
      { key: "start_time", label: "Start" },
      { key: "end_time", label: "End" },
      { key: "slot_duration_minutes", label: "Slot" },
    ],
  },
  branches: {
    title: "Branches",
    description: "Branch records tied to a department and a program type.",
    icon: Layers3,
    fields: [
      { name: "branch_name", label: "Branch name", type: "text", required: true },
      { name: "branch_code", label: "Branch code", type: "text", required: true },
      { name: "department_id", label: "Department", type: "smart-select", resource: "departments", required: true },
      { name: "program_type", label: "Program type", type: "select", required: true, options: ["UG", "PG"] },
    ],
    columns: [
      { key: "branch_name", label: "Branch" },
      { key: "branch_code", label: "Code" },
      { key: "department_id", label: "Dept ID" },
      { key: "program_type", label: "Program" },
    ],
  },
  semesters: {
    title: "Semesters",
    description: "Academic year and semester number combinations.",
    icon: CalendarRange,
    fields: [
      { name: "semester_number", label: "Semester number", type: "number", required: true },
      { name: "academic_year", label: "Academic year", type: "text", required: true, placeholder: "2025-26" },
      { name: "branch_id", label: "Branch", type: "smart-select", resource: "branches", required: true, dependsOn: "department_id" },
    ],
    columns: [
      { key: "semester_number", label: "Semester" },
      { key: "academic_year", label: "Year" },
      { key: "branch_name", label: "Branch" },
    ],
  },
  sections: {
    title: "Sections",
    description: "Section groups with student strength and branch mapping.",
    icon: LayoutGrid,
    fields: [
      { name: "section_name", label: "Section name", type: "text", required: true },
      { name: "branch_id", label: "Branch", type: "smart-select", resource: "branches", required: true },
      { name: "semester_id", label: "Semester", type: "smart-select", resource: "semesters", required: true, dependsOn: "branch_id" },
      { name: "student_strength", label: "Student strength", type: "number", defaultValue: 60 },
    ],
    columns: [
      { key: "section_name", label: "Section" },
      { key: "branch_id", label: "Branch ID" },
      { key: "semester_id", label: "Sem ID" },
      { key: "student_strength", label: "Strength" },
    ],
  },
  subjects: {
    title: "Subjects",
    description: "Subject catalogue with weekly hour breakdowns.",
    icon: Sparkles,
    fields: [
      { name: "subject_name", label: "Subject name", type: "text", required: true },
      { name: "subject_code", label: "Subject code", type: "text", required: true },
      { name: "department_id", label: "Department", type: "smart-select", resource: "departments", required: true },
      { name: "branch_id", label: "Branch", type: "smart-select", resource: "branches", required: true, dependsOn: "department_id" },
      { name: "semester_id", label: "Semester", type: "smart-select", resource: "semesters", required: true, dependsOn: "branch_id" },
      { name: "subject_type", label: "Subject type", type: "select", required: true, options: ["Theory", "Practical", "Theory + Practical"] },
      { name: "total_hours", label: "Total hours", type: "number", required: true, defaultValue: 0 },
      { name: "theory_hours", label: "Theory hours", type: "number", defaultValue: 0 },
      { name: "practical_hours", label: "Practical hours", type: "number", defaultValue: 0 },
      { name: "requires_lab", label: "Requires lab", type: "checkbox" },
    ],
    columns: [
      { key: "subject_name", label: "Subject" },
      { key: "subject_code", label: "Code" },
      { key: "subject_type", label: "Type" },
      { key: "semester_id", label: "Sem ID" },
    ],
  },
  faculty: {
    title: "Faculty",
    description: "Faculty master records used by the timetable engine.",
    icon: Settings2,
    fields: [
      { name: "faculty_id", label: "Faculty ID", type: "text", required: true },
      { name: "full_name", label: "Full name", type: "text", required: true },
      { name: "department_id", label: "Department", type: "smart-select", resource: "departments", required: true },
      { name: "designation", label: "Designation", type: "text", required: true },
      { name: "qualification", label: "Qualification", type: "text", required: true },
      { name: "experience_years", label: "Experience years", type: "number", required: true, step: "0.5" },
      { name: "max_workload_per_week", label: "Max workload", type: "number", required: true, defaultValue: 30 },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "mobile_number", label: "Mobile number", type: "text", required: true },
      { name: "joining_date", label: "Joining date", type: "date", required: true },
      { name: "preferred_time_slots", label: "Preferred time slots (JSON)", type: "textarea" },
      { name: "avg_leaves_per_month", label: "Avg leaves/month", type: "number", defaultValue: 0, step: "0.1" },
    ],
    columns: [
      { key: "faculty_id", label: "ID" },
      { key: "full_name", label: "Name" },
      { key: "designation", label: "Designation" },
      { key: "email", label: "Email" },
    ],
  },
  classrooms: {
    title: "Classrooms",
    description: "Classroom inventory, capacities, and room type mapping.",
    icon: DoorOpen,
    fields: [
      { name: "room_number", label: "Room number", type: "text", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true, defaultValue: 0 },
      { name: "block_id", label: "Block", type: "smart-select", resource: "blocks", required: true },
      { name: "floor_number", label: "Floor number", type: "number", required: true, defaultValue: 1 },
      { name: "room_type", label: "Room type", type: "select", required: true, options: ["Classroom", "Lab", "Seminar Hall", "Auditorium"] },
    ],
    columns: [
      { key: "room_number", label: "Room" },
      { key: "capacity", label: "Capacity" },
      { key: "block_id", label: "Block ID" },
      { key: "room_type", label: "Type" },
    ],
  },
  laboratories: {
    title: "Labs",
    description: "Laboratory resources and equipment preferences.",
    icon: Building2,
    fields: [
      { name: "lab_name", label: "Lab name", type: "text", required: true },
      { name: "department_id", label: "Department", type: "smart-select", resource: "departments", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true, defaultValue: 0 },
      { name: "equipment_type", label: "Equipment type", type: "text" },
      { name: "lab_duration_preference", label: "Lab duration preference", type: "number", defaultValue: 120 },
    ],
    columns: [
      { key: "lab_name", label: "Lab" },
      { key: "department_id", label: "Dept ID" },
      { key: "capacity", label: "Capacity" },
      { key: "equipment_type", label: "Equipment" },
    ],
  },
};

function toInitialForm(resource) {
  const config = MASTER_RESOURCES[resource];
  const initial = {};
  config?.fields?.forEach((field) => {
    if (field.type === "checkbox") {
      initial[field.name] = Boolean(field.defaultValue);
    } else {
      initial[field.name] = field.defaultValue ?? "";
    }
  });
  return initial;
}

function normaliseFormPayload(resource, form) {
  const config = MASTER_RESOURCES[resource];
  const payload = {};

  config.fields.forEach((field) => {
    const rawValue = form[field.name];
    if (field.type === "checkbox") {
      payload[field.name] = Boolean(rawValue);
      return;
    }

    if (field.type === "number") {
      const value = rawValue === "" || rawValue === null ? null : Number(rawValue);
      if (value !== null && !Number.isNaN(value)) {
        payload[field.name] = value;
      }
      return;
    }

    if (field.type === "textarea" && rawValue && typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      try {
        payload[field.name] = JSON.parse(trimmed);
      } catch (error) {
        payload[field.name] = trimmed;
      }
      return;
    }

    if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "") {
      payload[field.name] = String(rawValue).trim();
    }
  });

  return payload;
}

function renderValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function useMasterResource(resource) {
  const config = MASTER_RESOURCES[resource];
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(() => toInitialForm(resource));
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setForm(toInitialForm(resource));
    setEditingId(null);
    setQuery("");
    setPagination({ page: 1, limit: 10, total: 0 });
  }, [resource]);

  const listQuery = useQuery({
    queryKey: ["masterData", resource, pagination.page, pagination.limit, query],
    queryFn: async () => {
      const res = await masterApi.list(resource, { page: pagination.page, limit: pagination.limit, q: query || undefined });
      return res;
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    if (listQuery.data?.pagination) {
      setPagination((current) => ({
        ...current,
        total: listQuery.data.pagination.total || 0,
      }));
    }
  }, [listQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingId) {
        return masterApi.update(resource, editingId, payload);
      }
      return masterApi.create(resource, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["masterData", resource]);
      queryClient.invalidateQueries(["stats"]);
      setForm(toInitialForm(resource));
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => masterApi.remove(resource, id),
    onSuccess: () => {
      queryClient.invalidateQueries(["masterData", resource]);
      queryClient.invalidateQueries(["stats"]);
      setDeletingId(null);
    },
  });

  async function saveRecord(event) {
    event.preventDefault();
    const payload = normaliseFormPayload(resource, form);
    saveMutation.mutate(payload);
  }

  function onEdit(row) {
    const nextForm = toInitialForm(resource);
    config.fields.forEach((field) => {
      if (row[field.name] !== undefined && row[field.name] !== null) {
        nextForm[field.name] = field.type === "checkbox" ? Boolean(row[field.name]) : row[field.name];
      }
    });
    setForm(nextForm);
    setEditingId(row.id);
  }

  return {
    rows: listQuery.data?.data || [],
    pagination,
    query,
    setQuery,
    setPage: (nextPage) => setPagination((c) => ({ ...c, page: Math.max(1, nextPage) })),
    reload: () => listQuery.refetch(),
    loading: listQuery.isLoading || listQuery.isFetching,
    error: listQuery.error?.message || saveMutation.error?.message || deleteMutation.error?.message,
    form,
    setForm,
    editingId,
    setEditingId,
    deletingId,
    setDeletingId,
    saveRecord,
    isSaving: saveMutation.isLoading || saveMutation.isPending,
    executeDelete: () => deleteMutation.mutate(deletingId),
    isDeleting: deleteMutation.isLoading || deleteMutation.isPending,
    onEdit,
  };
}

export function AdminDashboardPage() {
  const { data: summary, isLoading: loading, error: queryError } = useQuery({
    queryKey: ["stats", { includeActivity: true }],
    queryFn: () => statsApi.get(true),
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const error = queryError?.message || "";
  const recentActivity = summary?.recent_activity || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin dashboard"
        title="System overview"
        description="Track users, departments, timetable generation, and live platform health from one place."
        actions={[
          <Button key="generate" asChild variant="primary">
            <Link className="inline-flex items-center gap-2" to="/admin/timetable">
              Generate timetable
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>,
          <Button key="master" asChild variant="secondary">
            <Link className="inline-flex items-center gap-2" to="/admin/master-data">
              Open master data
            </Link>
          </Button>,
        ]}
      />

      {error ? (
        <Card className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Database} label="Departments" value={summary?.totals?.departments ?? 0} tone="admin" />
        <StatCard icon={CalendarRange} label="Timetable versions" value={summary?.totals?.timetable_versions ?? 0} tone="warning" />
        <StatCard icon={Settings2} label="Faculty records" value={summary?.totals?.faculty ?? 0} tone="success" />
        <StatCard icon={Activity} label="Average workload" value={summary?.metrics?.average_faculty_workload ?? 0} tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Quick actions</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Operate the platform</h3>
            </div>
            <Badge tone="info">Live</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              to="/admin/timetable"
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <p className="text-sm font-semibold text-white">Generate timetable</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Run the scheduling engine for the selected semester.</p>
            </Link>
            <Link
              to="/admin/master-data"
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <p className="text-sm font-semibold text-white">Master data</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Manage departments, branches, sections, and subjects.</p>
            </Link>
            <Link
              to="/admin/reports"
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <p className="text-sm font-semibold text-white">Reports</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Check workload, room utilization, and conflicts.</p>
            </Link>
            <Link
              to="/admin/activity-logs"
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <p className="text-sm font-semibold text-white">Activity logs</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Audit what changed and when it happened.</p>
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Health</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Platform metrics</h3>
            </div>
            <Badge tone="success">Stable</Badge>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-slate-300">Room utilization</span>
              <span className="text-sm font-semibold text-white">{formatPercent(summary?.metrics?.room_utilization_percent || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-slate-300">Departments</span>
              <span className="text-sm font-semibold text-white">{formatNumber(summary?.totals?.departments || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-slate-300">Active sections</span>
              <span className="text-sm font-semibold text-white">{formatNumber(summary?.totals?.sections || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">Recent activity</h3>
            <Badge tone="neutral">{recentActivity.length} items</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {loading && !summary ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
                <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
                <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
              </div>
            ) : recentActivity.length ? (
              recentActivity.map((item, index) => (
                <div key={`${item.created_at}-${index}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.action_type}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.details || "—"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No activity yet"
                description="Recent activity will appear here once admin actions start flowing."
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">Navigation map</h3>
            <Badge tone="info">Role aware</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {adminNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
              >
                <span>{item.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function MasterDataPage() {
  const resourceEntries = [
    "departments",
    "department-schedule-config",
    "branches",
    "sections",
    "blocks",
    "classrooms",
    "laboratories",
    "faculty",
    "subjects",
    "semesters",
  ].map((key) => [key, MASTER_RESOURCES[key]]).filter(([, item]) => Boolean(item));
  const [resource, setResource] = useState(resourceEntries[0][0]);
  const {
    rows,
    pagination,
    query,
    setQuery,
    setPage,
    reload,
    loading,
    error,
    form,
    setForm,
    editingId,
    setEditingId,
    saveRecord,
    isSaving,
    deletingId,
    setDeletingId,
    executeDelete,
    isDeleting,
    onEdit,
  } = useMasterResource(resource);
  const config = MASTER_RESOURCES[resource];

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 10)));

  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.get(false),
  });
  const totals = statsData?.totals || {};

  function getResourceTotal(key) {
    if (!totals) return 0;
    if (key === 'laboratories') return totals.labs || 0;
    if (key === 'department-schedule-config') return totals.department_schedule_config || 0;
    return totals[key] || 0;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Master data"
        title="Academic setup"
        description="Manage departments, working hours, branches, sections, blocks, classrooms, labs, faculty, subjects, and semesters."
        actions={[
          <Button key="refresh" variant="secondary" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>,
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resourceEntries.map(([key, item]) => {
          const Icon = item.icon;
          const active = resource === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setResource(key)}
              className={[
                "relative overflow-hidden rounded-[22px] border p-5 text-left transition duration-200 hover:-translate-y-0.5",
                active
                  ? "border-transparent text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
              ].join(" ")}
              style={{ backgroundColor: active ? "var(--accent-soft)" : undefined }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {key.replace(/-/g, " ")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                </div>
                <div className="rounded-2xl bg-white/15 px-3 py-1 text-sm font-bold text-slate-900 dark:text-white" title="Total records">
                  {getResourceTotal(key)}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <span className="rounded-xl bg-white/85 px-3 py-3 text-center text-sm font-medium text-slate-900">
                  Add {item.title.replace(/Working Hours/i, "Working Hours")}
                </span>
                <span className="rounded-xl border border-slate-900/10 px-3 py-3 text-center text-sm font-medium text-slate-900/90 dark:text-white">
                  See {item.title} Info
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Editor</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">{config.title}</h3>
            </div>
            <Badge tone={editingId ? "warning" : "info"}>{editingId ? "Editing" : "New"}</Badge>
          </div>

          <form className="mt-5 space-y-4" onSubmit={saveRecord}>
            {config.fields.map((field) => {
              if (field.type === "checkbox") {
                return (
                  <label key={field.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.name])}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field.name]: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{field.label}</p>
                      {field.hint ? <p className="text-xs text-slate-500">{field.hint}</p> : null}
                    </div>
                  </label>
                );
              }

              if (field.type === "select") {
                return (
                  <Select
                    key={field.name}
                    label={field.label}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    required={field.required}
                    hint={field.hint}
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                );
              }
              if (field.type === "textarea") {
                return (
                  <Textarea
                    key={field.name}
                    label={field.label}
                    placeholder={field.placeholder || ""}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    hint={field.hint}
                  />
                );
              }

              if (field.type === "smart-select") {
                const filter = {};
                if (field.dependsOn) {
                  filter[field.dependsOn] = form[field.dependsOn];
                }
                return (
                  <SmartSelect
                    key={field.name}
                    label={field.label}
                    resource={field.resource}
                    value={form[field.name]}
                    filter={filter}
                    disabled={field.dependsOn && !form[field.dependsOn]}
                    onChange={(val) => {
                      setForm((current) => {
                        const next = { ...current, [field.name]: val };
                        // Clear dependent fields
                        config.fields.forEach((f) => {
                          if (f.dependsOn === field.name) {
                            next[f.name] = "";
                          }
                        });
                        return next;
                      });
                    }}
                    required={field.required}
                    hint={field.hint}
                  />
                );
              }

              return (
                <Input
                  key={field.name}
                  label={field.label}
                  type={field.type || "text"}
                  step={field.step}
                  placeholder={field.placeholder || ""}
                  value={form[field.name] ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                  required={field.required}
                  hint={field.hint}
                />
              );
            })}

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {editingId ? "Update record" : "Create record"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setForm(toInitialForm(resource));
                  setEditingId(null);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-white">Filter records</h3>
              </div>
              <Badge tone="neutral">{formatNumber(pagination.total || 0)} rows</Badge>
            </div>
            <div className="mt-4">
              <Input
                placeholder={`Search ${config.title.toLowerCase()}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </Card>

          <DataTable
            columns={config.columns.map((column) => ({
              ...column,
              render: (row) => renderValue(row[column.key]),
            }))}
            rows={rows}
            emptyMessage={loading ? "Loading..." : `No ${config.title.toLowerCase()} found.`}
            renderActions={(row) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" className="px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10" onClick={() => setDeletingId(row.id)}>
                  Delete
                </Button>
              </div>
            )}
          />

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <span>
              Page {pagination.page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={pagination.page <= 1 || loading} onClick={() => setPage(pagination.page - 1)}>
                Prev
              </Button>
              <Button
                variant="secondary"
                disabled={pagination.page >= totalPages || loading}
                onClick={() => setPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DeleteConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title={`Delete ${config.title} Record`}
        description="Are you sure you want to delete this record? This action cannot be undone and will instantly reflect across the system."
        isDeleting={isDeleting}
      />
    </div>
  );
}

export function TimetablePage() {
  const [masterOptions, setMasterOptions] = useState({
    departments: [],
    branches: [],
    semesters: [],
    sections: [],
    faculty: [],
    subjects: [],
    classrooms: [],
    laboratories: [],
    blocks: [],
  });
  const [timetableList, setTimetableList] = useState([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState("");
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [generateResult, setGenerateResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [form, setForm] = useState({
    department_id: "",
    branch_id: "",
    semester_id: "",
    section_id: "",
    faculty_id: "",
    subject_id: "",
    classroom_id: "",
    lab_id: "",
    version_name: "",
    generation_strategy: "balanced",
    faculty_overuse_threshold: 3,
    auto_room_expansion: true,
    include_working_hours: true,
    include_labs: true,
    include_breaks: true,
    include_selected_only: false,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [listResponse, historyResponse, departments, branches, semesters, sections, faculty, subjects, classrooms, laboratories, blocks] = await Promise.all([
          dashboardApi.timetableList(),
          dashboardApi.timetableHistory({ limit: 10 }),
          masterApi.list("departments", { limit: 100 }),
          masterApi.list("branches", { limit: 100 }),
          masterApi.list("semesters", { limit: 100 }),
          masterApi.list("sections", { limit: 100 }),
          masterApi.list("faculty", { limit: 100 }),
          masterApi.list("subjects", { limit: 100 }),
          masterApi.list("classrooms", { limit: 100 }),
          masterApi.list("laboratories", { limit: 100 }),
          masterApi.list("blocks", { limit: 100 }),
        ]);
        if (cancelled) return;
        const list = listResponse.data || [];
        setTimetableList(list);
        setHistory(historyResponse.data || []);
        setMasterOptions({
          departments: departments.data || [],
          branches: branches.data || [],
          semesters: semesters.data || [],
          sections: sections.data || [],
          faculty: faculty.data || [],
          subjects: subjects.data || [],
          classrooms: classrooms.data || [],
          laboratories: laboratories.data || [],
          blocks: blocks.data || [],
        });
        const first = list[0]?.id || "";
        setSelectedTimetableId(String(first));
        if (first) {
          const detailResponse = await dashboardApi.timetableDetail(first);
          if (!cancelled) setDetail(detailResponse);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Unable to load timetable data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  async function handleGenerate(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        department_id: Number(form.department_id) || undefined,
        branch_id: Number(form.branch_id) || undefined,
        semester_id: Number(form.semester_id),
        section_id: Number(form.section_id) || undefined,
        faculty_id: Number(form.faculty_id) || undefined,
        subject_id: Number(form.subject_id) || undefined,
        classroom_id: Number(form.classroom_id) || undefined,
        lab_id: Number(form.lab_id) || undefined,
        version_name: form.version_name,
        generation_strategy: form.generation_strategy,
        faculty_overuse_threshold: Number(form.faculty_overuse_threshold),
        auto_room_expansion: Boolean(form.auto_room_expansion),
        include_working_hours: Boolean(form.include_working_hours),
        include_labs: Boolean(form.include_labs),
        include_breaks: Boolean(form.include_breaks),
        include_selected_only: Boolean(form.include_selected_only),
      };
      const response = await dashboardApi.generateTimetable(payload);
      setGenerateResult(response);
      const [listResponse, historyResponse] = await Promise.all([
        dashboardApi.timetableList(),
        dashboardApi.timetableHistory({ limit: 10 }),
      ]);
      const list = listResponse.data || [];
      setTimetableList(list);
      setHistory(historyResponse.data || []);
      const selectedId = response?.timetable?.id || list[0]?.id || "";
      setSelectedTimetableId(String(selectedId));
      if (selectedId) {
        setDetail(await dashboardApi.timetableDetail(selectedId));
      }
    } catch (generateError) {
      setError(generateError.message || "Unable to generate timetable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedTimetableId) return;
    let cancelled = false;

    async function loadDetail() {
      try {
        const response = await dashboardApi.timetableDetail(selectedTimetableId);
        if (!cancelled) setDetail(response);
      } catch (detailError) {
        if (!cancelled) setError(detailError.message || "Unable to load timetable detail");
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedTimetableId]);

  const entries = detail?.entries || [];
  const timeSlots = detail?.time_slots || [];
  const stats = useMemo(() => summarizeTimetable(entries), [entries]);
  const sections = useMemo(
    () => [...new Set(entries.map((entry) => entry.section_name).filter(Boolean))],
    [entries]
  );
  const [selectedSection, setSelectedSection] = useState("");

  useEffect(() => {
    if (sections.length && !sections.includes(selectedSection)) {
      setSelectedSection(sections[0]);
    }
  }, [sections, selectedSection]);

  const filteredEntries = selectedSection
    ? entries.filter((entry) => entry.section_name === selectedSection)
    : entries;
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Timetable"
        title="Generate and inspect schedules"
        description="Create new timetable versions, inspect history, and review section-by-section grids."
        actions={[
          <Button key="refresh" variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>,
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Generator</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-white">Create a timetable version</h3>

          <form className="mt-5 space-y-4" onSubmit={handleGenerate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartSelect
                label="Department"
                resource="departments"
                value={form.department_id}
                onChange={(val) => setForm((current) => ({ ...current, department_id: val, branch_id: "", semester_id: "", section_id: "" }))}
              />
              <SmartSelect
                label="Branch"
                resource="branches"
                value={form.branch_id}
                filter={form.department_id ? { department_id: form.department_id } : {}}
                disabled={!form.department_id}
                onChange={(val) => setForm((current) => ({ ...current, branch_id: val, semester_id: "", section_id: "" }))}
              />
              <SmartSelect
                label="Semester"
                resource="semesters"
                value={form.semester_id}
                filter={form.branch_id ? { branch_id: form.branch_id } : {}}
                disabled={!form.branch_id}
                required
                onChange={(val) => setForm((current) => ({ ...current, semester_id: val, section_id: "" }))}
              />
              <SmartSelect
                label="Section"
                resource="sections"
                value={form.section_id}
                filter={form.semester_id ? { semester_id: form.semester_id } : {}}
                disabled={!form.semester_id}
                onChange={(val) => setForm((current) => ({ ...current, section_id: val }))}
              />
              <SmartSelect
                label="Faculty"
                resource="faculty"
                value={form.faculty_id}
                filter={form.department_id ? { department_id: form.department_id } : {}}
                onSelectionChange={(faculty) => {
                  if (faculty?.department_id && !form.department_id) {
                    setForm(curr => ({ ...curr, department_id: String(faculty.department_id) }));
                  }
                }}
                onChange={(val) => setForm((current) => ({ ...current, faculty_id: val }))}
              />
              <SmartSelect
                label="Subject"
                resource="subjects"
                value={form.subject_id}
                filter={form.semester_id ? { semester_id: form.semester_id } : {}}
                onSelectionChange={(subject) => {
                  if (subject) {
                    setForm(curr => ({
                      ...curr,
                      department_id: curr.department_id || String(subject.department_id || ""),
                      branch_id: curr.branch_id || String(subject.branch_id || ""),
                      semester_id: curr.semester_id || String(subject.semester_id || ""),
                    }));
                  }
                }}
                disabled={!form.semester_id}
                onChange={(val) => setForm((current) => ({ ...current, subject_id: val }))}
              />
              <SmartSelect
                label="Classroom"
                resource="classrooms"
                value={form.classroom_id}
                onChange={(val) => setForm((current) => ({ ...current, classroom_id: val }))}
              />
              <SmartSelect
                label="Lab"
                resource="laboratories"
                value={form.lab_id}
                filter={form.department_id ? { department_id: form.department_id } : {}}
                onChange={(val) => setForm((current) => ({ ...current, lab_id: val }))}
              />
            </div>
            <Input
              label="Version name"
              placeholder="e.g. Spring 2025 v1"
              value={form.version_name}
              onChange={(event) => setForm((current) => ({ ...current, version_name: event.target.value }))}
              required
            />
            <Select
              label="Generation strategy"
              value={form.generation_strategy}
              onChange={(event) => setForm((current) => ({ ...current, generation_strategy: event.target.value }))}
            >
              <option value="balanced">Balanced</option>
              <option value="compact">Compact</option>
              <option value="faculty_friendly">Faculty friendly</option>
            </Select>
            <Input
              label="Faculty overuse threshold"
              type="number"
              value={form.faculty_overuse_threshold}
              onChange={(event) =>
                setForm((current) => ({ ...current, faculty_overuse_threshold: event.target.value }))
              }
            />

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(form.auto_room_expansion)}
                onChange={(event) => setForm((current) => ({ ...current, auto_room_expansion: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
              />
              <div>
                <p className="text-sm font-medium text-white">Auto room expansion</p>
                <p className="text-xs text-slate-500">Create fallback rooms when demand exceeds capacity.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(form.include_working_hours)}
                onChange={(event) => setForm((current) => ({ ...current, include_working_hours: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
              />
              <div>
                <p className="text-sm font-medium text-white">Use working hours</p>
                <p className="text-xs text-slate-500">Respect department schedule configuration.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(form.include_labs)}
                onChange={(event) => setForm((current) => ({ ...current, include_labs: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
              />
              <div>
                <p className="text-sm font-medium text-white">Include labs</p>
                <p className="text-xs text-slate-500">Use laboratory slots when subject requires practicals.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(form.include_breaks)}
                onChange={(event) => setForm((current) => ({ ...current, include_breaks: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
              />
              <div>
                <p className="text-sm font-medium text-white">Include breaks</p>
                <p className="text-xs text-slate-500">Insert lunch and department break slots.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(form.include_selected_only)}
                onChange={(event) => setForm((current) => ({ ...current, include_selected_only: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[color:var(--accent)] focus-ring"
              />
              <div>
                <p className="text-sm font-medium text-white">Selected only</p>
                <p className="text-xs text-slate-500">Restrict generation to the selected branch / section context.</p>
              </div>
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Generating..." : "Generate timetable"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <TimetableStatStrip stats={stats} />
          {generateResult ? (
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard icon={Sparkles} label="Assigned entries" value={generateResult.assigned_entries || 0} tone="success" />
              <StatCard icon={TriangleAlert} label="Conflicts" value={generateResult.conflicts_count || 0} tone="warning" />
              <StatCard icon={CircleSlash2} label="Self-study" value={generateResult.self_study_entries || 0} tone="admin" />
            </div>
          ) : null}
          <TimetableLegend entries={filteredEntries} />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Available versions</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">Timetable selector</h3>
          </div>
          <Select
            className="md:min-w-[280px]"
            value={selectedTimetableId}
            onChange={(event) => setSelectedTimetableId(event.target.value)}
          >
            {timetableList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.version_name} · {item.semester_number}/{item.academic_year}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {detail ? (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">{detail.timetable?.version_name || "Timetable"}</Badge>
              <Badge tone="neutral">
                {detail.timetable?.semester_number || "—"} / {detail.timetable?.academic_year || "—"}
              </Badge>
              <Badge tone={detail.timetable?.status === "Approved" ? "success" : "warning"}>
                {detail.timetable?.status || "Draft"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StatCard icon={LayoutGrid} label="Sections" value={stats.sectionCount} tone="admin" />
              <StatCard icon={Sparkles} label="Subjects" value={stats.subjectCount} tone="success" />
              <StatCard icon={CalendarRange} label="Rooms" value={stats.roomCount} tone="warning" />
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setSelectedSection(section)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  selectedSection === section
                    ? "border-transparent text-white"
                    : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
                style={{ backgroundColor: selectedSection === section ? "var(--accent-soft)" : "rgba(255,255,255,0.03)" }}
              >
                {section}
              </button>
            ))}
          </div>

          <TimetableGrid
            entries={filteredEntries}
            timeSlots={timeSlots}
            title={selectedSection || "Timetable grid"}
            subtitle="Section-specific weekly view"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">History</h3>
            <Badge tone="neutral">{history.length} versions</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.version_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.branch_name || "Branch"} · {item.semester_number}/{item.academic_year}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{formatDateTime(item.created_at)}</p>
                  {item.pdf_path ? (
                    <a
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)]"
                      href={item.pdf_path}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-xl font-semibold text-white">Generation summary</h3>
          {generateResult ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Conflicts: {generateResult.conflicts_count || 0}</div>
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Warnings: {generateResult.validation_warnings?.length || 0}</div>
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Empty slots: {generateResult.empty_slots_count || 0}</div>
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">PDF path: {generateResult.pdf_path || "—"}</div>
            </div>
          ) : (
            <EmptyState
              title="No generation yet"
              description="Generate a timetable to see a richer summary here."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [workload, setWorkload] = useState([]);
  const [roomUtilization, setRoomUtilization] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);
  const [conflicts, setConflicts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [workloadResponse, roomResponse, subjectResponse, conflictResponse] = await Promise.all([
          dashboardApi.workloadReport(),
          dashboardApi.roomUtilizationReport(),
          dashboardApi.subjectDistributionReport(),
          dashboardApi.conflictsReport(),
        ]);
        if (cancelled) return;
        setWorkload(workloadResponse.data || []);
        setRoomUtilization(roomResponse.data || []);
        setSubjectDistribution(subjectResponse.data || []);
        setConflicts(conflictResponse);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Unable to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const workloadChart = workload.slice(0, 8).map((row) => ({
    name: row.full_name,
    assigned: row.assigned_slots,
    max: row.max_workload_per_week,
  }));

  const roomChart = roomUtilization.slice(0, 8).map((row) => ({
    name: row.room_number,
    used: row.used_slots,
    total: Math.max(row.used_slots + 1, 1),
  }));

  const subjectChart = useMemo(() => {
    const buckets = new Map();
    subjectDistribution.forEach((row) => {
      const key = row.subject_name || row.subject_code;
      buckets.set(key, (buckets.get(key) || 0) + Number(row.allocated_sessions || 0));
    });
    return [...buckets.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [subjectDistribution]);

  const reportColors = ["#0066FF", "#10B981", "#FF8C42", "#F59E0B", "#06B6D4", "#A855F7"];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reports"
        title="Analytics and insights"
        description="Review staffing load, room usage, subject spread, and conflict signals."
        actions={[
          <Button key="refresh" variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>,
        ]}
      />

      {error ? (
        <Card className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Sparkles} label="Faculty rows" value={workload.length} tone="admin" />
        <StatCard icon={CalendarRange} label="Rooms tracked" value={roomUtilization.length} tone="success" />
        <StatCard icon={TriangleAlert} label="Conflicts" value={conflicts?.has_conflicts ? "Yes" : "No"} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-xl font-semibold text-white">Faculty workload</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadChart} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                <Bar dataKey="assigned" fill="#0066FF" radius={[10, 10, 0, 0]} />
                <Bar dataKey="max" fill="rgba(255,255,255,0.12)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-xl font-semibold text-white">Room utilization</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomChart} layout="vertical" margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={90} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                <Bar dataKey="used" fill="#10B981" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5">
          <h3 className="font-display text-xl font-semibold text-white">Subject distribution</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={4}>
                    {subjectChart.map((entry, index) => (
                      <Cell key={entry.name} fill={reportColors[index % reportColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {subjectChart.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: reportColors[index % reportColors.length] }} />
                    {entry.name}
                  </span>
                  <span className="font-semibold text-white">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">Conflict summary</h3>
            <Badge tone={conflicts?.has_conflicts ? "warning" : "success"}>
              {conflicts?.has_conflicts ? "Needs attention" : "Clear"}
            </Badge>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
              Faculty conflicts: {conflicts?.faculty_conflicts?.length || 0}
            </div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
              Classroom conflicts: {conflicts?.classroom_conflicts?.length || 0}
            </div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
              Section conflicts: {conflicts?.section_conflicts?.length || 0}
            </div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
              Section subject/faculty conflicts: {conflicts?.section_subject_faculty_conflicts?.length || 0}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ActivityLogsPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await dashboardApi.activityLog({ page: pagination.page, limit: pagination.limit, q: query || undefined });
        if (cancelled) return;
        setRows(response.data || []);
        setPagination((current) => ({
          ...current,
          total: response.pagination?.total || 0,
        }));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Unable to load activity logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query, pagination.page, pagination.limit, refreshTick]);

  async function removeLog(id) {
    if (!window.confirm("Delete this activity log?")) return;
    setLoading(true);
    try {
      await dashboardApi.deleteActivity(id);
      const response = await dashboardApi.activityLog({ page: pagination.page, limit: pagination.limit, q: query || undefined });
      setRows(response.data || []);
      setPagination((current) => ({ ...current, total: response.pagination?.total || 0 }));
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete activity");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 10)));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Activity logs"
        title="Audit trail"
        description="Inspect what happened across the platform and remove entries when needed."
        actions={[
          <Button key="refresh" variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>,
        ]}
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">Filter logs</h3>
          </div>
          <Badge tone="neutral">{formatNumber(pagination.total || 0)} entries</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Search actions, actor names, or details"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="secondary" onClick={() => setQuery((value) => value.trim())}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </Card>

      {error ? (
        <Card className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</Card>
      ) : null}

      <DataTable
        columns={[
          { key: "created_at", label: "Time", render: (row) => formatDateTime(row.created_at) },
          { key: "actor_name", label: "Actor", render: (row) => row.actor_name || "System" },
          { key: "action_type", label: "Action", render: (row) => row.action_type || "—" },
          { key: "details", label: "Details", render: (row) => row.details || "—" },
        ]}
        rows={rows}
        emptyMessage={loading ? "Loading..." : "No activity logs found."}
        renderActions={(row) => (
          <Button variant="ghost" className="px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10" onClick={() => removeLog(row.id)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      />

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        <span>
          Page {pagination.page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>
            Prev
          </Button>
          <Button
            variant="secondary"
            disabled={pagination.page >= totalPages || loading}
            onClick={() => setPagination((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
