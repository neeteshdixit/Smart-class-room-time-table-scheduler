import React, { useEffect, useState } from "react";
import { CalendarDays, Clock3, GraduationCap, MapPin, Sparkles, TimerReset } from "lucide-react";
import { profileApi } from "../lib/api";
import { formatDateTime, formatTime, initials, toTitleCase } from "../lib/format";
import { getRoleTheme } from "../lib/theme";
import { Badge, Button, Card, EmptyState, SectionHeader, StatCard } from "../components/ui";
import { TimetableGrid, TimetableLegend, TimetableStatStrip } from "../components/timetable";
import { useAuth } from "../context/AuthContext";

const DEMO_STUDENT_CLASSES = [
  {
    id: 1,
    day_of_week: 1,
    slot_number: 1,
    start_time: "09:00:00",
    end_time: "09:50:00",
    subject_name: "Software Engineering",
    subject_code: "CS-501",
    faculty_name: "Dr. Anita Rao",
    room_number: "A-101",
    section_name: "CSE-A",
    session_mode: "Theory",
  },
  {
    id: 2,
    day_of_week: 1,
    slot_number: 2,
    start_time: "10:00:00",
    end_time: "10:50:00",
    subject_name: "Database Systems",
    subject_code: "CS-503",
    faculty_name: "Prof. Neil Mehta",
    room_number: "Lab-2",
    section_name: "CSE-A",
    session_mode: "Practical",
  },
  {
    id: 3,
    day_of_week: 3,
    slot_number: 3,
    start_time: "11:00:00",
    end_time: "11:50:00",
    subject_name: "Operating Systems",
    subject_code: "CS-504",
    faculty_name: "Prof. R. Verma",
    room_number: "B-204",
    section_name: "CSE-A",
    session_mode: "Theory",
  },
  {
    id: 4,
    day_of_week: 4,
    slot_number: 4,
    start_time: "02:00:00",
    end_time: "02:50:00",
    subject_name: "Project Lab",
    subject_code: "CS-511",
    faculty_name: "Dr. A. Sharma",
    room_number: "Lab-4",
    section_name: "CSE-A",
    session_mode: "Practical",
  },
];

function useStudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await profileApi.get();
        if (!cancelled) {
          setProfile(response.profile || user);
        }
      } catch (loadError) {
        if (!cancelled) {
          setProfile(user);
          setError(loadError.message || "Unable to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profile, loading, error };
}

function StudentTodayCard({ item, isNext = false }) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 transition hover:-translate-y-0.5",
        isNext ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]" : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.subject_code}</p>
          <h4 className="mt-2 font-display text-xl font-semibold text-white">{item.subject_name}</h4>
        </div>
        {isNext ? <Badge tone="warning">Next</Badge> : <Badge tone="neutral">{item.session_mode}</Badge>}
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-slate-400" />
          {formatTime(item.start_time)} - {formatTime(item.end_time)}
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          {item.room_number}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-slate-400" />
          {item.faculty_name}
        </div>
      </div>
    </div>
  );
}

export function StudentDashboardPage() {
  const { user } = useAuth();
  const theme = getRoleTheme("student");
  const { profile, loading, error } = useStudentProfile();
  const todayClasses = DEMO_STUDENT_CLASSES.slice(0, 2);
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Student workspace"
        title="My classes today"
        description="A minimal, high-contrast view for checking today’s classes, room numbers, and faculty at a glance."
        actions={[<Badge key="preview" tone="warning">Preview timetable</Badge>]}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={CalendarDays} label="Classes today" value={todayClasses.length} tone="student" />
        <StatCard icon={GraduationCap} label="Semester" value={profile?.semester || "—"} tone="info" />
        <StatCard icon={TimerReset} label="Section" value={profile?.section || profile?.role || "Student"} tone="warning" />
        <StatCard icon={Sparkles} label="Classes this week" value={DEMO_STUDENT_CLASSES.length} tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Today</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">Today&apos;s classes</h3>
            </div>
            <Badge tone="warning">Focus mode</Badge>
          </div>
          <div className="mt-5 grid gap-4">
            {todayClasses.map((item, index) => (
              <StudentTodayCard key={item.id} item={item} isNext={index === 0} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Profile</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                {profile?.full_name || user?.full_name || "Student"}
              </h3>
            </div>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
              style={{ background: theme.heroGradient }}
            >
              <span className="font-display text-sm font-semibold">{initials(profile?.full_name || user?.full_name || "Student")}</span>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Roll number: {profile?.roll_number || profile?.faculty_id || "—"}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Email: {profile?.email || "—"}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Section: {profile?.section || "—"}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Last login: {formatDateTime(profile?.last_login)}</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">This week</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Compact calendar view</h3>
            </div>
            <Badge tone="neutral">Mon-Fri</Badge>
          </div>
          <div className="mt-5">
            <TimetableGrid
              entries={DEMO_STUDENT_CLASSES}
              timeSlots={DEMO_STUDENT_CLASSES}
              title="Student timetable"
              subtitle="Preview grid with the same polished treatment as the backend-powered views"
              compact
            />
          </div>
        </Card>

        <div className="space-y-6">
          <TimetableLegend entries={DEMO_STUDENT_CLASSES} />
          <Card className="p-5">
            <h3 className="font-display text-xl font-semibold text-white">Student notes</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p className="rounded-2xl bg-white/[0.03] px-4 py-3">
                The backend currently does not expose a dedicated student timetable endpoint, so this screen uses a preview schedule while keeping the UI design production-ready.
              </p>
              <p className="rounded-2xl bg-white/[0.03] px-4 py-3">
                Once student APIs are added, this screen can switch to live data without changing the layout.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {error ? (
        <Card className="border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          {error}
        </Card>
      ) : null}
    </div>
  );
}

export function StudentTimetablePage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Student timetable"
        title="Full timetable view"
        description="A large, easy-to-read schedule for semester planning and daily reference."
      />
      <Card className="p-5">
        <TimetableStatStrip
          stats={{
            sectionCount: 1,
            subjectCount: DEMO_STUDENT_CLASSES.length,
            roomCount: new Set(DEMO_STUDENT_CLASSES.map((item) => item.room_number)).size,
            entryCount: DEMO_STUDENT_CLASSES.length,
          }}
        />
      </Card>
      <TimetableGrid
        entries={DEMO_STUDENT_CLASSES}
        timeSlots={DEMO_STUDENT_CLASSES}
        title="My timetable"
        subtitle="Preview schedule for the student portal"
      />
      <TimetableLegend entries={DEMO_STUDENT_CLASSES} />
    </div>
  );
}
