// app/(portal)/admin/loans/page.tsx — v2
// Clearer approval flow: "Ready for Decision" section for fully-guaranteed loans
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LoanStatus } from "@prisma/client";
import { approveLoan, rejectLoan, disburseLoan } from "@/app/actions/loan-actions";
import {
  Landmark, CheckCircle2, XCircle, ArrowUpRight,
  Clock, ShieldCheck, ShieldX, AlertTriangle, Users,
} from "lucide-react";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:    "bg-sky-50    text-sky-700    border-sky-200",
  UNDER_REVIEW: "bg-purple-50 text-purple-700 border-purple-200",
  APPROVED:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISBURSED:    "bg-blue-50   text-blue-700   border-blue-200",
  REPAYING:     "bg-amber-50  text-amber-700  border-amber-200",
  FULLY_REPAID: "bg-slate-100 text-slate-500  border-slate-200",
  REJECTED:     "bg-red-50    text-red-700    border-red-200",
  DEFAULTED:    "bg-red-100   text-red-800    border-red-300",
  DRAFT:        "bg-stone-100 text-stone-500  border-stone-200",
};

export default async function AdminLoansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const userRole    = (session.user as { role?: string }).role ?? "MEMBER";
  const canApprove  = ["ADMIN","TREASURER","CHAIRPERSON","CREDIT_COMMITTEE_MEMBER"].includes(userRole);
  const canDisburse = ["ADMIN","TREASURER"].includes(userRole);

  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          name: true, firstName: true, lastName: true,
          memberNumber: true, phone: true,
        },
      },
      loanPolicy: true,
      guarantors: {
        include: {
          user: { select: { name: true, firstName: true, memberNumber: true } },
        },
      },
      votes: {
        include: {
          user: { select: { name: true, firstName: true, role: true } },
        },
      },
      repayments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  // ── Bucket loans by action needed ────────────────────────────────────────
  // "Ready for decision" = UNDER_REVIEW with ALL guarantors consented
  const readyForDecision = loans.filter(l =>
    l.status === LoanStatus.UNDER_REVIEW &&
    l.guarantors.length > 0 &&
    l.guarantors.every(g => g.hasConsented)
  );

  // Awaiting guarantors = SUBMITTED or UNDER_REVIEW with pending guarantors
  const awaitingGuarantors = loans.filter(l =>
    (l.status === LoanStatus.SUBMITTED || l.status === LoanStatus.UNDER_REVIEW) &&
    !l.guarantors.every(g => g.hasConsented)
  );

  // Approved = waiting for disbursement
  const awaitingDisbursement = loans.filter(l => l.status === LoanStatus.APPROVED);

  // Active loans
  const activeLoans = loans.filter(l =>
    l.status === LoanStatus.DISBURSED || l.status === LoanStatus.REPAYING
  );

  // Closed
  const closedLoans = loans.filter(l =>
    l.status === LoanStatus.FULLY_REPAID ||
    l.status === LoanStatus.REJECTED ||
    l.status === LoanStatus.DEFAULTED ||
    l.status === LoanStatus.DRAFT
  );

  function memberName(user: { firstName: string | null; name: string }) {
    return user.firstName ?? user.name;
  }

  function LoanCard({
    loan,
    showApprove = false,
    showDisburse = false,
  }: {
    loan: typeof loans[number];
    showApprove?: boolean;
    showDisburse?: boolean;
  }) {
    const name        = memberName(loan.user);
    const initials    = (loan.user.firstName?.[0] ?? loan.user.name[0]).toUpperCase();
    const yesVotes    = loan.votes.filter(v => v.decision).length;
    const noVotes     = loan.votes.filter(v => !v.decision).length;
    const allConsented = loan.guarantors.every(g => g.hasConsented);
    const repaid      = loan.totalRepayable - loan.outstandingBalance;
    const progress    = loan.totalRepayable > 0 ? (repaid / loan.totalRepayable) * 100 : 0;
    const paidCount   = loan.repayments.filter(r => r.status === "PAID").length;
    const missedCount = loan.repayments.filter(r => r.status === "MISSED").length;

    return (
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1C4A2E]/10 flex items-center justify-center text-[#1C4A2E] text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-bold text-stone-800">{name}</p>
              <p className="text-[10px] font-mono text-stone-400">
                {loan.user.memberNumber} · {loan.user.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[loan.status] ?? ""}`}>
              {loan.status.replace(/_/g, " ")}
            </span>
            <p className="text-lg font-black text-stone-900">{kes(loan.principal)}</p>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-stone-100">
          <div><p className="text-stone-400 font-medium">Interest</p>      <p className="font-bold text-stone-800 mt-0.5">{loan.interestRate}% ({loan.loanPolicy?.interestMethod ?? "FLAT"})</p></div>
          <div><p className="text-stone-400 font-medium">Term</p>          <p className="font-bold text-stone-800 mt-0.5">{loan.termMonths} months</p></div>
          <div><p className="text-stone-400 font-medium">Monthly</p>       <p className="font-bold text-stone-800 mt-0.5">{kes(loan.monthlyInstalment)}</p></div>
          <div><p className="text-stone-400 font-medium">Purpose</p>       <p className="font-semibold text-stone-700 mt-0.5 truncate">{loan.purpose || "Not stated"}</p></div>
        </div>

        {/* Guarantors */}
        {loan.guarantors.length > 0 && (
          <div className="px-6 py-3 border-b border-stone-100">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
              Guarantors ({loan.guarantors.filter(g => g.hasConsented).length}/{loan.guarantors.length} accepted)
            </p>
            <div className="flex flex-wrap gap-2">
              {loan.guarantors.map(g => {
                const gName = g.user.firstName ?? g.user.name;
                const isDeclined = (g as typeof g & { declined?: boolean }).declined;
                return (
                  <span key={g.id}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border
                      ${g.hasConsented
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isDeclined
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-stone-50 text-stone-500 border-stone-200"}`}>
                    {g.hasConsented
                      ? <ShieldCheck size={10}/>
                      : isDeclined
                        ? <ShieldX size={10}/>
                        : <Clock size={10}/>}
                    {gName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Votes (if any) */}
        {loan.votes.length > 0 && (
          <div className="px-6 py-3 border-b border-stone-100 flex flex-wrap gap-4 items-center text-xs">
            <span className="text-stone-400 font-medium uppercase tracking-wider text-[10px]">Committee Votes:</span>
            <span className="font-bold text-emerald-700">{yesVotes} Approve</span>
            <span className="font-bold text-red-600">{noVotes} Reject</span>
          </div>
        )}

        {/* Repayment progress (active loans) */}
        {(loan.status === LoanStatus.REPAYING || loan.status === LoanStatus.DISBURSED) && (
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
              <span>{paidCount}/{loan.repayments.length} instalments paid</span>
              {missedCount > 0 && <span className="text-red-600 font-semibold">{missedCount} missed</span>}
              <span className="font-bold">{progress.toFixed(0)}% repaid</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1C4A2E] rounded-full"
                style={{ width: `${Math.min(progress, 100)}%` }}/>
            </div>
            <div className="flex justify-between text-xs text-stone-400 mt-1.5">
              <span>Repaid: <strong className="text-stone-700">{kes(repaid)}</strong></span>
              <span>Balance: <strong className="text-stone-700">{kes(loan.outstandingBalance)}</strong></span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {(showApprove || showDisburse) && (
          <div className="px-6 py-4 flex flex-wrap gap-3 bg-stone-50/60">
            {showApprove && canApprove && (
              <>
                <form action={async (fd) => {
                  "use server";
                  await approveLoan(fd.get("loanId") as string);
                }}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors">
                    <CheckCircle2 size={14}/> Approve Loan
                  </button>
                </form>
                <form action={async (fd) => {
                  "use server";
                  await rejectLoan(fd.get("loanId") as string, "Rejected by Credit Committee");
                }}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <button className="flex items-center gap-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors">
                    <XCircle size={14}/> Reject
                  </button>
                </form>
              </>
            )}
            {showDisburse && canDisburse && (
              <form action={async (fd) => {
                "use server";
                await disburseLoan(fd.get("loanId") as string);
              }}>
                <input type="hidden" name="loanId" value={loan.id} />
                <button className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors">
                  <ArrowUpRight size={14}/> Mark Disbursed — Funds Sent to Member
                </button>
              </form>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {loan.rejectionReason && (
          <div className="px-6 py-3 bg-red-50 text-red-700 text-xs flex items-center gap-2">
            <XCircle size={12}/> <strong>Rejection reason:</strong> {loan.rejectionReason}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">

      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Loan Register</h1>
        <p className="text-stone-500 text-sm mt-1">
          {loans.length} total · {readyForDecision.length} ready for decision
        </p>
      </div>

      {/* ── 1. READY FOR DECISION (highest priority) ─────────────────────── */}
      {readyForDecision.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Ready for Decision — All Guarantors Accepted ({readyForDecision.length})
            </h2>
          </div>
          <div className="space-y-4">
            {readyForDecision.map(loan => (
              <div key={loan.id} className="ring-2 ring-emerald-300 ring-offset-2 rounded-xl">
                <LoanCard loan={loan} showApprove />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 2. AWAITING DISBURSEMENT ─────────────────────────────────────── */}
      {awaitingDisbursement.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500"/>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              Approved — Awaiting Disbursement ({awaitingDisbursement.length})
            </h2>
          </div>
          <div className="space-y-4">
            {awaitingDisbursement.map(loan => (
              <LoanCard key={loan.id} loan={loan} showDisburse />
            ))}
          </div>
        </section>
      )}

      {/* ── 3. AWAITING GUARANTORS ───────────────────────────────────────── */}
      {awaitingGuarantors.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users size={12} className="text-amber-500"/>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              Awaiting Guarantor Responses ({awaitingGuarantors.length})
            </h2>
          </div>
          <div className="space-y-4">
            {awaitingGuarantors.map(loan => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. ACTIVE LOANS ──────────────────────────────────────────────── */}
      {activeLoans.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
            Active Loans — Repaying ({activeLoans.length})
          </h2>
          <div className="space-y-4">
            {activeLoans.map(loan => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </section>
      )}

      {/* ── 5. CLOSED / HISTORICAL ───────────────────────────────────────── */}
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
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {closedLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-700">{memberName(loan.user)}</p>
                        <p className="text-[10px] font-mono text-stone-400">{loan.user.memberNumber}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-stone-500">{kes(loan.principal)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[loan.status] ?? ""}`}>
                          {loan.status.replace(/_/g," ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">
                        {new Date(loan.createdAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400 max-w-xs truncate">
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
