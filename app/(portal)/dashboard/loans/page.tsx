// app/(portal)/dashboard/loans/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LoanStatus } from "@prisma/client";
import LoanPaymentWidget from "./LoanPaymentWidget";
import Link from "next/link";
import {
  Landmark, PlusCircle, Clock, BadgeCheck,
  XCircle, ArrowUpRight, ShieldCheck, ShieldX,
  AlertTriangle, Users,
} from "lucide-react";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  DRAFT:        { label: "Draft",               classes: "bg-stone-100  text-stone-600  border-stone-200" },
  SUBMITTED:    { label: "Awaiting Guarantors", classes: "bg-amber-50   text-amber-700  border-amber-200" },
  UNDER_REVIEW: { label: "Under Review",        classes: "bg-purple-50  text-purple-700 border-purple-200" },
  APPROVED:     { label: "Approved",            classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DISBURSED:    { label: "Disbursed",           classes: "bg-blue-50    text-blue-700   border-blue-200" },
  REPAYING:     { label: "Repaying",            classes: "bg-amber-50   text-amber-700  border-amber-200" },
  FULLY_REPAID: { label: "Fully Repaid",        classes: "bg-slate-100  text-slate-500  border-slate-200" },
  REJECTED:     { label: "Rejected",            classes: "bg-red-50     text-red-700    border-red-200" },
  DEFAULTED:    { label: "Defaulted",           classes: "bg-red-100    text-red-800    border-red-300" },
};

export default async function LoansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  // FIX 1: Combined the duplicate 'select' blocks into one valid declaration
  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true, phone: true },
  });
  if (!dbUser) redirect("/login");

  // ── Main loan fetch ───────────────────────────────────────────────────────
  const [loans, activePolicy] = await Promise.all([
    prisma.loan.findMany({
      where:   { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      include: {
        repayments: { orderBy: { dueDate: "asc" } },
        guarantors: {
          include: {
            user: {
              select: {
                name: true, firstName: true,
                lastName: true, memberNumber: true,
              },
            },
          },
        },
      },
    }),
    prisma.loanPolicy.findFirst({ where: { active: true } }),
  ]);

  // ── Pending guarantor count ───────────────────────────────────────────────
  let pendingGuarantorCount = 0;
  try {
    pendingGuarantorCount = await prisma.loanGuarantor.count({
      where: {
        userId:       dbUser.id,
        hasConsented: false,
        declined:     false,
        loan: {
          status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] },
        },
      },
    });
  } catch {
    pendingGuarantorCount = await prisma.loanGuarantor.count({
      where: {
        userId:       dbUser.id,
        hasConsented: false,
        loan: {
          status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] },
        },
      },
    });
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">My Loans</h1>
          <p className="text-stone-500 text-sm mt-1">
            Loan history and repayment schedules.
          </p>
        </div>
        <Link href="/dashboard/loans/apply"
          className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <PlusCircle size={15} /> Apply for Loan
        </Link>
      </div>

      {/* Guarantor requests banner */}
      {pendingGuarantorCount > 0 && (
        <Link href="/dashboard/loans/guarantor-requests"
          className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                You have {pendingGuarantorCount} pending guarantor{" "}
                request{pendingGuarantorCount > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Other members need your response before their loans can proceed.
              </p>
            </div>
          </div>
          <ArrowUpRight size={16} className="text-amber-600 flex-shrink-0" />
        </Link>
      )}

      {/* Active policy info */}
      {activePolicy && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-wrap gap-6 text-xs">
          <div>
            <p className="text-stone-400 font-medium">Interest Rate</p>
            <p className="font-bold text-stone-800 mt-0.5">
              {activePolicy.interestRate}% p.a. ({activePolicy.interestMethod})
            </p>
          </div>
          <div>
            <p className="text-stone-400 font-medium">Loan Range</p>
            <p className="font-bold text-stone-800 mt-0.5">
              {kes(activePolicy.minimumLoanAmount)} – {kes(activePolicy.maximumLoanAmount)}
            </p>
          </div>
          <div>
            <p className="text-stone-400 font-medium">Max Term</p>
            <p className="font-bold text-stone-800 mt-0.5">{activePolicy.maxDuration} months</p>
          </div>
          <div>
            <p className="text-stone-400 font-medium">Guarantors Required</p>
            <p className="font-bold text-stone-800 mt-0.5">{activePolicy.requiredGuarantors}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {loans.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
          <Landmark size={40} className="text-stone-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-stone-700">No Loans Yet</h2>
          <p className="text-stone-400 text-sm mt-1 mb-5">
            You have not applied for any loans.
          </p>
          <Link href="/dashboard/loans/apply"
            className="inline-flex items-center gap-2 bg-[#1C4A2E] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#153822] transition-colors">
            <PlusCircle size={15} /> Apply Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => {
            const badge    = STATUS_STYLES[loan.status] ?? STATUS_STYLES.DRAFT;
            const repaid   = loan.totalRepayable - loan.outstandingBalance;
            const progress = loan.totalRepayable > 0
              ? (repaid / loan.totalRepayable) * 100 : 0;
            const paidCount   = loan.repayments.filter(r => r.status === "PAID").length;
            const missedCount = loan.repayments.filter(r => r.status === "MISSED").length;
            const nextDue     = loan.repayments.find(
              r => r.status === "PENDING" || r.status === "MISSED"
            );

            const declined = loan.guarantors.filter(
              g => (g as typeof g & { declined?: boolean }).declined === true
            );

            return (
              <div key={loan.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-stone-400">
                      {loan.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="font-bold text-stone-800 mt-0.5">
                      {loan.purpose || "Loan"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}>
                      {badge.label}
                    </span>
                    <p className="text-xl font-black text-stone-900">{kes(loan.principal)}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-b border-stone-100">
                  {[
                    { label: "Total Repayable",   value: kes(loan.totalRepayable) },
                    { label: "Outstanding",       value: kes(loan.outstandingBalance) },
                    { label: "Monthly",           value: kes(loan.monthlyInstalment) },
                    { label: "Applied",           value: new Date(loan.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">{label}</p>
                      <p className="font-bold text-stone-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Guarantor status */}
                {loan.guarantors.length > 0 && (
                  <div className="px-6 py-4 border-b border-stone-100">
                    <p className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-3">
                      Guarantor Status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {loan.guarantors.map(g => {
                        const gName = g.user.firstName
                          ? `${g.user.firstName} ${g.user.lastName}`
                          : g.user.name;
                        const isDeclined = (g as typeof g & { declined?: boolean }).declined;
                        const declineReason = (g as typeof g & { declineReason?: string }).declineReason;

                        if (g.hasConsented) return (
                          <div key={g.id}
                            className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                            <ShieldCheck size={12} /> {gName} — Accepted
                          </div>
                        );
                        if (isDeclined) return (
                          <div key={g.id}
                            className="flex flex-col gap-1 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-xl">
                            <div className="flex items-center gap-1.5">
                              <ShieldX size={12} /> {gName} —{" "}
                              <span className="font-black">Declined</span>
                            </div>
                            {declineReason && (
                              <p className="text-[10px] text-red-500 font-normal italic">
                                "{declineReason}"
                              </p>
                            )}
                          </div>
                        );
                        return (
                          <div key={g.id}
                            className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 text-stone-500 text-xs font-semibold px-3 py-1.5 rounded-full">
                            <Clock size={12} /> {gName} — Pending
                          </div>
                        );
                      })}
                    </div>

                    {declined.length > 0 && loan.status === LoanStatus.DRAFT && (
                      <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3">
                        <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-700">
                            A guarantor declined — your loan was returned to Draft
                          </p>
                          <p className="text-xs text-red-600 mt-0.5">
                            Select a replacement guarantor and resubmit.
                          </p>
                          <Link href="/dashboard/loans/apply"
                            className="text-xs font-bold text-red-700 hover:underline mt-1 inline-block">
                            Reapply with new guarantors →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Repayment progress section */}
                {[LoanStatus.REPAYING, LoanStatus.DISBURSED, LoanStatus.FULLY_REPAID].includes(loan.status) && (
                  <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/50 space-y-4">
                    
                    {/* Progress Bar Container */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                        <span>{paidCount} of {loan.repayments.length} instalments paid</span>
                        {missedCount > 0 && (
                          <span className="text-red-600 font-semibold">{missedCount} missed</span>
                        )}
                        <span className="font-bold text-stone-700">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1C4A2E] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>

                    {/* Alert for Next Due Instalment */}
                    {nextDue && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border
                        ${nextDue.status === "MISSED" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                        <Clock size={14} className={nextDue.status === "MISSED" ? "text-red-500" : "text-amber-600"} />
                        <p className={`text-xs ${nextDue.status === "MISSED" ? "text-red-700" : "text-amber-700"}`}>
                          {nextDue.status === "MISSED" ? "Missed" : "Next"} instalment{" "}
                          <strong>{kes(nextDue.expectedAmount)}</strong> is due on{" "}
                          {new Date(nextDue.dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}

                    {/* FIX 2: Inline Payment Widget implementation and cleanup of broken layout tags */}
                    {[LoanStatus.DISBURSED, LoanStatus.REPAYING].includes(loan.status) && loan.outstandingBalance > 0 && (
                      <div className="space-y-3">
                        <LoanPaymentWidget 
                          loanId={loan.id} 
                          outstandingBalance={loan.outstandingBalance} 
                          instalment={nextDue?.expectedAmount || loan.monthlyInstalment}
                          userPhone={dbUser.phone || ""}
                        />
                        
                        {/* Alternative link provided as a minimal secondary text action if they want to pay elsewhere */}
                        <div className="text-center">
                          <Link href={`/dashboard/payments?category=loan&amount=${loan.outstandingBalance}&loanId=${loan.id}`}
                            className="text-[11px] text-stone-400 hover:text-stone-600 hover:underline transition-colors">
                            Having trouble? Pay via manual transaction route instead →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection reason */}
                {loan.rejectionReason && (
                  <div className="px-6 py-3 bg-red-50 text-red-600 text-xs flex items-center gap-2">
                    <XCircle size={13} />
                    <span><strong>Rejection reason:</strong> {loan.rejectionReason}</span>
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