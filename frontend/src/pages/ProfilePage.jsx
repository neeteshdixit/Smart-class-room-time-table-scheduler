import React, { useEffect, useState, useRef } from "react";
import { LogOut, Save, Upload, UserRound, ShieldAlert, Trash2, Camera, Loader2, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { profileApi, apiBaseUrl } from "../lib/api";
import { formatDate, formatDateTime, initials, toTitleCase } from "../lib/format";
import { getRoleTheme } from "../lib/theme";
import { Badge, Button, Card, Input, SectionHeader, Modal, OtpInputs, Select } from "../components/ui";
import { SmartSelect } from "../components/SmartSelect";
import { useAuth } from "../context/AuthContext";

const FACULTY_FIELDS = [
  { name: "full_name", label: "Full name", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "mobile_number", label: "Mobile number", type: "text" },
  { name: "department", label: "Department", type: "smart-select", resource: "departments" },
  { name: "designation", label: "Designation", type: "text" },
  { name: "qualification", label: "Qualification", type: "text" },
  { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
  { name: "dob", label: "Date of birth", type: "date" },
  { name: "experience_years", label: "Experience years", type: "number", step: "0.1" },
  { name: "joining_date", label: "Joining date", type: "date" },
  { name: "employee_type", label: "Employee type", type: "select", options: ["Full-time", "Part-time", "Contract", "Guest"] },
  { name: "office_location", label: "Office location", type: "text" },
];

const STUDENT_FIELDS = [
  { name: "full_name", label: "Full name", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "student_id", label: "Student ID", type: "text", disabled: true },
  { name: "section_id", label: "Section", type: "smart-select", resource: "sections" },
];

function getFieldsForRole(role) {
  const normalized = String(role || "student").trim().toLowerCase();
  if (normalized === "student" || normalized === "user") return STUDENT_FIELDS;
  return FACULTY_FIELDS;
}

function toForm(profile, role) {
  const fields = getFieldsForRole(role);
  const form = {};
  fields.forEach((field) => {
    form[field.name] = profile?.[field.name] ?? "";
  });
  return form;
}

export function ProfilePage() {
  const { user, role, updateProfile, updateProfilePhoto, initiateAccountDelete, confirmAccountDelete, logout } = useAuth();
  const activeRole = role || user?.role || "student";
  const fields = getFieldsForRole(activeRole);
  const [profile, setProfile] = useState(user || null);
  const [form, setForm] = useState(() => toForm(user, activeRole));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, step: "auth", password: "", otp: "" });
  const fileInputRef = useRef(null);
  
  const theme = getRoleTheme(activeRole);
  const isAdmin = activeRole.toLowerCase() === "admin";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await profileApi.get();
        if (cancelled) return;
        const nextProfile = response.profile || user || null;
        setProfile(nextProfile);
        setForm(toForm(nextProfile, activeRole));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Unable to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, activeRole]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {};
      fields.forEach((field) => {
        if (field.disabled) return;
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

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await updateProfilePhoto(file);
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteInitiate() {
    setError("");
    setSaving(true);
    try {
      await initiateAccountDelete(deleteModal.password);
      setDeleteModal(prev => ({ ...prev, step: "otp" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    setError("");
    setSaving(true);
    try {
      await confirmAccountDelete(deleteModal.otp);
      // Success will auto-logout
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const activeRoleLabel = toTitleCase(profile?.role || role || "student");
  const photoUrl = profile?.profile_photo_url 
    ? (profile.profile_photo_url.startsWith('http') ? profile.profile_photo_url : `${apiBaseUrl()}${profile.profile_photo_url}`)
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Profile"
        title="Account details"
        description="Update your public-facing details, contact information, and profile photo."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card className="p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
               <Badge tone={isAdmin ? "danger" : "info"}>{activeRoleLabel}</Badge>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="h-32 w-32 rounded-[2.5rem] overflow-hidden bg-slate-800 ring-4 ring-white/5 shadow-2xl transition group-hover:scale-105">
                  {photoUrl ? (
                    <img src={photoUrl} alt={profile?.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                      <span className="text-4xl font-display font-bold text-white/50">{initials(profile?.full_name)}</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem]">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-[2.5rem]">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
              </div>

              <h3 className="mt-6 font-display text-2xl font-bold text-white">{profile?.full_name || "Your profile"}</h3>
              <p className="text-slate-400 font-medium">{profile?.email || "—"}</p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{activeRole === 'student' ? 'Student ID' : 'Faculty ID'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-200">{profile?.student_id || profile?.faculty_id || "—"}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Joined</p>
                <p className="mt-1 text-sm font-semibold text-slate-200">{formatDate(profile?.joining_date)}</p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Button variant="secondary" className="w-full justify-start px-6" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
              {isAdmin && (
                <Button variant="danger" className="w-full justify-start px-6" onClick={() => setDeleteModal({ ...deleteModal, open: true })}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-6">
             <h4 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                Security Information
             </h4>
             <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                   <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                   <div>
                      <p className="text-sm font-semibold text-slate-200">OTP Enabled</p>
                      <p className="text-xs text-slate-500 mt-0.5">Two-factor authentication is active for your account.</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                   <div>
                      <p className="text-sm font-semibold text-slate-200">Session Secure</p>
                      <p className="text-xs text-slate-500 mt-0.5">Your current session is encrypted and uses refresh tokens.</p>
                   </div>
                </div>
             </div>
          </Card>
        </div>

        <Card className="p-6 relative">
          <SectionHeader
            eyebrow="Settings"
            title="Update Profile"
            description="Keep your academic and contact information up to date."
            className="mb-8"
          />

          <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            {fields.map((field) => {
              if (field.type === "smart-select") {
                return (
                  <SmartSelect
                    key={field.name}
                    label={field.label}
                    resource={field.resource}
                    value={form[field.name]}
                    onChange={(val) => setForm((current) => ({ ...current, [field.name]: val }))}
                    accent={isAdmin ? "#ef4444" : "#3b82f6"}
                  />
                );
              }
              if (field.type === "select") {
                return (
                  <Select
                    key={field.name}
                    label={field.label}
                    value={form[field.name]}
                    onChange={(e) => setForm((current) => ({ ...current, [field.name]: e.target.value }))}
                    accent={isAdmin ? "#ef4444" : "#3b82f6"}
                  >
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                );
              }
              return (
                <Input
                  key={field.name}
                  label={field.label}
                  type={field.type}
                  step={field.step}
                  disabled={field.disabled}
                  value={form[field.name] || ""}
                  onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                  accent={isAdmin ? "#ef4444" : "#3b82f6"}
                />
              );
            })}

            <div className="md:col-span-2 pt-4">
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </motion.div>
                )}
                {message && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="flex-1 h-12 shadow-lg" disabled={saving || uploading} accent={isAdmin ? "#ef4444" : "#3b82f6"}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {saving ? "Saving Changes..." : "Update Profile"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>

      {/* Delete Account Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => !saving && setDeleteModal({ open: false, step: "auth", password: "", otp: "" })}
        title="Secure Account Deletion"
        description="This action is permanent and cannot be undone. All your data will be wiped."
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, step: "auth", password: "", otp: "" })} disabled={saving}>
              Cancel
            </Button>
            {deleteModal.step === "auth" ? (
              <Button variant="danger" onClick={handleDeleteInitiate} disabled={saving || !deleteModal.password}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Confirm Identity
              </Button>
            ) : (
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={saving || deleteModal.otp.length < 6}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Permanently Delete
              </Button>
            )}
          </>
        }
      >
        <div className="mt-4">
           {deleteModal.step === "auth" ? (
             <div className="space-y-4">
                <p className="text-sm text-slate-300">To proceed, please enter your current password for <span className="font-bold text-white">{profile?.email}</span>.</p>
                <Input
                  label="Password"
                  type="password"
                  placeholder="Your account password"
                  autoFocus
                  value={deleteModal.password}
                  onChange={(e) => setDeleteModal({ ...deleteModal, password: e.target.value })}
                  accent="#ef4444"
                />
             </div>
           ) : (
             <div className="space-y-6 text-center">
                <div className="mx-auto h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center">
                   <KeyRound className="h-8 w-8 text-red-400" />
                </div>
                <div>
                   <p className="text-sm font-semibold text-white">Enter Verification Code</p>
                   <p className="text-xs text-slate-400 mt-1">We've sent a 6-digit OTP to your email.</p>
                </div>
                <OtpInputs value={deleteModal.otp} onChange={(val) => setDeleteModal({ ...deleteModal, otp: val })} autoFocus accent="#ef4444" />
             </div>
           )}
        </div>
      </Modal>
    </div>
  );
}
