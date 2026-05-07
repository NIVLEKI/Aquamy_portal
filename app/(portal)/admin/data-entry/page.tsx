// app/(portal)/admin/data-entry/page.tsx
"use client";

import { useState, useEffect } from "react";
import { recordContribution, getActiveMembers, getFeeSchedule } from "../../../actions/finance-actions";
import { PlusCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Member = { id: string; name: string; firstName: string; lastName: string; memberNumber: string };
type FeeSchedule = { REGISTRATION_FEE: number; MAINTENANCE_FEE: number; MONTHLY: number; LATE_PENALTY: number; ARREAR_PAYMENT: number };

const CONTRIBUTION_TYPES = [
  { value: "MONTHLY",          label: "Monthly Contribution",  needsPeriod: true,  needsArrears: false },
  { value: "ARREAR_PAYMENT",   label: "Arrear Payment",        needsPeriod: true,  needsArrears: true  },
  { value: "REGISTRATION_FEE", label: "Registration Fee",      needsPeriod: false, needsArrears: false },
  { value: "MAINTENANCE_FEE",  label: "Maintenance Fee",       needsPeriod: false, needsArrears: false },
  { value: "LATE_PENALTY",     label: "Late Penalty",          needsPeriod: false, needsArrears: false },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function DataEntryHub() {
  const [members,     setMembers]     = useState<Member[]>([]);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState("MONTHLY");
  const [amount,       setAmount]       = useState("");

  const currentType = CONTRIBUTION_TYPES.find(t => t.value === selectedType)!;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Load members + fee schedule on mount ───────────────────────────────────
  useEffect(() => {
    Promise.all([getActiveMembers(), getFeeSchedule()])
      .then(([m, f]) => { setMembers(m); setFeeSchedule(f); })
      .finally(() => setLoading(false));
  }, []);

  // ── Auto-fill amount when type changes ────────────────────────────────────
  useEffect(() => {
    if (feeSchedule) {
      setAmount(String(feeSchedule[selectedType as keyof FeeSchedule] ?? ""));
    }
  }, [selectedType, feeSchedule]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      await recordContribution(formData);
      const member = members.find(m => m.id === formData.get("userId"));
      const name   = member?.firstName || member?.name || "Member";
      setSuccess(`✓ ${selectedType.replace(/_/g, " ")} recorded for ${name}`);
      (e.target as HTMLFormElement).reset();
      setSelectedType("MONTHLY");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">Loading members...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Data Entry Hub</h1>
        <p className="text-stone-500 text-sm mt-1">
          Record historical and current contributions for any member.
        </p>
      </div>

      {/* Success / Error banners */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-4 text-sm font-medium">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">

        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <PlusCircle size={16} className="text-stone-400" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">Record a Contribution</span>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Member */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Select Member <span className="text-red-500">*</span>
            </label>
            <select name="userId" required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all">
              <option value="">— Choose Member —</option>
              {members.map(m => {
                const displayName = m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
                return <option key={m.id} value={m.id}>{displayName} ({m.memberNumber})</option>;
              })}
            </select>
            {members.length === 0 && (
              <p className="text-[10px] text-amber-600">No active members found. Approve members first.</p>
            )}
          </div>

          {/* Contribution Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Type <span className="text-red-500">*</span>
            </label>
            <select name="type" required value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all">
              {CONTRIBUTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Amount — auto-filled but editable */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-semibold">KES</span>
              <input type="number" name="amount" required min="1" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-12 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
                placeholder="500" />
            </div>
            {feeSchedule && (
              <p className="text-[10px] text-stone-400">
                Constitutional amount: KES {feeSchedule[selectedType as keyof FeeSchedule]?.toLocaleString() ?? "—"}
              </p>
            )}
          </div>

          {/* Period fields — only for MONTHLY and ARREAR_PAYMENT */}
          {currentType.needsPeriod && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Month <span className="text-red-500">*</span>
                </label>
                <select name="periodMonth" required
                  defaultValue={new Date().getMonth() + 1}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all">
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Year <span className="text-red-500">*</span>
                </label>
                <select name="periodYear" required defaultValue={currentYear}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Arrears months — only for ARREAR_PAYMENT */}
          {currentType.needsArrears && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Months in Arrears
              </label>
              <input type="number" name="arrearsMonths" min="0" max="24" defaultValue="1"
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all" />
              <p className="text-[10px] text-stone-400">KES 100 late penalty will be calculated per arrear month.</p>
            </div>
          )}

          {/* Date paid */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Date Paid <span className="text-red-500">*</span>
            </label>
            <input type="date" name="paidAt" required
              defaultValue={new Date().toISOString().split("T")[0]}
              max={new Date().toISOString().split("T")[0]}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-500 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all" />
          </div>

          {/* M-Pesa receipt */}
          <div className={currentType.needsPeriod ? "sm:col-span-2" : ""}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                M-Pesa Receipt / Reference <span className="text-stone-300">(Optional)</span>
              </label>
              <input type="text" name="mpesaReceiptId"
                placeholder="e.g. QWE123RTY4"
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all" />
            </div>
          </div>

          {/* Submit */}
          <div className="sm:col-span-2 pt-2">
            <button type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : <><PlusCircle size={16} /> Save Record</>}
            </button>
          </div>
        </div>
      </form>

      {/* Constitution reference */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Constitutional Fee Schedule</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {feeSchedule && [
            ["Registration",  feeSchedule.REGISTRATION_FEE, "One-time"],
            ["Maintenance",   feeSchedule.MAINTENANCE_FEE,  "One-time"],
            ["Monthly",       feeSchedule.MONTHLY,           "Recurring"],
            ["Late Penalty",  feeSchedule.LATE_PENALTY,      "Per month"],
          ].map(([label, amount, freq]) => (
            <div key={String(label)} className="bg-white border border-stone-100 rounded-lg p-3">
              <p className="text-xs font-bold text-stone-700">KES {Number(amount).toLocaleString()}</p>
              <p className="text-[10px] text-stone-400">{label}</p>
              <p className="text-[9px] text-stone-300 mt-0.5">{freq}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}