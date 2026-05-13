// app/(portal)/dashboard/loans/guarantor-requests/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  getPendingGuarantorRequests,
  acceptGuarantorRequest,
  declineGuarantorRequest,
} from "@/app/actions/guarantor-actions";
import {
  ShieldCheck, ShieldX, AlertTriangle, Loader2,
  CheckCircle2, ChevronDown, ChevronUp, User, Clock,
} from "lucide-react";

type GuarantorRequest = Awaited<ReturnType<typeof getPendingGuarantorRequests>>[number];

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default function GuarantorRequestsPage() {
  const [requests,   setRequests]   = useState<GuarantorRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [acting,     setActing]     = useState<string | null>(null);  // id of row being acted on
  const [declineId,  setDeclineId]  = useState<string | null>(null);  // id showing decline form
  const [reason,     setReason]     = useState("");
  const [feedback,   setFeedback]   = useState<{ id: string; type: "success" | "error"; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getPendingGuarantorRequests();
      setRequests(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAccept(id: string) {
    setActing(id); setFeedback(null);
    try {
      await acceptGuarantorRequest(id);
      setFeedback({ id, type: "success", msg: "You have accepted. The loan will proceed once all guarantors respond." });
      await load();
    } catch (err: unknown) {
      setFeedback({ id, type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(null); }
  }

  async function handleDecline(id: string) {
    if (!reason.trim()) { setFeedback({ id, type: "error", msg: "Please provide a reason for declining." }); return; }
    setActing(id); setFeedback(null);
    try {
      await declineGuarantorRequest(id, reason);
      setFeedback({ id, type: "success", msg: "You have declined. The applicant has been notified." });
      setDeclineId(null);
      setReason("");
      await load();
    } catch (err: unknown) {
      setFeedback({ id, type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 dark:text-stone-500">
        <Loader2 size={22} className="animate-spin mr-2" />
        <span className="text-sm">Loading requests...</span>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
          Guarantor Requests
        </h1>
        <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
          Members who applied for a loan have listed you as a guarantor.
          Review each request carefully before accepting.
        </p>
      </div>

      {/* Liability notice — always visible */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Read before accepting
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            By accepting, you acknowledge that <strong>if the loan applicant misses payments
            or defaults</strong>, you are personally liable for the outstanding balance,
            late penalties (KES 100/month), and any accrued fines on their behalf.
            This is a binding commitment per the AQUAMY constitution.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {requests.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-black text-stone-800 dark:text-stone-200">All clear</h2>
          <p className="text-stone-400 dark:text-stone-500 text-sm mt-1">
            You have no pending guarantor requests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const loan       = req.loan;
            const applicant  = loan.user;
            const isExpanded = expanded === req.id;
            const isDeclining = declineId === req.id;
            const isActing   = acting === req.id;
            const fb         = feedback?.id === req.id ? feedback : null;

            const applicantName = applicant.firstName
              ? `${applicant.firstName} ${applicant.lastName}`
              : applicant.name;

            const initials = (
              (applicant.firstName?.[0] ?? applicant.name[0]) +
              (applicant.lastName?.[0]  ?? "")
            ).toUpperCase();

            return (
              <div key={req.id}
                className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">

                {/* Summary row */}
                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Applicant avatar */}
                    <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-200">{applicantName}</p>
                      <p className="text-[10px] font-mono text-stone-400 dark:text-stone-500 mt-0.5">
                        {applicant.memberNumber} · {applicant.phone}
                      </p>
                    </div>
                  </div>

                  {/* Loan amount + expand toggle */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-stone-900 dark:text-stone-100">
                        {kes(loan.principal)}
                      </p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500">
                        {loan.termMonths} months
                      </p>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : req.id)}
                      className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded loan details */}
                {isExpanded && (
                  <div className="px-6 pb-5 border-t border-stone-100 dark:border-stone-700 pt-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      {[
                        { label: "Principal",        value: kes(loan.principal) },
                        { label: "Interest Rate",    value: `${loan.interestRate}% p.a.` },
                        { label: "Total Repayable",  value: kes(loan.totalRepayable) },
                        { label: "Monthly Inst.",    value: kes(loan.monthlyInstalment) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-stone-400 dark:text-stone-500 font-medium">{label}</p>
                          <p className="font-bold text-stone-800 dark:text-stone-200 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Loan purpose */}
                    <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">
                        Stated Purpose
                      </p>
                      <p className="text-sm text-stone-700 dark:text-stone-300">
                        {loan.purpose || "No purpose stated."}
                      </p>
                    </div>

                    {/* Liability reminder */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-3">
                      <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                        <strong>Your liability if you accept:</strong> If {applicantName.split(" ")[0]} misses
                        payments, you will be required to cover their outstanding balance of up to{" "}
                        <strong>{kes(loan.totalRepayable)}</strong>, plus KES 100 per missed month in
                        late penalties, as per the AQUAMY constitution.
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback banner */}
                {fb && (
                  <div className={`mx-6 mb-4 flex items-start gap-2 p-3 rounded-lg border text-xs
                    ${fb.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400"}`}>
                    {fb.type === "success"
                      ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
                      : <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />}
                    {fb.msg}
                  </div>
                )}

                {/* Decline reason input */}
                {isDeclining && (
                  <div className="px-6 pb-4 space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                      Reason for declining *
                    </label>
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. I am unable to take on this liability at this time."
                      className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm text-stone-800 dark:text-stone-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div className="px-6 pb-5 flex flex-wrap gap-3">
                  {/* Accept */}
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={!!acting || isDeclining}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {isActing && !isDeclining
                      ? <Loader2 size={13} className="animate-spin" />
                      : <ShieldCheck size={13} />}
                    I Accept — I understand my liability
                  </button>

                  {/* Decline toggle / confirm */}
                  {!isDeclining ? (
                    <button
                      onClick={() => { setDeclineId(req.id); setExpanded(req.id); setFeedback(null); }}
                      disabled={!!acting}
                      className="flex items-center gap-2 bg-white dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-stone-200 dark:border-stone-600 hover:border-red-200 dark:hover:border-red-700 text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                    >
                      <ShieldX size={13} /> Decline
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDecline(req.id)}
                        disabled={isActing}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                      >
                        {isActing
                          ? <Loader2 size={13} className="animate-spin" />
                          : <ShieldX size={13} />}
                        Confirm Decline
                      </button>
                      <button
                        onClick={() => { setDeclineId(null); setReason(""); setFeedback(null); }}
                        className="text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 px-3 py-2.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}