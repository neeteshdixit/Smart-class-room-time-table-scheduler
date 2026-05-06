import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  Share2,
  Sparkles,
  Users,
  FileText,
  RefreshCw,
} from "lucide-react";
import { facultyApi } from "../lib/api";
import { formatNumber, toTitleCase } from "../lib/format";
import { summarizeTimetable } from "../lib/timetable";
import { getRoleTheme } from "../lib/theme";
import { Badge, Button, Card, EmptyState, Input, SectionHeader, Select, StatCard, Textarea } from "../components/ui";
import { TimetableGrid, TimetableLegend } from "../components/timetable";
import { useAuth } from "../context/AuthContext";

function useFacultyWorkspace() {
  const [data, setData] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [selectedTimetableId, setSelectedTimetableId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await facultyApi.timetable(
          selectedTimetableId ? { timetable_id: selectedTimetableId } : {}
        );
        if (cancelled) return;
        setData(response);
        const nextSelected = String(
          selectedTimetableId || response.selected_timetable_id || response.timetables?.[0]?.id || ""
        );
        if (nextSelected && nextSelected !== selectedTimetableId) {
          setSelectedTimetableId(nextSelected);
        }

        const sections = [...new Set((response.entries || []).map((entry) => entry.section_name).filter(Boolean))];
        if (sections.length && !sections.includes(selectedSection)) {
          setSelectedSection(sections[0]);
        }

        if (response.faculty?.is_mentor) {
          try {
            const studentResponse = await facultyApi.studentTimetable(
              selectedTimetableId || response.selected_timetable_id
                ? { timetable_id: Number(selectedTimetableId || response.selected_timetable_id) }
                : {}
            );
            if (!cancelled) {
              setStudentData(studentResponse);
            }
          } catch (studentError) {
            if (!cancelled) {
              setStudentData(null);
            }
          }
        } else if (!cancelled) {
          setStudentData(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Unable to load faculty data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedTimetableId, refreshTick]);

  const entries = data?.entries || [];
  const sections = useMemo(
    () => [...new Set(entries.map((entry) => entry.section_name).filter(Boolean))],
    [entries]
  );
  const filteredEntries = selectedSection
    ? entries.filter((entry) => entry.section_name === selectedSection)
    : entries;
  const stats = useMemo(() => summarizeTimetable(filteredEntries), [filteredEntries]);

  return {
    data,
    studentData,
    selectedTimetableId,
    setSelectedTimetableId,
    selectedSection,
    setSelectedSection,
    sections,
    filteredEntries,
    stats,
    loading,
    error,
    refresh: () => setRefreshTick((value) => value + 1),
  };
}

function WorkspaceHeader({ title, description, actions }) {
  return <SectionHeader eyebrow="Faculty workspace" title={title} description={description} actions={actions} />;
}

function FacultySummary({ data, profile }) {
  const theme = getRoleTheme("faculty");
  const entries = data?.entries || [];
  const uniqueSections = new Set(entries.map((entry) => entry.section_name).filter(Boolean)).size;
  const uniqueSubjects = new Set(entries.map((entry) => entry.subject_name).filter(Boolean)).size;
  const upcoming = entries.filter((entry) => Number(entry.day_of_week) >= new Date().getDay()).length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={CalendarRange} label="Classes assigned" value={entries.length} tone="faculty" />
      <StatCard icon={Users} label="Sections" value={uniqueSections} tone="success" />
      <StatCard icon={Sparkles} label="Subjects" value={uniqueSubjects} tone="info" />
      <StatCard icon={FileText} label="Upcoming slots" value={upcoming} tone="warning" />
    </div>
  );
}

function StudentTimetableSharePanel({ studentData }) {
  const [recipientEmails, setRecipientEmails] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleShare(event) {
    event.preventDefault();
    if (!studentData?.selected_timetable_id) return;
    setLoading(true);
    setStatus("");
    try {
      const payload = {
        timetable_id: Number(studentData.selected_timetable_id),
        section_id: studentData.selected_section_id ? Number(studentData.selected_section_id) : undefined,
        recipient_emails: recipientEmails
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        message,
      };
      await facultyApi.shareStudentTimetable(payload);
      setStatus("Student timetable shared successfully.");
    } catch (error) {
      setStatus(error.message || "Unable to share timetable");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!studentData?.selected_timetable_id) return;
    const response = await facultyApi.downloadStudentTimetable({
      timetable_id: Number(studentData.selected_timetable_id),
      section_id: studentData.selected_section_id ? Number(studentData.selected_section_id) : undefined,
    });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "student-timetable.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Student timetables</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-white">Share and download</h3>
        </div>
        <Badge tone="info">Mentor access</Badge>
      </div>

      {studentData?.timetable ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">
              {studentData.timetable.version_name}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Section: {studentData.sections?.find((section) => section.id === studentData.selected_section_id)?.name || "—"}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleShare}>
            <Input
              label="Recipient emails"
              placeholder="student1@example.com, student2@example.com"
              value={recipientEmails}
              onChange={(event) => setRecipientEmails(event.target.value)}
              hint="Comma-separated email addresses."
            />
            <Textarea
              label="Message"
              placeholder="Optional note for the class"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            {status ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                {status}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" className="flex-1" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                <Share2 className="h-4 w-4" />
                {loading ? "Sharing..." : "Share"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <EmptyState
          title="No student timetable available"
          description="If your account is a mentor, the API will expose student timetable sharing here."
        />
      )}
    </Card>
  );
}

function FacultyTimetableContent({ title, description, showShare = false }) {
  const { user } = useAuth();
  const { data, studentData, selectedTimetableId, setSelectedTimetableId, selectedSection, setSelectedSection, sections, filteredEntries, stats, loading, error, refresh } =
    useFacultyWorkspace();
  const profile = data?.faculty || user;
  const theme = getRoleTheme("faculty");

  const timetableOptions = data?.timetables || [];
  const availableSections = sections.length ? sections : studentData?.sections?.map((section) => section.name) || [];

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title={title}
        description={description}
        actions={[
          <Button key="refresh" variant="secondary" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>,
        ]}
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Switch timetable</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">
              {profile?.full_name || "Faculty member"}
            </h3>
          </div>
          <Select
            className="md:min-w-[320px]"
            value={selectedTimetableId}
            onChange={(event) => setSelectedTimetableId(event.target.value)}
          >
            {timetableOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.version_name} · {item.semester_number}/{item.academic_year}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error ? (
        <Card className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</Card>
      ) : null}

      <FacultySummary data={data} profile={profile} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Weekly schedule</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">{selectedSection || "All sections"}</h3>
            </div>
            <Badge tone="faculty">{formatNumber(filteredEntries.length)} sessions</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {availableSections.map((section) => (
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

          <div className="mt-5">
            <TimetableGrid
              entries={filteredEntries}
              timeSlots={data?.time_slots || []}
              title="My teaching schedule"
              subtitle="Focused on the selected section"
              compact
            />
          </div>
        </Card>

        <div className="space-y-6">
          <TimetableLegend entries={filteredEntries} />
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-white">Personal quick facts</h3>
              <Badge tone="success">Connected</Badge>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                Faculty ID: {profile?.faculty_id || "—"}
              </div>
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                Role: {toTitleCase(profile?.role || "faculty")}
              </div>
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
                Last refresh: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </Card>

          {showShare ? <StudentTimetableSharePanel studentData={studentData} /> : null}
        </div>
      </div>

      {!loading && !filteredEntries.length ? (
        <EmptyState
          title="No classes assigned"
          description="This timetable does not currently contain section sessions for the selected view."
        />
      ) : null}
    </div>
  );
}

export function FacultyDashboardPage() {
  return (
    <FacultyTimetableContent
      title="My dashboard"
      description="A friendly overview of your schedule, teaching load, and student timetable access."
      showShare
    />
  );
}

export function FacultyTimetablePage() {
  return (
    <FacultyTimetableContent
      title="My teaching schedule"
      description="Inspect your personal timetable with a section-by-section weekly grid."
      showShare={false}
    />
  );
}

export function FacultyStudentTimetablePage() {
  const { user } = useAuth();
  const theme = getRoleTheme("faculty");
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Student timetable"
        title="Section timetable sharing"
        description="Download and share section timetables with students or mentoring groups."
      />
      <FacultyTimetableContent
        title="Student timetable sharing"
        description="Pick a timetable version and distribute it to the right class group."
        showShare
      />
    </div>
  );
}
