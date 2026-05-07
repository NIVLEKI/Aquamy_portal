// app/(portal)/dashboard/page.tsx
// Fixed against schema.prisma v3 — all field names verified

import {
  Wallet, Landmark, TrendingUp, Users, AlertTriangle,
  History, ChevronRight, BadgeCheck, Clock, XCircle,
  Coins, PieChart, ShieldAlert, ArrowUpRight,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ContributionType, // ✓ real enum
  FineStatus,       // ✓ real enum — values: OUTSTANDING, PAID, WAIVED
  LoanStatus,       // ✓ real enum
  MemberStatus,     // ✓ real enum — NOT "UserStatus"
  LoanRepaymentStatus, // ✓ real enum
} from "@prisma/client";
// ContributionStatus is NOT imported — Contribution.status is a plain String field

// =============================================================================
// HELPERS
// =============================================================================

function kes(value: number | null | undefined): string {
  return `KES ${(value ?? 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return parseFloat(String(val));
}

function contributionLabel(type: ContributionType): string {
  const map: Record<ContributionType, string> = {
    REGISTRATION_FEE: "Registration",
    MAINTENANCE_FEE:  "Maintenance",
    MONTHLY:          "Monthly",
    LATE_PENALTY:     "Late Penalty",
    ARREAR_PAYMENT:   "Arrear Payment",
  };
  return map[type] ?? type;
}

function loanStatusStyle(status: LoanStatus) {
  const styles: Partial<Record<LoanStatus, { label: string; classes: string; icon: React.ReactNode }>> = {
    APPROVED:     { label: "Approved",     classes: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <BadgeCheck size={12} /> },
    DISBURSED:    { label: "Disbursed",    classes: "bg-blue-50 text-blue-700 border-blue-200",          icon: <ArrowUpRight size={12} /> },
    REPAYING:     { label: "Repaying",     classes: "bg-amber-50 text-amber-700 border-amber-200",       icon: <Clock size={12} /> },
    FULLY_REPAID: { label: "Fully Repaid", classes: "bg-slate-100 text-slate-600 border-slate-200",      icon: <BadgeCheck size={12} /> },
    REJECTED:     { label: "Rejected",     classes: "bg-red-50 text-red-700 border-red-200",             icon: <XCircle size={12} /> },
    UNDER_REVIEW: { label: "Under Review", classes: "bg-purple-50 text-purple-700 border-purple-200",    icon: <Clock size={12} /> },
    SUBMITTED:    { label: "Submitted",    classes: "bg-sky-50 text-sky-700 border-sky-200",             icon: <Clock size={12} /> },
    DEFAULTED:    { label: "Defaulted",    classes: "bg-red-100 text-red-800 border-red-300",            icon: <XCircle size={12} /> },
  };
  return styles[status] ?? { label: status, classes: "bg-slate-100 text-slate-600 border-slate-200", icon: null };
}

// =============================================================================
// PAGE
// =============================================================================

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  // ── Role resolution ────────────────────────────────────────────────────────
  // Auth route puts `role` (single string) on the token — NOT `roles` array.
  const userRole   = (session.user as { role?: string }).role ?? "MEMBER";
  const isAdmin    = userRole === "ADMIN";
  const isTreasurer = userRole === "TREASURER";
  const isManagement = isAdmin || isTreasurer;

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      financialSummary: true,
      shares: true, // one-to-one: Share? — schema field is `quantity`
      contributions: {
        where: {
          // ContributionStatus is a String field — use string literal, NOT enum
          status: { not: "WAIVED" },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
      loans: {
        where: {
          status: {
            in: [
              LoanStatus.SUBMITTED,
              LoanStatus.UNDER_REVIEW,
              LoanStatus.APPROVED,
              LoanStatus.DISBURSED,
              LoanStatus.REPAYING,
            ],
          },
        },
        // Schema has createdAt, NOT appliedAt
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          // Relation name is `repayments`, NOT `repaymentSchedule`
          repayments: {
            where: {
              status: {
                in: [
                  LoanRepaymentStatus.PENDING,
                  LoanRepaymentStatus.MISSED,
                  LoanRepaymentStatus.PARTIALLY_PAID,
                ],
              },
            },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
      },
      fines: {
        where: {
          // FineStatus enum values: OUTSTANDING, PAID, WAIVED — NOT "PENDING"
          status: FineStatus.OUTSTANDING,
        },
        orderBy: { issuedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!dbUser) redirect("/login");

  // ── Display name — middleName does NOT exist in schema ────────────────────
  const fullName = [dbUser.firstName, dbUser.lastName]
    .filter(Boolean)
    .join(" ") || dbUser.name; // fallback to legacy `name` field

  // Avatar initials — guard against empty string default
  const initials = [
    dbUser.firstName?.[0] ?? dbUser.name?.[0] ?? "?",
    dbUser.lastName?.[0]  ?? "",
  ].join("").toUpperCase();

  const summary = dbUser.financialSummary;

  // ── Financial figures ──────────────────────────────────────────────────────
  let totalContributed = toNum(summary?.totalContributed);
  let outstandingLoan  = toNum(summary?.outstandingLoanBalance);
  let outstandingFines = toNum(summary?.outstandingFines);
  let outstandingArrears = toNum(summary?.outstandingArrears);

  if (!summary) {
    const [contribAgg, loanAgg, finesAgg, arrearsAgg] = await Promise.all([
      prisma.contribution.aggregate({
        where: { userId: dbUser.id },
        _sum:  { paidAmount: true },
      }),
      prisma.loan.aggregate({
        where: { userId: dbUser.id, status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } },
        _sum:  { outstandingBalance: true },
      }),
      prisma.fine.aggregate({
        where: { userId: dbUser.id, status: FineStatus.OUTSTANDING },
        _sum:  { amount: true },
      }),
      prisma.contribution.aggregate({
        where: {
          userId: dbUser.id,
          type:   ContributionType.MONTHLY,
          status: "OVERDUE", // String field — use literal
        },
        _sum: { expectedAmount: true },
      }),
    ]);

    totalContributed  = toNum(contribAgg._sum.paidAmount);
    outstandingLoan   = toNum(loanAgg._sum.outstandingBalance);
    outstandingFines  = toNum(finesAgg._sum.amount);
    outstandingArrears = toNum(arrearsAgg._sum.expectedAmount);
  }

  // ── Shares — schema field is `quantity`, NOT `totalShares` ────────────────
  const sharesHeld  = dbUser.shares?.quantity ?? 0;
  const sharePriceConfig = await prisma.systemConfig.findUnique({
    where: { key: "SHARE_PRICE_KES" },
  });
  const sharePrice = parseFloat(sharePriceConfig?.value ?? "0");
  const shareValue = sharesHeld * sharePrice;
  const netWorth   = totalContributed + shareValue - outstandingLoan;

  // ── Management stats ───────────────────────────────────────────────────────
  let groupData: {
    totalMembers: number;
    activeLoans: number;
    pendingApprovals: number;
    groupBalance: number;
    totalLoansOutstanding: number;
    pendingMemberCount: number;
  } | null = null;

  if (isManagement) {
    const [
      totalMembers, activeLoans, pendingApprovals,
      latestLedger, loansOutstandingAgg, pendingMemberCount,
    ] = await Promise.all([
      // MemberStatus enum — NOT "UserStatus"
      prisma.user.count({ where: { status: MemberStatus.ACTIVE } }),

      prisma.loan.count({
        where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } },
      }),

      prisma.loan.count({
        where: { status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] } },
      }),

      prisma.groupLedgerEntry.findFirst({ orderBy: { recordedAt: "desc" } }),

      prisma.loan.aggregate({
        where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } },
        _sum:  { outstandingBalance: true },
      }),

      prisma.user.count({ where: { status: MemberStatus.PENDING } }),
    ]);

    groupData = {
      totalMembers,
      activeLoans,
      pendingApprovals,
      groupBalance:           toNum(latestLedger?.balanceAfter),
      totalLoansOutstanding:  toNum(loansOutstandingAgg._sum.outstandingBalance),
      pendingMemberCount,
    };
  }

  const hasAlerts = outstandingFines > 0 || outstandingArrears > 0;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C4A2E] flex items-center justify-center">
            <span className="text-white text-xs font-black tracking-tighter">AQ</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">AQUAMY</p>
            <p className="text-xs text-stone-500 leading-none mt-0.5">Member Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasAlerts && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200">
              <AlertTriangle size={12} />
              Action Required
            </div>
          )}
          <div className="text-right">
            <p className="text-xs font-bold text-stone-800 leading-none">{fullName}</p>
            <p className="text-[10px] font-mono text-stone-400 mt-0.5">{dbUser.memberNumber}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#1C4A2E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-10 py-8 space-y-8 max-w-7xl mx-auto">

        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-stone-900 tracking-tight">
              {isManagement ? "Management Overview" : `Hello, ${dbUser.firstName || dbUser.name}.`}
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              {isManagement
                ? "Group-level financial summary and pending actions."
                : "Your personal financial standing with AQUAMY."}
            </p>
          </div>
          <p className="text-xs text-stone-400 font-medium">
            {new Date().toLocaleDateString("en-KE", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>

        {/* Alert banner */}
        {hasAlerts && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <p className="text-sm font-bold text-red-800">Your account has outstanding obligations</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {outstandingFines > 0 && `${kes(outstandingFines)} in unpaid fines. `}
                  {outstandingArrears > 0 && `${kes(outstandingArrears)} in contribution arrears.`}
                </p>
              </div>
            </div>
            <Link href="/dashboard/payments" className="text-xs font-bold text-red-700 bg-white border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap flex-shrink-0">
              Clear Now →
            </Link>
          </div>
        )}

        {/* Management stats */}
        {isManagement && groupData && (
          <section>
            <SectionHeading label="Group Overview" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Group Treasury"          value={kes(groupData.groupBalance)}             sub="Running balance"          icon={<PieChart size={18} />} accent="green" large />
              <StatCard label="Total Members"           value={groupData.totalMembers.toString()}        sub="Active members"           icon={<Users size={18} />}    accent="blue" />
              <StatCard label="Active Loans"            value={groupData.activeLoans.toString()}         sub={`${kes(groupData.totalLoansOutstanding)} outstanding`} icon={<Landmark size={18} />} accent="amber" />
              <StatCard label="Pending Loan Approvals"  value={groupData.pendingApprovals.toString()}    sub="Awaiting committee vote"  icon={<Clock size={18} />}    accent={groupData.pendingApprovals > 0 ? "red" : "neutral"} href="/admin/loans" />
              <StatCard label="Pending Members"         value={groupData.pendingMemberCount.toString()}  sub="Awaiting onboarding"      icon={<Users size={18} />}    accent={groupData.pendingMemberCount > 0 ? "red" : "neutral"} href="/admin/approvals" />
            </div>
          </section>
        )}

        {/* Personal finances */}
        <section>
          <SectionHeading label="My Finances" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Contributed"   value={kes(totalContributed)}  sub="All time payments"                     icon={<Wallet size={18} />}    accent="green" />
            <StatCard label="Shares Value"         value={kes(shareValue)}        sub={`${sharesHeld} unit${sharesHeld !== 1 ? "s" : ""} @ ${kes(sharePrice)}`} icon={<Coins size={18} />} accent="blue" href="/dashboard/shares" />
            <StatCard label="Active Loan Balance"  value={kes(outstandingLoan)}   sub="Outstanding principal"                 icon={<Landmark size={18} />}  accent={outstandingLoan > 0 ? "amber" : "neutral"} href="/dashboard/loans" />
            <StatCard label="Net Standing"         value={kes(netWorth)}          sub="Contributions + shares − loans"        icon={<TrendingUp size={18} />} accent={netWorth >= 0 ? "green" : "red"} />
          </div>
        </section>

        {/* Lower grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Loans */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <PanelHeader icon={<Landmark size={16} />} title="Active Loans" action={{ label: "Apply for Loan →", href: "/dashboard/loans/apply" }} />
            {dbUser.loans.length === 0 ? (
              <EmptyState message="No active loans. Apply for your first loan." />
            ) : (
              <div className="divide-y divide-stone-100">
                {dbUser.loans.map((loan) => {
                  const repaid   = toNum(loan.totalRepayable) - toNum(loan.outstandingBalance);
                  const progress = toNum(loan.totalRepayable) > 0
                    ? (repaid / toNum(loan.totalRepayable)) * 100 : 0;
                  // Relation is `repayments`, NOT `repaymentSchedule`
                  const nextInstalment = loan.repayments[0];
                  const badge = loanStatusStyle(loan.status);

                  return (
                    <div key={loan.id} className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          {/* Loan has no loanNumber field — use id prefix */}
                          <p className="text-xs font-mono text-stone-400">
                            {loan.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-sm font-bold text-stone-800 mt-0.5 line-clamp-1">
                            {loan.purpose || "Loan"}
                          </p>
                        </div>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${badge.classes}`}>
                          {badge.icon}{badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#1C4A2E] rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-stone-500 tabular-nums">{progress.toFixed(0)}%</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span>Repaid: <strong className="text-stone-700">{kes(repaid)}</strong></span>
                        <span>Balance: <strong className="text-stone-700">{kes(toNum(loan.outstandingBalance))}</strong></span>
                      </div>

                      {nextInstalment && (
                        <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <Clock size={12} className="text-amber-600 flex-shrink-0" />
                          <p className="text-xs text-amber-700">
                            Next instalment of <strong>{kes(toNum(nextInstalment.expectedAmount))}</strong> due{" "}
                            {new Date(nextInstalment.dueDate).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">

            {/* Fines */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex-1">
              <PanelHeader icon={<AlertTriangle size={16} />} title="Outstanding Fines"
                action={outstandingFines > 0 ? { label: "Pay →", href: "/dashboard/payments?type=fines" } : undefined}
              />
              {dbUser.fines.length === 0 ? (
                <div className="p-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <BadgeCheck size={16} className="text-emerald-600" />
                  </div>
                  <p className="text-sm text-stone-500">No outstanding fines.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-stone-100">
                    {dbUser.fines.map((fine) => (
                      <div key={fine.id} className="px-5 py-3 flex items-center justify-between gap-2">
                        <div>
                          {/* Fine has `reason` not `type` */}
                          <p className="text-xs font-semibold text-stone-700 line-clamp-1">{fine.reason}</p>
                          <p className="text-[10px] text-stone-400">
                            {new Date(fine.issuedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-red-600 tabular-nums">{kes(toNum(fine.amount))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-red-700">Total Due</span>
                    <span className="text-sm font-black text-red-700">{kes(outstandingFines)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Shares */}
            <div className="bg-[#1C4A2E] rounded-xl shadow-sm overflow-hidden text-white">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/70">
                  <Coins size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">My Shares</span>
                </div>
                <Link href="/dashboard/shares" className="text-[10px] font-bold text-white/50 hover:text-white transition-colors">History →</Link>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-3xl font-black tabular-nums">{sharesHeld}</p>
                  <p className="text-white/50 text-xs mt-0.5">Units held</p>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/50 text-[10px] uppercase tracking-wider">Current Value</p>
                    <p className="text-lg font-bold tabular-nums">{kes(shareValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider">Price / Unit</p>
                    <p className="text-lg font-bold tabular-nums">{kes(sharePrice)}</p>
                  </div>
                </div>
                {sharesHeld === 0 && (
                  <Link href="/dashboard/shares/buy" className="block w-full text-center bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold py-2.5 rounded-lg transition-colors">
                    Buy Shares
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contributions table */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <PanelHeader icon={<History size={16} />} title="Recent Contributions"
            action={{ label: "Pay Now →", href: "/dashboard/payments?type=monthly" }}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  {["Date", "Type", "Period", "Expected", "Paid", "Penalty", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {dbUser.contributions.length > 0 ? (
                  dbUser.contributions.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50 transition-colors text-sm">
                      <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                        {(c.paidAt ?? c.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded">
                          {contributionLabel(c.type)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-stone-500 tabular-nums">
                        {c.periodMonth && c.periodYear ? `${c.periodMonth}/${c.periodYear}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(toNum(c.expectedAmount))}</td>
                      <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(toNum(c.paidAmount))}</td>
                      <td className="px-5 py-3.5 tabular-nums">
                        {toNum(c.latePenalty) > 0
                          ? <span className="text-red-600 font-semibold">{kes(toNum(c.latePenalty))}</span>
                          : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {/* status is a plain String — no Prisma enum type */}
                        <ContributionStatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm italic">
                      No contributions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 text-right">
            <Link href="/dashboard/contributions" className="text-xs font-bold text-[#1C4A2E] hover:underline">
              View full history →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SectionHeading({ label }: { label: string }) {
  return <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">{label}</h2>;
}

function PanelHeader({ icon, title, action }: {
  icon: React.ReactNode; title: string; action?: { label: string; href: string };
}) {
  return (
    <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
      <div className="flex items-center gap-2 text-stone-700">
        <span className="text-stone-400">{icon}</span>
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
      </div>
      {action && (
        <Link href={action.href} className="text-[10px] font-bold text-[#1C4A2E] hover:underline">{action.label}</Link>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-6 py-10 text-center text-stone-400 text-sm italic">{message}</div>;
}

type AccentColor = "green" | "blue" | "amber" | "red" | "neutral";

function StatCard({ label, value, sub, icon, accent = "neutral", large = false, href }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  accent?: AccentColor; large?: boolean; href?: string;
}) {
  const accentStyles: Record<AccentColor, { icon: string; bg: string }> = {
    green:   { icon: "text-emerald-600", bg: "bg-emerald-50" },
    blue:    { icon: "text-blue-600",    bg: "bg-blue-50"    },
    amber:   { icon: "text-amber-600",   bg: "bg-amber-50"   },
    red:     { icon: "text-red-600",     bg: "bg-red-50"     },
    neutral: { icon: "text-stone-500",   bg: "bg-stone-100"  },
  };
  const { icon: iconColor, bg } = accentStyles[accent];
  const card = (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow ${large ? "col-span-2 lg:col-span-1" : ""} ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${iconColor}`}>{icon}</div>
        {href && <ChevronRight size={14} className="text-stone-300" />}
      </div>
      <div>
        <p className={`font-black tabular-nums text-stone-900 ${large ? "text-2xl" : "text-xl"}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

// status is a plain String field — typed as string, not a Prisma enum
function ContributionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:           "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING:        "bg-amber-50 text-amber-700 border-amber-200",
    OVERDUE:        "bg-red-50 text-red-700 border-red-200",
    PARTIALLY_PAID: "bg-orange-50 text-orange-700 border-orange-200",
    WAIVED:         "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}