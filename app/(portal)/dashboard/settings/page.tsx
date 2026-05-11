// app/(portal)/dashboard/settings/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { updateProfile, changePassword } from "@/app/actions/settings-actions";
import { Camera, CheckCircle2, AlertTriangle, Loader2, User, Lock, Shield } from "lucide-react";
import { useSession } from "next-auth/react";

type Tab = "profile" | "security";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [tab,        setTab]        = useState<Tab>("profile");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl,   setPhotoUrl]   = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null); // which form
  const [result,     setResult]     = useState<{ form: string; type: "success"|"error"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-fill photo URL from session/profile if available
  const user = session?.user as { name?: string; role?: string; memberNumber?: string } | undefined;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setResult({ form: "profile", type: "error", msg: "Image must be under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      setPhotoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting("profile"); setResult(null);
    const fd = new FormData(e.currentTarget);
    fd.set("profilePhotoUrl", photoUrl);
    try {
      await updateProfile(fd);
      setResult({ form: "profile", type: "success", msg: "Profile updated successfully." });
    } catch (err: unknown) {
      setResult({ form: "profile", type: "error", msg: err instanceof Error ? err.message : "An error occurred." });
    } finally { setSubmitting(null); }
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting("password"); setResult(null);
    try {
      await changePassword(new FormData(e.currentTarget));
      setResult({ form: "password", type: "success", msg: "Password changed. Sign in with your new password next time." });
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setResult({ form: "password", type: "error", msg: err instanceof Error ? err.message : "An error occurred." });
    } finally { setSubmitting(null); }
  }

  const inputCls = "w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all";
  const labelCls = "text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider";

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">Settings</h1>
        <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">Manage your account and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-fit">
        {([
          { id: "profile",  label: "Profile",  icon: <User size={13}/> },
          { id: "security", label: "Security", icon: <Lock size={13}/> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all
              ${tab === t.id
                ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ──────────────────────────────────────────────── */}
      {tab === "profile" && (
        <form onSubmit={handleProfile} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 flex items-center gap-2">
            <User size={15} className="text-stone-400"/>
            <span className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">Profile Information</span>
          </div>

          <div className="p-6 space-y-5">
            {result?.form === "profile" && (
              <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${result.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400"}`}>
                {result.type === "success" ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0"/> : <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/>}
                {result.msg}
              </div>
            )}

            {/* Profile picture */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center overflow-hidden border-2 border-stone-200 dark:border-stone-600">
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover"/>
                    : <span className="text-white text-2xl font-black">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>}
                </div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand border-2 border-white dark:border-stone-900 flex items-center justify-center hover:bg-brand-dark transition-colors">
                  <Camera size={12} className="text-white"/>
                </button>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Profile Photo</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">JPG or PNG · Max 2MB</p>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-xs font-bold text-brand hover:underline mt-1">
                  Choose photo
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange}/>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>First Name *</label>
                <input name="firstName" required placeholder="First name" className={inputCls} defaultValue={user?.name?.split(" ")[0]}/>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Last Name *</label>
                <input name="lastName" required placeholder="Last name" className={inputCls} defaultValue={user?.name?.split(" ").slice(-1)[0]}/>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>M-Pesa Phone *</label>
                <input name="phone" required placeholder="07XX XXX XXX" className={inputCls}/>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Occupation</label>
                <input name="occupation" placeholder="e.g. Farmer, Trader" className={inputCls}/>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className={labelCls}>Sub-Location / Village</label>
                <input name="subLocation" placeholder="e.g. Muirungi Village" className={inputCls}/>
              </div>
            </div>

            {/* Member info (read-only) */}
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} className="text-stone-400"/>
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Read-Only Info</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-stone-400 dark:text-stone-500">Member Number</p><p className="font-bold text-stone-700 dark:text-stone-300 font-mono mt-0.5">{user?.memberNumber ?? "—"}</p></div>
                <div><p className="text-stone-400 dark:text-stone-500">Role</p><p className="font-bold text-stone-700 dark:text-stone-300 mt-0.5">{user?.role?.replace(/_/g," ") ?? "Member"}</p></div>
              </div>
            </div>

            <button type="submit" disabled={submitting === "profile"}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-bold py-3 rounded-lg transition-colors text-sm">
              {submitting === "profile" ? <><Loader2 size={15} className="animate-spin"/>Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ── Security Tab ─────────────────────────────────────────────── */}
      {tab === "security" && (
        <form onSubmit={handlePassword} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 flex items-center gap-2">
            <Lock size={15} className="text-stone-400"/>
            <span className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">Change Password</span>
          </div>
          <div className="p-6 space-y-4">
            {result?.form === "password" && (
              <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${result.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400"}`}>
                {result.type === "success" ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0"/> : <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/>}
                {result.msg}
              </div>
            )}
            {[
              { name: "currentPassword", label: "Current Password",  placeholder: "••••••••" },
              { name: "newPassword",     label: "New Password",      placeholder: "Min 8 characters" },
              { name: "confirmPassword", label: "Confirm Password",  placeholder: "Re-enter new password" },
            ].map(({ name, label, placeholder }) => (
              <div key={name} className="space-y-1.5">
                <label className={labelCls}>{label}</label>
                <input type="password" name={name} required minLength={name !== "currentPassword" ? 8 : 1}
                  placeholder={placeholder} className={inputCls}/>
              </div>
            ))}
            <button type="submit" disabled={submitting === "password"}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-bold py-3 rounded-lg transition-colors text-sm">
              {submitting === "password" ? <><Loader2 size={15} className="animate-spin"/>Updating...</> : "Change Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}