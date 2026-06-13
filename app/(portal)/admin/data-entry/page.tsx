// app/(portal)/admin/data-entry/page.tsx
// v2 — adds Joining Date override + Schedule Meeting sections
"use client";

import { useState, useEffect } from "react";
import {
  recordContribution,
  getActiveMembers,
  getFeeSchedule,
} from "@/app/actions/finance-actions";
import { adminUpdateMember } from "@/app/actions/settings-actions";
import { scheduleMeeting }   from "@/app/actions/meeting-actions";
import {
  PlusCircle, CheckCircle2, AlertTriangle,
  Loader2, CalendarDays, UserCog,
} from "lucide-react";

type Member       = { id: string; name: string; firstName: string; lastName: string; memberNumber: string; createdAt?: string };
type FeeSchedule  = { REGISTRATION_FEE: number; MAINTENANCE_FEE: number; MONTHLY: number; LATE_PENALTY: number; ARREAR_PAYMENT: number };
type Section      = "contribution" | "joining" | "meeting";

const CONTRIBUTION_TYPES = [
  { value: "MONTHLY",          label: "Monthly Contribution",  needsPeriod: true,  needsArrears: false },
  { value: "ARREAR_PAYMENT",   label: "Arrear Payment",        needsPeriod: true,  needsArrears: true  },
  { value: "REGISTRATION_FEE", label: "Registration Fee",      needsPeriod: false, needsArrears: false },
  { value: "MAINTENANCE_FEE",  label: "Maintenance Fee",       needsPeriod: false, needsArrears: false },
  { value: "LATE_PENALTY",     label: "Late Penalty",          needsPeriod: false, needsArrears: false },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MEETING_TYPES = ["ORDINARY","AGM","SPECIAL","CREDIT_COMMITTEE"];

const inputCls = "w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all";
const labelCls = "text-[10px] font-bold text-stone-400 uppercase tracking-wider";

export default function DataEntryHub() {
  const [members,     setMembers]     = useState<Member[]>([]);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeSection, setSection]  = useState<Section>("contribution");

  // Per-form state
  const [selectedType, setSelectedType] = useState("MONTHLY");
  const [amount,       setAmount]       = useState("500");
  const [submitting,   setSubmitting]   = useState<string | null>(null);
  const [result,       setResult]       = useState<{ form: string; type: "success"|"error"; msg: string } | null>(null);

  const currentType = CONTRIBUTION_TYPES.find(t => t.value === selectedType)!;
  const currentYear = new Date().getFullYear();
  const years       = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    Promise.all([getActiveMembers(), getFeeSchedule()])
      .then(([m, f]) => { setMembers(m); setFeeSchedule(f); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (feeSchedule) setAmount(String(feeSchedule[selectedType as keyof FeeSchedule] ?? ""));
  }, [selectedType, feeSchedule]);

  function memberDisplayName(m: Member) {
    return m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
  }

  // ── Submit handlers ────────────────────────────────────────────────────────

  async function handleContribution(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting("contribution"); setResult(null);
    try {
      await recordContribution(new FormData(e.currentTarget));
      const fd = new FormData(e.currentTarget);
      const m  = members.find(x => x.id === fd.get("userId"));
      setResult({ form: "contribution", type: "success", msg: `✓ ${selectedType.replace(/_/g," ")} recorded${m ? ` for ${memberDisplayName(m)}` : ""}.` });
      (e.target as HTMLFormElement).reset();
      setSelectedType("MONTHLY");
    } catch (err: unknown) {
      setResult({ form: "contribution", type: "error", msg: err instanceof Error ? err.message : "An error occurred." });
    } finally { setSubmitting(null); }
  }

  async function handleJoiningDate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting("joining"); setResult(null);
    const fd = new FormData(e.currentTarget);
    // Reuse adminUpdateMember — it handles createdAt override + audit log
    try {
      await adminUpdateMember(fd);
      const m = members.find(x => x.id === fd.get("userId"));
      setResult({ form: "joining", type: "success", msg: `✓ Joining date updated for ${m ? memberDisplayName(m) : "member"}.` });
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setResult({ form: "joining", type: "error", msg: err instanceof Error ? err.message : "An error occurred." });
    } finally { setSubmitting(null); }
  }

  async function handleMeeting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting("meeting"); setResult(null);
    try {
      await scheduleMeeting(new FormData(e.currentTarget));
      setResult({ form: "meeting", type: "success", msg: "✓ Meeting scheduled successfully." });
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setResult({ form: "meeting", type: "error", msg: err instanceof Error ? err.message : "An error occurred." });
    } finally { setSubmitting(null); }
  }

  function Feedback({ form }: { form: string }) {
    if (result?.form !== form) return null;
    return (
      <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm
        ${result.type === "success"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"}`}>
        {result.type === "success"
          ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
        {result.msg}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <Loader2 size={22} className="animate-spin mr-2" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "contribution", label: "Record Contribution", icon: <PlusCircle size={14} />   },
    { id: "joining",      label: "Update Joining Date", icon: <UserCog size={14} />       },
    { id: "meeting",      label: "Schedule Meeting",    icon: <CalendarDays size={14} />  },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Data Entry Hub</h1>
        <p className="text-stone-500 text-sm mt-1">
          Record contributions, update member dates, and schedule meetings.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setSection(t.id); setResult(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center
              ${activeSection === t.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── SECTION 1: Record Contribution ─────────────────────────────────── */}
      {activeSection === "contribution" && (
        <form onSubmit={handleContribution} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
            <PlusCircle size={15} className="text-stone-400" />
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">Record a Contribution</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Feedback form="contribution" />

            <div className="sm:col-span-2 space-y-1.5">
              <label className={labelCls}>Member *</label>
              <select name="userId" required className={inputCls}>
                <option value="">— Choose Member —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {memberDisplayName(m)} ({m.memberNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Type *</label>
              <select name="type" required value={selectedType}
                onChange={e => setSelectedType(e.target.value)} className={inputCls}>
                {CONTRIBUTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Amount (KES) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-semibold">KES</span>
                <input type="number" name="amount" required min="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={`${inputCls} pl-12`} />
              </div>
              {feeSchedule && (
                <p className="text-[10px] text-stone-400">
                  Constitutional: KES {feeSchedule[selectedType as keyof FeeSchedule]?.toLocaleString() ?? "—"}
                </p>
              )}
            </div>

            {currentType.needsPeriod && (
              <>
                <div className="space-y-1.5">
                  <label className={labelCls}>Month *</label>
                  <select name="periodMonth" required defaultValue={new Date().getMonth() + 1} className={inputCls}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Year *</label>
                  <select name="periodYear" required defaultValue={currentYear} className={inputCls}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </>
            )}

            {currentType.needsArrears && (
              <div className="space-y-1.5">
                <label className={labelCls}>Months in Arrears</label>
                <input type="number" name="arrearsMonths" min="0" max="24" defaultValue="1" className={inputCls} />
                <p className="text-[10px] text-stone-400">KES 100 late penalty per arrear month.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={labelCls}>Date Paid *</label>
              <input type="date" name="paidAt" required
                defaultValue={new Date().toISOString().split("T")[0]}
                max={new Date().toISOString().split("T")[0]}
                className={inputCls} />
            </div>

            <div className={currentType.needsPeriod ? "" : "sm:col-span-2"}>
              <div className="space-y-1.5">
                <label className={labelCls}>M-Pesa Receipt (Optional)</label>
                <input type="text" name="mpesaReceiptId" placeholder="e.g. QWE123RTY4"
                  className={`${inputCls} uppercase`} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting === "contribution"}
                className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
                {submitting === "contribution"
                  ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                  : <><PlusCircle size={15} /> Save Record</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── SECTION 2: Update Joining Date ─────────────────────────────────── */}
      {activeSection === "joining" && (
        <form onSubmit={handleJoiningDate} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
            <UserCog size={15} className="text-stone-400" />
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">
              Override Member Joining Date
            </span>
          </div>
          <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 leading-relaxed">
              <strong>For existing members only.</strong> Use this to correct the joining date for
              members who were part of the Chama before this portal existed.
              This overrides the system registration date and affects financial period calculations.
              All changes are logged in the audit trail.
            </div>

            <Feedback form="joining" />

            <div className="space-y-1.5">
              <label className={labelCls}>Select Member *</label>
              <select name="userId" required className={inputCls}>
                <option value="">— Choose Member —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {memberDisplayName(m)} ({m.memberNumber})
                    {m.createdAt && ` — currently ${new Date(m.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Actual Joining Date *</label>
              <input type="date" name="joinedAt" required
                max={new Date().toISOString().split("T")[0]}
                className={inputCls} />
              <p className="text-[10px] text-stone-400">
                Enter the date the member physically joined the group — can be any past date.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Reason for Override *</label>
              <input type="text" name="overrideReason" required
                placeholder="e.g. Member joined Chama in 2021, registered on portal in 2025"
                className={inputCls} />
            </div>

            <button type="submit" disabled={submitting === "joining"}
              className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
              {submitting === "joining"
                ? <><Loader2 size={15} className="animate-spin" /> Updating...</>
                : <><UserCog size={15} /> Update Joining Date</>}
            </button>
          </div>
        </form>
      )}

      {/* ── SECTION 3: Schedule Meeting ─────────────────────────────────────── */}
      {activeSection === "meeting" && (
        <form onSubmit={handleMeeting} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
            <CalendarDays size={15} className="text-stone-400" />
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">Schedule a Meeting</span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Feedback form="meeting" />

            <div className="sm:col-span-2 space-y-1.5">
              <label className={labelCls}>Meeting Title *</label>
              <input type="text" name="title" required
                placeholder="e.g. AQUAMY Monthly Meeting — June 2025"
                className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Meeting Type *</label>
              <select name="type" required className={inputCls}>
                {MEETING_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Date & Time *</label>
              <input type="datetime-local" name="date" required
                min={new Date().toISOString().slice(0, 16)}
                className={inputCls} />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className={labelCls}>Venue *</label>
              <input type="text" name="venue" required
                placeholder="e.g. Muirungi Community Hall"
                className={inputCls} />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className={labelCls}>Agenda (Optional)</label>
              <textarea name="agenda" rows={3}
                placeholder="1. Opening prayer&#10;2. Approval of previous minutes&#10;3. Treasurer's report"
                className={`${inputCls} resize-none`} />
            </div>

            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting === "meeting"}
                className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
                {submitting === "meeting"
                  ? <><Loader2 size={15} className="animate-spin" /> Scheduling...</>
                  : <><CalendarDays size={15} /> Schedule Meeting</>}
              </button>
              <p className="text-[10px] text-stone-400 text-center mt-2">
                All active members will receive a notification when the meeting is scheduled.
              </p>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}