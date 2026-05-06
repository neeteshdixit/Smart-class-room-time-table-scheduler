import React, { useEffect, useState } from "react";
import { LogOut, Save, Upload, UserRound } from "lucide-react";
import { profileApi } from "../lib/api";
import { formatDate, formatDateTime, initials, toTitleCase } from "../lib/format";
import { getRoleTheme } from "../lib/theme";
import { Badge, Button, Card, Input, SectionHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const EDITABLE_FIELDS = [
  { name: "full_name", label: "Full name", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "mobile_number", label: "Mobile number", type: "text" },
  { name: "department", label: "Department", type: "text" },
  { name: "designation", label: "Designation", type: "text" },
  { name: "qualification", label: "Qualification", type: "text" },
  { name: "gender", label: "Gender", type: "text" },
  { name: "dob", label: "Date of birth", type: "date" },
  { name: "experience_years", label: "Experience years", type: "number", step: "0.1" },
  { name: "joining_date", label: "Joining date", type: "date" },
  { name: "employee_type", label: "Employee type", type: "text" },
  { name: "office_location", label: "Office location", type: "text" },
  { name: "profile_photo_url", label: "Profile photo URL", type: "text" },
];

function toForm(profile) {
  const form = {};
  EDITABLE_FIELDS.forEach((field) => {
    form[field.name] = profile?.[field.name] ?? "";
  });
  return form;
}

export function ProfilePage() {
  const { user, role, updateProfile, logout } = useAuth();
  const [profile, setProfile] = useState(user || null);
  const [form, setForm] = useState(() => toForm(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const theme = getRoleTheme(role || user?.role || "student");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await profileApi.get();
        if (cancelled) return;
        const nextProfile = response.profile || user || null;
        setProfile(nextProfile);
        setForm(toForm(nextProfile));
      } catch (loadError) {
        if (!cancelled) {
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

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {};
      EDITABLE_FIELDS.forEach((field) => {
        const value = form[field.name];
        if (field.type === "number") {
          payload[field.name] = value === "" ? null : Number(value);
        } else if (String(value || "").trim() !== "") {
          payload[field.name] = value;
        }
      });
      const response = await updateProfile(payload);
      const nextProfile = response.profile || response.data?.profile || profile;
      setProfile(nextProfile);
      setMessage("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

  const activeRoleLabel = toTitleCase(profile?.role || role || "student");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Profile"
        title="Account details"
        description="Update your public-facing details, contact information, and profile photo."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Identity</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                {profile?.full_name || "Your profile"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{profile?.email || user?.email || "—"}</p>
            </div>
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-soft"
              style={{ background: theme.heroGradient }}
            >
              <span className="font-display text-lg font-semibold">
                {initials(profile?.full_name || user?.full_name || "SC")}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Role: {activeRoleLabel}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Faculty ID: {profile?.faculty_id || "—"}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Last login: {formatDateTime(profile?.last_login)}</div>
            <div className="rounded-2xl bg-white/[0.03] px-4 py-3">Joined: {formatDate(profile?.joining_date)}</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="info">JWT secured</Badge>
            <Badge tone="success">Refresh token</Badge>
            <Badge tone="warning">Role aware</Badge>
          </div>

          <div className="mt-6 space-y-3">
            <Button type="button" variant="secondary" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <UserRound className="h-4 w-4" />
              Back to top
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Edit profile</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Update contact details</h3>
            </div>
            <Badge tone="neutral">{loading ? "Loading" : "Ready"}</Badge>
          </div>

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            {EDITABLE_FIELDS.map((field) => {
              if (field.name === "profile_photo_url") {
                return (
                  <Input
                    key={field.name}
                    label={field.label}
                    type={field.type}
                    value={form[field.name] || ""}
                    onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                    placeholder="https://..."
                  />
                );
              }

              return (
                <Input
                  key={field.name}
                  label={field.label}
                  type={field.type}
                  step={field.step}
                  value={form[field.name] || ""}
                  onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              );
            })}

            <div className="md:col-span-2">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {message}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save profile"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setForm(toForm(profile || user))}
              >
                <Upload className="h-4 w-4" />
                Reset form
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
