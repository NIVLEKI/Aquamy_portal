// app/(portal)/dashboard/loans/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LoanStatus } from "@prisma/client";
import Link from "next/link";
import { Landmark, PlusCircle, Clock, BadgeCheck, XCircle, ArrowUpRight } from "lucide-react";

function kes(v: number) { return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`; }

const STATUS_STYLES: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
  DRAFT:        { label: "Draft",        classes: "bg-stone-100   text-stone-600   border-stone-200",   icon: <Clock size={11}/> },
  SUBMITTED:    { label: "Submitted",    classes: "bg-sky-50      text-sky-700     border-sky-200",     icon: <Clock size={11}/> },
  UNDER_REVIEW: { label: "Under Review", classes: "bg-purple-50   text-purple-700  border-purple-200",  icon: <Clock size={11}/> },
  APPROVED:     { label: "Approved",     classes: "bg-emerald-50  text-emerald-700 border-emerald-200", icon: <BadgeCheck size={11}/> },
  DISBURSED:    { label: "Disbursed",    classes: "bg-blue-50     text-blue-700    border-blue-200",    icon: <ArrowUpRight size={11}/> },
  REPAYING:     { label: "Repaying",     classes: "bg-amber-50    text-amber-700   border-amber-200",   icon: <Clock size={11}/> },
  FULLY_REPAID: { label: "Fully Repaid", classes: "bg-slate-100   text-slate-500   border-slate-200",   icon: <BadgeCheck size={11}/> },
  REJECTED:     { label: "Rejected",     classes: "bg-red-50      text-red-700     border-red-200",     icon: <XCircle size={11}/> },
  DEFAULTED:    { label: "Defaulted",    classes: "bg-red-100     text-red-800     border-red-300",     icon: <XCircle size={11}/> },
};

export default async function LoansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!dbUser) redirect("/login");

  const loans = await prisma.loan.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    include: {
      repayments: { orderBy: { dueDate: "asc" } },
      guarantors: { include: { user: { select: { name: true, firstName: true } } } },
    },
  });

  const activePolicy = await prisma.loanPolicy.findFirst({ where: { active: true } });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">My Loans</h1>
          <p className="text-stone-500 text-sm mt-1">Loan history and active repayment schedules.</p>
        </div>
        <Link href="/dashboard/loans/apply"
          className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <PlusCircle size={15} /> Apply for Loan
        </Link>
      </div>

      {/* Loan Policy Info */}
      {activePolicy && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-wrap gap-6 text-xs">
          <div><p className="text-stone-400 font-medium">Interest Rate</p><p className="font-bold text-stone-800 mt-0.5">{activePolicy.interestRate}% p.a. ({activePolicy.interestMethod})</p></div>
          <div><p className="text-stone-400 font-medium">Max Loan</p><p className="font-bold text-stone-800 mt-0.5">{kes(activePolicy.maximumLoanAmount)}</p></div>
          <div><p className="text-stone-400 font-medium">Max Term</p><p className="font-bold text-stone-800 mt-0.5">{activePolicy.maxDuration} months</p></div>
          <div><p className="text-stone-400 font-medium">Guarantors Required</p><p className="font-bold text-stone-800 mt-0.5">{activePolicy.requiredGuarantors}</p></div>
        </div>
      )}

      {loans.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
          <Landmark size={40} className="text-stone-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-stone-700">No Loans Yet</h2>
          <p className="text-stone-400 text-sm mt-1 mb-5">You haven't applied for any loans.</p>
          <Link href="/dashboard/loans/apply" className="inline-flex items-center gap-2 bg-[#1C4A2E] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#153822] transition-colors">
            <PlusCircle size={15} /> Apply Now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => {
            const badge    = STATUS_STYLES[loan.status] ?? STATUS_STYLES.DRAFT;
            const repaid   = loan.totalRepayable - loan.outstandingBalance;
            const progress = loan.totalRepayable > 0 ? (repaid / loan.totalRepayable) * 100 : 0;
            const paidCount   = loan.repayments.filter(r => r.status === "PAID").length;
            const missedCount = loan.repayments.filter(r => r.status === "MISSED").length;
            const nextDue = loan.repayments.find(r => r.status === "PENDING" || r.status === "MISSED");

            return (
              <div key={loan.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-stone-400">{loan.id.slice(0,8).toUpperCase()}</p>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </div>
                    <p className="font-bold text-stone-800 mt-1">{loan.purpose || "No purpose stated"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-stone-900">{kes(loan.principal)}</p>
                    <p className="text-[10px] text-stone-400">Principal</p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-b border-stone-100">
                  <div><p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Total Repayable</p><p className="font-bold text-stone-800 mt-0.5">{kes(loan.totalRepayable)}</p></div>
                  <div><p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Outstanding</p><p className="font-bold text-stone-800 mt-0.5">{kes(loan.outstandingBalance)}</p></div>
                  <div><p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Monthly Instalment</p><p className="font-bold text-stone-800 mt-0.5">{kes(loan.monthlyInstalment)}</p></div>
                  <div><p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Applied</p><p className="font-bold text-stone-800 mt-0.5">{new Date(loan.createdAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}</p></div>
                </div>

                {/* Progress */}
                {[LoanStatus.REPAYING, LoanStatus.DISBURSED, LoanStatus.FULLY_REPAID].includes(loan.status) && (
                  <div className="px-6 py-4 border-b border-stone-100">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                      <span>{paidCount} of {loan.repayments.length} instalments paid</span>
                      {missedCount > 0 && <span className="text-red-600 font-semibold">{missedCount} missed</span>}
                      <span className="font-bold text-stone-700">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1C4A2E] rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                    {nextDue && (
                      <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${nextDue.status === "MISSED" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                        <Clock size={12} className={nextDue.status === "MISSED" ? "text-red-500" : "text-amber-600"} />
                        <p className={`text-xs ${nextDue.status === "MISSED" ? "text-red-700" : "text-amber-700"}`}>
                          {nextDue.status === "MISSED" ? "Missed instalment" : "Next instalment"} of <strong>{kes(nextDue.expectedAmount)}</strong> due{" "}
                          {new Date(nextDue.dueDate).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}
                        </p>
                        <Link href={`/dashboard/payments?type=loan&loanId=${loan.id}`} className="ml-auto text-[10px] font-bold text-[#1C4A2E] hover:underline whitespace-nowrap">
                          Pay Now →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

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