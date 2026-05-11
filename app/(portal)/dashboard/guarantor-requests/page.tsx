// app/(portal)/dashboard/loans/guarantor-requests/page.tsx
// Shows all pending guarantor requests for the logged-in member.
// Also link to this from the main loans page and sidebar notification badge.
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getPendingGuarantorRequests,
  acceptGuarantorRequest,
  declineGuarantorRequest,
} from "@/app/actions/guarantor-actions";
import {
  ShieldAlert, CheckCircle2, XCircle, Loader2,
  Landmark, User, AlertTriangle, Clock,
} from "lucide-react";

type GuarantorRequest = Awaited<ReturnType<typeof getPendingGuarantorRequests>>[number];

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default function GuarantorRequestsPage() {
  const [requests, setRequests]         = useState<GuarantorRequest[]>([]);
  const [loading, setLoading]           = useState(true);
  const [declined, setDeclined]         = useState<Record<string, boolean>>({});
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [showDeclineBox, setShowDeclineBox] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback]         = useState<Record<string, { type: "success"|"error"; msg: string }>>({});
  const [isPending, startTransition]    = useTransition();

  useEffect(() => {
    getPendingGuarantorRequests()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  function handleAccept(loanId: string) {
    startTransition(async () => {
      try {
        await acceptGuarantorRequest(loanId);
        setRequests(prev => prev.filter(r => r.loanId !== loanId));
        setFeedback(prev => ({ ...prev, [loanId]: { type: "success", msg: "You have accepted. The loan application will now proceed to committee review." } }));
      } catch (err: unknown) {
        setFeedback(prev => ({ ...prev, [loanId]: { type: "error", msg: err instanceof Error ? err.message : "Error" } }));
      }
    });
  }

  function handleDecline(loanId: string) {
    startTransition(async () => {
      try {
        await declineGuarantorRequest(loanId, declineReason[loanId]);
        setRequests(prev => prev.filter(r => r.loanId !== loanId));
        setDeclined(prev => ({ ...prev, [loanId]: true }));
        setFeedback(prev => ({ ...prev, [loanId]: { type: "error", msg: "You have declined. The applicant will be notified to find a replacement guarantor." } }));
      } catch (err: unknown) {
        setFeedback(prev => ({ ...prev, [loanId]: { type: "error", msg: err instanceof Error ? err.message : "Error" } }));
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 dark:text-stone-600">
        <Loader2 size={24} className="animate-spin mr-2"/> Loading requests...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">Guarantor Requests</h1>
        <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
          Members who have listed you as a guarantor for their loan application.
        </p>
      </div>

      {/* Liability notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Read before accepting</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            By accepting as a guarantor, you agree that <strong>if the loan applicant misses payments or defaults</strong>,
            you are jointly liable for the outstanding balance, accrued interest,
            and any late penalties as defined in the AQUAMY constitution.
            This obligation remains until the loan is fully repaid.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4"/>
          <p className="text-stone-600 dark:text-stone-400 font-medium">No pending guarantor requests.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {requests.map(req => {
            const fb    = feedback[req.loanId];
            const applicantName = req.loan.user.firstName
              ? `${req.loan.user.firstName} ${req.loan.user.lastName}`
              : req.loan.user.name;
            const monthlyApprox = req.loan.totalRepayable > 0 && req.loan.termMonths > 0
              ? req.loan.totalRepayable / req.loan.termMonths : req.loan.principal / 12;

            return (
              <div key={req.loanId} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1C4A2E]/10 dark:bg-[#1C4A2E]/30 flex items-center justify-center text-[#1C4A2E] dark:text-green-400 font-bold text-sm flex-shrink-0">
                      {(req.loan.user.firstName?.[0] ?? req.loan.user.name[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-200">{applicantName}</p>
                      <p className="text-[10px] font-mono text-stone-400">{req.loan.user.memberNumber} · {req.loan.user.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-1 rounded-full">
                    <Clock size={10}/> Awaiting your response
                  </div>
                </div>

                {/* Loan details */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-stone-100 dark:border-stone-700 text-sm">
                  <div>
                    <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Loan Amount</p>
                    <p className="font-bold text-stone-800 dark:text-stone-200 mt-0.5">{kes(req.loan.principal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Term</p>
                    <p className="font-bold text-stone-800 dark:text-stone-200 mt-0.5">{req.loan.termMonths} months</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Interest</p>
                    <p className="font-bold text-stone-800 dark:text-stone-200 mt-0.5">{req.loan.interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Est. Monthly</p>
                    <p className="font-bold text-stone-800 dark:text-stone-200 mt-0.5">{kes(monthlyApprox)}</p>
                  </div>
                </div>

                {/* Purpose */}
                <div className="px-6 py-3 border-b border-stone-100 dark:border-stone-700">
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mb-1">Stated Purpose</p>
                  <p className="text-sm text-stone-700 dark:text-stone-300">{req.loan.purpose || "Not stated."}</p>
                </div>

                {/* Your liability */}
                <div className="px-6 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Your liability:</strong> If {req.loan.user.firstName ?? "the applicant"} defaults,
                      you become responsible for the outstanding balance of up to <strong>{kes(req.loan.totalRepayable || req.loan.principal)}</strong> plus
                      any penalties incurred. This is a binding commitment per the AQUAMY constitution.
                    </p>
                  </div>
                </div>

                {/* Feedback banner */}
                {fb && (
                  <div className={`px-6 py-3 flex items-start gap-2 text-sm ${fb.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
                    {fb.type === "success" ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0"/> : <XCircle size={14} className="mt-0.5 flex-shrink-0"/>}
                    {fb.msg}
                  </div>
                )}

                {/* Decline reason box */}
                {showDeclineBox[req.loanId] && (
                  <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                      Reason for declining (optional)
                    </label>
                    <textarea
                      rows={2} placeholder="e.g. Unable to take on this liability at this time."
                      value={declineReason[req.loanId] ?? ""}
                      onChange={e => setDeclineReason(prev => ({ ...prev, [req.loanId]: e.target.value }))}
                      className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 dark:text-stone-200"
                    />
                    <div className="flex gap-3 mt-3">
                      <button onClick={() => handleDecline(req.loanId)} disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                        {isPending ? <Loader2 size={13} className="animate-spin"/> : <XCircle size={13}/>}
                        Confirm Decline
                      </button>
                      <button onClick={() => setShowDeclineBox(prev => ({ ...prev, [req.loanId]: false }))}
                        className="px-4 text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-600 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {!fb && (
                  <div className="px-6 py-4 flex flex-col sm:flex-row gap-3">
                    <button onClick={() => handleAccept(req.loanId)} disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
                      {isPending ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}
                      I Accept & Understand My Liability
                    </button>
                    {!showDeclineBox[req.loanId] && (
                      <button
                        onClick={() => setShowDeclineBox(prev => ({ ...prev, [req.loanId]: true }))}
                        className="sm:w-auto flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700 text-sm font-bold py-3 px-5 rounded-lg transition-colors">
                        <XCircle size={15}/> Decline
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}