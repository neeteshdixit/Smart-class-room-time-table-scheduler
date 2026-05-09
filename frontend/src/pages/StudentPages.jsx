import React, { useEffect, useState } from "react";
import { CalendarDays, Clock3, GraduationCap, MapPin, Sparkles, TimerReset } from "lucide-react";
import { profileApi, apiClient } from "../lib/api";
import { formatDateTime, formatTime, initials } from "../lib/format";
import { getRoleTheme } from "../lib/theme";
import { Badge, Card, SectionHeader, StatCard } from "../components/ui";
import { TimetableGrid, TimetableLegend, TimetableStatStrip } from "../components/timetable";
import { useAuth } from "../context/AuthContext";

function useStudentData() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user);
  const [timetable, setTimetable] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [profileRes, timetableRes, slotsRes] = await Promise.all([
          profileApi.get(),
          apiClient.get(`/student/my-timetable?date=${today}`),
          apiClient.get("/master/time-slots"),
        ]);
        setProfile(profileRes.profile || user);
        setTimetable(timetableRes.data || []);
        setTimeSlots(slotsRes.data?.data || []);
      } catch (err) {
        setError(err.message);
        setProfile(user);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  return { profile, timetable, timeSlots, loading, error };
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
          {item.is_substituted && (
            <Badge tone="success" className="ml-2 scale-90">Substituted</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudentDashboardPage() {
  const { user } = useAuth();
  const theme = getRoleTheme("student");
  const { profile, timetable, timeSlots, loading, error } = useStudentData();
  
  // Logic to filter today's classes from the live timetable
  const todayDayOfWeek = new Date().getDay() || 7; // Convert 0 (Sun) to 7
  const todayClasses = timetable.filter(item => Number(item.day_of_week) === todayDayOfWeek);
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
        <StatCard icon={Sparkles} label="Classes this week" value={timetable.length} tone="success" />
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
            <Badge tone="neutral">Mon-Sat</Badge>
          </div>
          <div className="mt-5">
            <TimetableGrid
              entries={timetable}
              timeSlots={timeSlots}
              title="Student timetable"
              subtitle="Live weekly schedule for your assigned section"
              compact
            />
          </div>
        </Card>

        <div className="space-y-6">
          <TimetableLegend entries={timetable} />
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
  const { timetable, timeSlots, loading } = useStudentData();
  
  if (loading) return <div>Loading timetable...</div>;

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
            subjectCount: new Set(timetable.map(item => item.subject_id)).size,
            roomCount: new Set(timetable.map((item) => item.room_number)).size,
            entryCount: timetable.length,
          }}
        />
      </Card>
      <TimetableGrid
        entries={timetable}
        timeSlots={timeSlots}
        title="My timetable"
        subtitle="Live schedule for the student portal"
      />
      <TimetableLegend entries={timetable} />
    </div>
  );
}
