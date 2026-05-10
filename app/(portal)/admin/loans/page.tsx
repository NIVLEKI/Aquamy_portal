// app/(portal)/admin/loans/page.tsx
// Full loan register — view all loans, approve/reject submitted ones,
// mark approved loans as disbursed.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LoanStatus } from "@prisma/client";
import { approveLoan, rejectLoan, disburseLoan } from "@/app/actions/loan-actions";
import { Landmark, Clock, CheckCircle2, XCircle, BadgeCheck, ArrowUpRight } from "lucide-react";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:        "bg-stone-100   text-stone-500   border-stone-200",
  SUBMITTED:    "bg-sky-50      text-sky-700     border-sky-200",
  UNDER_REVIEW: "bg-purple-50   text-purple-700  border-purple-200",
  APPROVED:     "bg-emerald-50  text-emerald-700 border-emerald-200",
  DISBURSED:    "bg-blue-50     text-blue-700    border-blue-200",
  REPAYING:     "bg-amber-50    text-amber-700   border-amber-200",
  FULLY_REPAID: "bg-slate-100   text-slate-500   border-slate-200",
  REJECTED:     "bg-red-50      text-red-700     border-red-200",
  DEFAULTED:    "bg-red-100     text-red-800     border-red-300",
};

export default async function AdminLoansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const userRole = (session.user as { role?: string }).role ?? "MEMBER";
  const canApprove = ["ADMIN","TREASURER","CHAIRPERSON","CREDIT_COMMITTEE_MEMBER"].includes(userRole);
  const canDisburse = ["ADMIN","TREASURER"].includes(userRole);

  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, firstName: true, lastName: true, memberNumber: true, phone: true },
      },
      guarantors: {
        include: { user: { select: { name: true, firstName: true, memberNumber: true } } },
      },
      votes: {
        include: { user: { select: { name: true, firstName: true, role: true } } },
      },
    },
  });

  // Group loans by priority for display
  const actionRequired = loans.filter(l =>
    l.status === LoanStatus.SUBMITTED || l.status === LoanStatus.UNDER_REVIEW || l.status === LoanStatus.APPROVED
  );
  const activeLoans = loans.filter(l =>
    l.status === LoanStatus.DISBURSED || l.status === LoanStatus.REPAYING
  );
  const closedLoans = loans.filter(l =>
    l.status === LoanStatus.FULLY_REPAID || l.status === LoanStatus.REJECTED ||
    l.status === LoanStatus.DEFAULTED || l.status === LoanStatus.DRAFT
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Loan Register</h1>
        <p className="text-stone-500 text-sm mt-1">
          {loans.length} total loans · {actionRequired.length} require action
        </p>
      </div>

      {/* ── ACTION REQUIRED ─────────────────────────────────────────────── */}
      {actionRequired.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
            Action Required ({actionRequired.length})
          </h2>
          <div className="space-y-4">
            {actionRequired.map(loan => {
              const memberName = loan.user.firstName
                ? `${loan.user.firstName} ${loan.user.lastName}`
                : loan.user.name;
              const yesVotes = loan.votes.filter(v => v.decision).length;
              const noVotes  = loan.votes.filter(v => !v.decision).length;

              return (
                <div key={loan.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1C4A2E]/10 flex items-center justify-center text-[#1C4A2E] text-xs font-bold flex-shrink-0">
                        {(loan.user.firstName?.[0] ?? loan.user.name[0]).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-stone-800">{memberName}</p>
                        <p className="text-[10px] font-mono text-stone-400">{loan.user.memberNumber} · {loan.user.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[loan.status]}`}>
                        {loan.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(loan.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-stone-100 text-sm">
                    <div>
                      <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Principal</p>
                      <p className="font-bold text-stone-800 mt-0.5">{kes(loan.principal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Interest</p>
                      <p className="font-bold text-stone-800 mt-0.5">{loan.interestRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Term</p>
                      <p className="font-bold text-stone-800 mt-0.5">{loan.termMonths} months</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Purpose</p>
                      <p className="font-semibold text-stone-700 mt-0.5 text-xs line-clamp-2">{loan.purpose || "Not stated"}</p>
                    </div>
                  </div>

                  {/* Guarantors */}
                  {loan.guarantors.length > 0 && (
                    <div className="px-6 py-3 border-b border-stone-100 flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider self-center">Guarantors:</span>
                      {loan.guarantors.map(g => (
                        <span key={g.id} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${g.hasConsented ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {g.user.firstName ?? g.user.name} ({g.user.memberNumber}) {g.hasConsented ? "✓" : "awaiting consent"}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Votes */}
                  {loan.votes.length > 0 && (
                    <div className="px-6 py-3 border-b border-stone-100 flex flex-wrap gap-3 items-center">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Votes:</span>
                      <span className="text-xs font-bold text-emerald-700">{yesVotes} Approve</span>
                      <span className="text-xs font-bold text-red-600">{noVotes} Reject</span>
                      {loan.votes.map(v => (
                        <span key={v.id} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${v.decision ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                          {v.user.firstName ?? v.user.name}: {v.decision ? "✓" : "✗"}
                          {v.comments && ` · "${v.comments}"`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="px-6 py-4 flex flex-wrap gap-3">
                    {/* SUBMITTED / UNDER_REVIEW → can approve or reject */}
                    {canApprove && (loan.status === LoanStatus.SUBMITTED || loan.status === LoanStatus.UNDER_REVIEW) && (
                      <>
                        <form action={async (fd) => { "use server"; await approveLoan(fd.get("loanId") as string); }}>
                          <input type="hidden" name="loanId" value={loan.id} />
                          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors">
                            <CheckCircle2 size={14}/> Approve
                          </button>
                        </form>
                        <form action={async (fd) => { "use server"; await rejectLoan(fd.get("loanId") as string, fd.get("reason") as string); }}>
                          <input type="hidden" name="loanId" value={loan.id} />
                          <input type="hidden" name="reason" value="Rejected by committee" />
                          <button className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors">
                            <XCircle size={14}/> Reject
                          </button>
                        </form>
                      </>
                    )}

                    {/* APPROVED → Treasurer can disburse */}
                    {canDisburse && loan.status === LoanStatus.APPROVED && (
                      <form action={async (fd) => { "use server"; await disburseLoan(fd.get("loanId") as string); }}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors">
                          <ArrowUpRight size={14}/> Mark as Disbursed
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ACTIVE LOANS ─────────────────────────────────────────────────── */}
      {activeLoans.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
            Active Loans ({activeLoans.length})
          </h2>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    {["Member","Principal","Outstanding","Monthly","Status","Disbursed"].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {activeLoans.map(loan => {
                    const memberName = loan.user.firstName ?? loan.user.name;
                    const progress = loan.totalRepayable > 0
                      ? ((loan.totalRepayable - loan.outstandingBalance) / loan.totalRepayable) * 100 : 0;
                    return (
                      <tr key={loan.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-stone-800">{memberName}</p>
                          <p className="text-[10px] font-mono text-stone-400">{loan.user.memberNumber}</p>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-stone-600">{kes(loan.principal)}</td>
                        <td className="px-4 py-3.5">
                          <p className="tabular-nums font-semibold text-stone-800">{kes(loan.outstandingBalance)}</p>
                          <div className="mt-1 w-16 h-1 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1C4A2E] rounded-full" style={{ width: `${progress}%` }}/>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-stone-600">{kes(loan.monthlyInstalment)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[loan.status]}`}>
                            {loan.status.replace(/_/g," ")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-stone-400 whitespace-nowrap">
                          {loan.disbursedAt
                            ? new Date(loan.disbursedAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── CLOSED LOANS ────────────────────────────────────────────────── */}
      {closedLoans.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
            Closed / Historical ({closedLoans.length})
          </h2>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    {["Member","Principal","Status","Applied","Notes"].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {closedLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-stone-700">{loan.user.firstName ?? loan.user.name}</p>
                        <p className="text-[10px] font-mono text-stone-400">{loan.user.memberNumber}</p>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-stone-500">{kes(loan.principal)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[loan.status]}`}>
                          {loan.status.replace(/_/g," ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 whitespace-nowrap">
                        {new Date(loan.createdAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 max-w-xs truncate">
                        {loan.rejectionReason ?? loan.purpose ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {loans.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
          <Landmark size={40} className="text-stone-200 mx-auto mb-4"/>
          <p className="text-stone-500 text-sm">No loan applications yet.</p>
        </div>
      )}
    </div>
  );
}