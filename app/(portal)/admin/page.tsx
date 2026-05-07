// app/(portal)/admin/page.tsx
// AQUAMY — Admin / Management Dashboard
// Server Component — role-gated by middleware (ADMIN, TREASURER, CHAIRPERSON etc.)
// Sections:
//   1. KPI strip        — treasury, members, loans, fines
//   2. Action queue     — pending members + pending loans (time-sensitive)
//   3. Financial health — group ledger trend + contribution compliance
//   4. Loan book        — active loans table with status
//   5. Recent activity  — latest transactions across the group

import {
  Users, Landmark, AlertTriangle, TrendingUp, Clock,
  CheckCircle2, XCircle, ChevronRight, Coins,
  FileText, ShieldCheck, UserPlus, ArrowUpRight,
  BarChart2, Wallet, BadgeAlert,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoanStatus, MemberStatus, FineStatus, ContributionType } from "@prisma/client";

// =============================================================================
// HELPERS
// =============================================================================

function kes(v: number | null | undefined) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return parseFloat(String(v));
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const LOAN_STATUS_BADGE: Record<string, string> = {
  SUBMITTED:    "bg-sky-50    text-sky-700    border-sky-200",
  UNDER_REVIEW: "bg-purple-50 text-purple-700 border-purple-200",
  APPROVED:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISBURSED:    "bg-blue-50   text-blue-700   border-blue-200",
  REPAYING:     "bg-amber-50  text-amber-700  border-amber-200",
  FULLY_REPAID: "bg-slate-100 text-slate-500  border-slate-200",
  REJECTED:     "bg-red-50    text-red-700    border-red-200",
  DEFAULTED:    "bg-red-100   text-red-800    border-red-300",
};

// =============================================================================
// PAGE
// =============================================================================

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const userRole = (session.user as { role?: string }).role ?? "MEMBER";
  const MANAGEMENT_ROLES = [
    "ADMIN", "CHAIRPERSON", "VICE_CHAIRPERSON",
    "TREASURER", "SECRETARY", "AUDITOR",
    "CREDIT_COMMITTEE_MEMBER", "LOAN_OFFICER",
  ];
  if (!MANAGEMENT_ROLES.includes(userRole)) redirect("/dashboard");

  const isAdmin     = userRole === "ADMIN";
  const isTreasurer = userRole === "TREASURER" || isAdmin;

  // ==========================================================================
  // DATA FETCHING — all parallel
  // ==========================================================================

  const [
    // ── KPIs ─────────────────────────────────────────────────────────────────
    totalActiveMembers,
    totalPendingMembers,
    latestLedgerEntry,
    activeLoansAgg,
    totalFinesAgg,
    monthlyContribAgg,

    // ── Action queues ─────────────────────────────────────────────────────────
    pendingMembers,
    pendingLoans,

    // ── Contribution compliance (current month) ────────────────────────────
    currentMonthPaid,
    currentMonthExpected,

    // ── Loan book (active) ────────────────────────────────────────────────
    activeLoans,

    // ── Recent ledger entries ─────────────────────────────────────────────
    recentLedger,

    // ── Fine summary ──────────────────────────────────────────────────────
    outstandingFinesAgg,

    // ── Monthly contribution trend (last 6 months) ─────────────────────────
    recentContributions,
  ] = await Promise.all([

    prisma.user.count({ where: { status: MemberStatus.ACTIVE } }),

    prisma.user.count({ where: { status: MemberStatus.PENDING } }),

    prisma.groupLedgerEntry.findFirst({ orderBy: { recordedAt: "desc" } }),

    prisma.loan.aggregate({
      where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } },
      _sum:  { outstandingBalance: true, principal: true },
      _count: true,
    }),

    prisma.fine.aggregate({
      where: { status: FineStatus.OUTSTANDING },
      _sum:  { amount: true },
      _count: true,
    }),

    // Total contributions collected this calendar month
    prisma.contribution.aggregate({
      where: {
        type:    ContributionType.MONTHLY,
        paidAt:  {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { paidAmount: true },
    }),

    // Pending member approvals — latest 5
    prisma.user.findMany({
      where:   { status: MemberStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take:    5,
      select:  {
        id: true, name: true, firstName: true, lastName: true,
        email: true, phone: true, memberNumber: true, createdAt: true,
      },
    }),

    // Loans awaiting committee action — latest 5
    prisma.loan.findMany({
      where:   { status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] } },
      orderBy: { createdAt: "asc" },
      take:    5,
      include: {
        user: { select: { name: true, firstName: true, lastName: true, memberNumber: true } },
      },
    }),

    // Members who paid monthly this month
    prisma.contribution.count({
      where: {
        type:   ContributionType.MONTHLY,
        status: "PAID",
        periodMonth: new Date().getMonth() + 1,
        periodYear:  new Date().getFullYear(),
      },
    }),

    // Total active members = expected payers this month
    prisma.user.count({ where: { status: MemberStatus.ACTIVE } }),

    // Active loans with member info
    prisma.loan.findMany({
      where: {
        status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING, LoanStatus.APPROVED] },
      },
      orderBy: { createdAt: "desc" },
      take:    8,
      include: {
        user: { select: { name: true, firstName: true, memberNumber: true } },
        repayments: {
          where:   { status: { in: ["PENDING", "MISSED"] } },
          orderBy: { dueDate: "asc" },
          take:    1,
        },
      },
    }),

    // Last 8 ledger entries for the activity feed
    prisma.groupLedgerEntry.findMany({
      orderBy: { recordedAt: "desc" },
      take:    8,
    }),

    // Outstanding fines
    prisma.fine.aggregate({
      where: { status: FineStatus.OUTSTANDING },
      _sum:  { amount: true },
      _count: true,
    }),

    // Contributions over last 6 months for trend
    prisma.contribution.findMany({
      where: {
        type:   ContributionType.MONTHLY,
        status: "PAID",
        paidAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
      select: { paidAmount: true, periodMonth: true, periodYear: true },
    }),
  ]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const groupBalance           = toNum(latestLedgerEntry?.balanceAfter);
  const totalLoanBook          = toNum(activeLoansAgg._sum.outstandingBalance);
  const outstandingFinesTotal  = toNum(outstandingFinesAgg._sum.amount);
  const monthlyCollected       = toNum(monthlyContribAgg._sum.paidAmount);
  const complianceRate         = currentMonthExpected > 0
    ? Math.round((currentMonthPaid / currentMonthExpected) * 100) : 0;

  // Build 6-month trend buckets
  const trendMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    trendMap[key] = 0;
  }
  for (const c of recentContributions) {
    if (c.periodMonth && c.periodYear) {
      const key = `${c.periodMonth}/${c.periodYear}`;
      if (key in trendMap) trendMap[key] += toNum(c.paidAmount);
    }
  }
  const trendEntries  = Object.entries(trendMap);
  const trendMax      = Math.max(...trendEntries.map(([, v]) => v), 1);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const adminName = session.user.name ?? "Admin";

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C4A2E] flex items-center justify-center">
            <span className="text-white text-xs font-black tracking-tighter">AQ</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">AQUAMY</p>
            <p className="text-xs text-stone-500 leading-none mt-0.5">Management Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick nav pills */}
          {[
            { label: "Approvals", href: "/admin/approvals", count: totalPendingMembers, color: "amber" },
            { label: "Loan Review", href: "/admin/loans", count: pendingLoans.length, color: "purple" },
          ].map(({ label, href, count, color }) => count > 0 ? (
            <Link key={href} href={href}
              className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors
                ${color === "amber"
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"}`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black
                ${color === "amber" ? "bg-amber-200 text-amber-800" : "bg-purple-200 text-purple-800"}`}>
                {count}
              </span>
              {label}
            </Link>
          ) : null)}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-stone-800 leading-none">{adminName}</p>
            <p className="text-[10px] text-stone-400 mt-0.5 capitalize">{userRole.replace(/_/g, " ").toLowerCase()}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#1C4A2E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {adminName[0]?.toUpperCase() ?? "A"}
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-10 py-8 space-y-8 max-w-7xl mx-auto">

        {/* ── Page title ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-stone-900 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/data-entry"
              className="flex items-center gap-1.5 text-xs font-bold bg-[#1C4A2E] text-white px-4 py-2 rounded-lg hover:bg-[#153822] transition-colors">
              <FileText size={13} /> Record Entry
            </Link>
            <Link href="/admin/codes"
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-stone-700 border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors">
              <ShieldCheck size={13} /> Invite Codes
            </Link>
          </div>
        </div>

        {/* ── KPI Strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Group Treasury"
            value={kes(groupBalance)}
            sub="Running balance"
            icon={<Wallet size={18} />}
            accent="green"
            href="/admin/reports"
          />
          <KpiCard
            label="Active Members"
            value={totalActiveMembers.toString()}
            sub={totalPendingMembers > 0 ? `${totalPendingMembers} pending approval` : "All verified"}
            icon={<Users size={18} />}
            accent={totalPendingMembers > 0 ? "amber" : "blue"}
            href="/admin/approvals"
          />
          <KpiCard
            label="Loan Book"
            value={kes(totalLoanBook)}
            sub={`${activeLoansAgg._count} active loan${activeLoansAgg._count !== 1 ? "s" : ""}`}
            icon={<Landmark size={18} />}
            accent="blue"
            href="/admin/loans"
          />
          <KpiCard
            label="Outstanding Fines"
            value={kes(outstandingFinesTotal)}
            sub={`${outstandingFinesAgg._count} unpaid fine${outstandingFinesAgg._count !== 1 ? "s" : ""}`}
            icon={<AlertTriangle size={18} />}
            accent={outstandingFinesAgg._count > 0 ? "red" : "neutral"}
          />
        </div>

        {/* ── Secondary KPIs ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Monthly compliance gauge */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-stone-500">
                <BarChart2 size={15} />
                <span className="text-[10px] font-black uppercase tracking-wider">Monthly Compliance</span>
              </div>
              <span className="text-[10px] font-bold text-stone-400">
                {new Date().toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-black text-stone-900">{complianceRate}%</p>
              <p className="text-xs text-stone-400 mb-1">
                {currentMonthPaid} of {currentMonthExpected} members paid
              </p>
            </div>
            <div className="mt-3 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${complianceRate >= 80 ? "bg-emerald-500" : complianceRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${complianceRate}%` }}
              />
            </div>
          </div>

          {/* This month collected */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-stone-500 mb-3">
              <Coins size={15} />
              <span className="text-[10px] font-black uppercase tracking-wider">Collected This Month</span>
            </div>
            <p className="text-3xl font-black text-stone-900">{kes(monthlyCollected)}</p>
            <p className="text-xs text-stone-400 mt-1">Monthly contributions only</p>
          </div>

          {/* Loan vs Treasury ratio */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-stone-500 mb-3">
              <TrendingUp size={15} />
              <span className="text-[10px] font-black uppercase tracking-wider">Loan / Treasury Ratio</span>
            </div>
            {groupBalance > 0 ? (
              <>
                <p className="text-3xl font-black text-stone-900">
                  {Math.round((totalLoanBook / (groupBalance + totalLoanBook)) * 100)}%
                </p>
                <p className="text-xs text-stone-400 mt-1">of capital is deployed in loans</p>
                <div className="mt-3 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1C4A2E] transition-all"
                    style={{ width: `${Math.min(Math.round((totalLoanBook / (groupBalance + totalLoanBook)) * 100), 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-400 mt-1 italic">No ledger data yet</p>
            )}
          </div>
        </div>

        {/* ── Action Queue ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pending Members */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <SectionHeader
              icon={<UserPlus size={15} />}
              title="Pending Member Approvals"
              count={totalPendingMembers}
              countColor="amber"
              href="/admin/approvals"
              linkLabel="View All →"
            />
            {pendingMembers.length === 0 ? (
              <EmptyQueue icon={<CheckCircle2 size={32} />} message="No pending approvals" color="emerald" />
            ) : (
              <div className="divide-y divide-stone-100">
                {pendingMembers.map((m) => {
                  const displayName = m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
                  const initials    = (m.firstName?.[0] ?? m.name[0]).toUpperCase() + (m.lastName?.[0] ?? "").toUpperCase();
                  return (
                    <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{displayName}</p>
                          <p className="text-[10px] font-mono text-stone-400">{m.memberNumber} · {timeAgo(new Date(m.createdAt))}</p>
                        </div>
                      </div>
                      <Link href="/admin/approvals"
                        className="flex-shrink-0 text-[10px] font-bold text-[#1C4A2E] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap">
                        Review →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Loan Applications */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <SectionHeader
              icon={<Landmark size={15} />}
              title="Loans Awaiting Review"
              count={pendingLoans.length}
              countColor="purple"
              href="/admin/loans"
              linkLabel="View All →"
            />
            {pendingLoans.length === 0 ? (
              <EmptyQueue icon={<CheckCircle2 size={32} />} message="No loans pending review" color="emerald" />
            ) : (
              <div className="divide-y divide-stone-100">
                {pendingLoans.map((loan) => {
                  const memberName = loan.user.firstName
                    ? `${loan.user.firstName}`
                    : loan.user.name;
                  return (
                    <div key={loan.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-800 truncate">{memberName}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${LOAN_STATUS_BADGE[loan.status] ?? ""}`}>
                            {loan.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 mt-0.5 truncate">
                          {kes(loan.principal)} · {loan.purpose || "No purpose stated"} · {timeAgo(new Date(loan.createdAt))}
                        </p>
                      </div>
                      <Link href="/admin/loans"
                        className="flex-shrink-0 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap">
                        Review →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom grid: Loan Book + Trend + Activity ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active Loan Book table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <SectionHeader
              icon={<Landmark size={15} />}
              title="Active Loan Book"
              href="/admin/loans"
              linkLabel="Full Register →"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    {["Member", "Principal", "Outstanding", "Status", "Next Due"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {activeLoans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-stone-400 text-sm italic">No active loans</td>
                    </tr>
                  ) : (
                    activeLoans.map((loan) => {
                      const memberName = loan.user.firstName ?? loan.user.name;
                      const nextDue    = loan.repayments[0];
                      const progress   = loan.totalRepayable > 0
                        ? Math.round(((loan.totalRepayable - loan.outstandingBalance) / loan.totalRepayable) * 100)
                        : 0;

                      return (
                        <tr key={loan.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-stone-800">{memberName}</p>
                            <p className="text-[10px] font-mono text-stone-400">{loan.user.memberNumber}</p>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-stone-600">{kes(loan.principal)}</td>
                          <td className="px-4 py-3">
                            <p className="tabular-nums font-semibold text-stone-800">{kes(loan.outstandingBalance)}</p>
                            <div className="mt-1 w-16 h-1 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#1C4A2E] rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${LOAN_STATUS_BADGE[loan.status] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}>
                              {loan.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500">
                            {nextDue
                              ? <span className={nextDue.status === "MISSED" ? "text-red-600 font-semibold" : ""}>
                                  {new Date(nextDue.dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                                  {nextDue.status === "MISSED" && " ⚠"}
                                </span>
                              : <span className="text-stone-300">—</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">

            {/* 6-month contribution trend */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex-1">
              <div className="flex items-center gap-2 text-stone-500 mb-4">
                <TrendingUp size={15} />
                <span className="text-[10px] font-black uppercase tracking-wider">6-Month Contribution Trend</span>
              </div>
              <div className="flex items-end gap-1.5 h-28">
                {trendEntries.map(([month, amount]) => {
                  const heightPct = trendMax > 0 ? (amount / trendMax) * 100 : 0;
                  const isCurrentMonth = month === `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
                  return (
                    <div key={month} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full flex items-end" style={{ height: "80px" }}>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isCurrentMonth ? "bg-[#1C4A2E]" : "bg-stone-200"}`}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-stone-400 font-medium tabular-nums">
                        {month.split("/")[0]}/{String(month.split("/")[1]).slice(-2)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                <span>Lowest: {kes(Math.min(...trendEntries.map(([, v]) => v)))}</span>
                <span>Highest: {kes(trendMax)}</span>
              </div>
            </div>

            {/* Recent activity feed */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
                <ArrowUpRight size={15} className="text-stone-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-700">Recent Activity</span>
              </div>
              {recentLedger.length === 0 ? (
                <div className="px-5 py-8 text-center text-stone-400 text-xs italic">No transactions yet</div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {recentLedger.map((entry) => (
                    <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-stone-700 truncate">{entry.description}</p>
                        <p className="text-[10px] text-stone-400">{timeAgo(new Date(entry.recordedAt))}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${entry.isCredit ? "text-emerald-600" : "text-red-600"}`}>
                        {entry.isCredit ? "+" : "−"}{kes(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Quick links grid ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Approvals",   href: "/admin/approvals",  icon: <UserPlus size={18} />,    color: "bg-amber-50  text-amber-700  border-amber-200",  badge: totalPendingMembers },
              { label: "Loan Review", href: "/admin/loans",      icon: <Landmark size={18} />,    color: "bg-purple-50 text-purple-700 border-purple-200", badge: pendingLoans.length },
              { label: "Data Entry",  href: "/admin/data-entry", icon: <FileText size={18} />,    color: "bg-blue-50   text-blue-700   border-blue-200" },
              { label: "Members",     href: "/admin/members",    icon: <Users size={18} />,       color: "bg-stone-50  text-stone-700  border-stone-200" },
              { label: "Invite Codes",href: "/admin/codes",      icon: <ShieldCheck size={18} />, color: "bg-stone-50  text-stone-700  border-stone-200" },
              { label: "Reports",     href: "/admin/reports",    icon: <BarChart2 size={18} />,   color: "bg-stone-50  text-stone-700  border-stone-200" },
            ].map(({ label, href, icon, color, badge }) => (
              <Link key={href} href={href}
                className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-center font-bold text-xs transition-all hover:shadow-sm ${color}`}>
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                )}
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function KpiCard({ label, value, sub, icon, accent, href }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string; href?: string;
}) {
  const accents: Record<string, { icon: string; bg: string }> = {
    green:   { icon: "text-emerald-600", bg: "bg-emerald-50" },
    blue:    { icon: "text-blue-600",    bg: "bg-blue-50"    },
    amber:   { icon: "text-amber-600",   bg: "bg-amber-50"   },
    red:     { icon: "text-red-600",     bg: "bg-red-50"     },
    neutral: { icon: "text-stone-500",   bg: "bg-stone-100"  },
  };
  const { icon: ic, bg } = accents[accent] ?? accents.neutral;
  const card = (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${ic}`}>{icon}</div>
        {href && <ChevronRight size={14} className="text-stone-300" />}
      </div>
      <div>
        <p className="text-xl font-black tabular-nums text-stone-900">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SectionHeader({ icon, title, count, countColor, href, linkLabel }: {
  icon: React.ReactNode; title: string;
  count?: number; countColor?: "amber" | "purple" | "red";
  href?: string; linkLabel?: string;
}) {
  const countStyles = {
    amber:  "bg-amber-100  text-amber-800",
    purple: "bg-purple-100 text-purple-800",
    red:    "bg-red-100    text-red-800",
  };
  return (
    <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
      <div className="flex items-center gap-2 text-stone-700">
        <span className="text-stone-400">{icon}</span>
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
        {count != null && count > 0 && (
          <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ${countStyles[countColor ?? "amber"]}`}>
            {count}
          </span>
        )}
      </div>
      {href && linkLabel && (
        <Link href={href} className="text-[10px] font-bold text-[#1C4A2E] hover:underline">{linkLabel}</Link>
      )}
    </div>
  );
}

function EmptyQueue({ icon, message, color }: { icon: React.ReactNode; message: string; color: string }) {
  return (
    <div className={`px-5 py-8 flex items-center gap-3 text-${color}-600`}>
      <div className={`w-10 h-10 rounded-full bg-${color}-50 flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <p className="text-sm text-stone-500">{message}</p>
    </div>
  );
}