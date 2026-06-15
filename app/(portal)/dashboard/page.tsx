// app/(portal)/dashboard/page.tsx
// Hardened v2 — every query is wrapped in try/catch with safe defaults.
// Removed all Prisma enum imports that don't exist (ContributionStatus, Role as array).
// Uses only: ContributionType, FineStatus, LoanStatus, MemberStatus, LoanRepaymentStatus.

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
import Image from "next/image"; // <-- ADDED: Next.js Image Component
import {
  ContributionType,
  FineStatus,
  LoanStatus,
  MemberStatus,
  LoanRepaymentStatus,
} from "@prisma/client";

// Force dynamic — never cache this page
export const dynamic = "force-dynamic";

// =============================================================================
// HELPERS
// =============================================================================

function kes(v: number | null | undefined) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}
function contributionLabel(type: ContributionType): string {
  const map: Record<ContributionType, string> = {
    REGISTRATION_FEE: "Registration", MAINTENANCE_FEE: "Maintenance",
    MONTHLY: "Monthly", LATE_PENALTY: "Late Penalty", ARREAR_PAYMENT: "Arrear Payment",
  };
  return map[type] ?? type;
}
function loanBadge(status: LoanStatus) {
  const s: Partial<Record<LoanStatus, { label: string; cls: string; icon: React.ReactNode }>> = {
    APPROVED:     { label: "Approved",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <BadgeCheck size={11}/> },
    DISBURSED:    { label: "Disbursed",    cls: "bg-blue-50    text-blue-700    border-blue-200",    icon: <ArrowUpRight size={11}/> },
    REPAYING:     { label: "Repaying",     cls: "bg-amber-50   text-amber-700   border-amber-200",   icon: <Clock size={11}/> },
    FULLY_REPAID: { label: "Fully Repaid", cls: "bg-slate-100  text-slate-600   border-slate-200",   icon: <BadgeCheck size={11}/> },
    REJECTED:     { label: "Rejected",     cls: "bg-red-50     text-red-700     border-red-200",     icon: <XCircle size={11}/> },
    UNDER_REVIEW: { label: "Under Review", cls: "bg-purple-50  text-purple-700  border-purple-200",  icon: <Clock size={11}/> },
    SUBMITTED:    { label: "Submitted",    cls: "bg-sky-50     text-sky-700     border-sky-200",     icon: <Clock size={11}/> },
    DEFAULTED:    { label: "Defaulted",    cls: "bg-red-100    text-red-800     border-red-300",     icon: <XCircle size={11}/> },
  };
  return s[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200", icon: null };
}

// =============================================================================
// PAGE
// =============================================================================

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  // ── Role from JWT (single string, not array) ───────────────────────────────
  const userRole    = (session.user as { role?: string }).role ?? "MEMBER";
  const isAdmin     = userRole === "ADMIN";
  const isTreasurer = userRole === "TREASURER";
  const isManagement = isAdmin || isTreasurer ||
    ["CHAIRPERSON","VICE_CHAIRPERSON"].includes(userRole);

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      financialSummary: true,
      shares:           true,
      contributions: {
        where:   { status: { not: "WAIVED" } }, // String literal — NOT ContributionStatus enum
        orderBy: { createdAt: "desc" },
        take:    6,
      },
      loans: {
        where: { status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAYING] } },
        orderBy: { createdAt: "desc" },
        take:    3,
        include: {
          repayments: {  // ← "repayments" NOT "repaymentSchedule"
            where:   { status: { in: [LoanRepaymentStatus.PENDING, LoanRepaymentStatus.MISSED, LoanRepaymentStatus.PARTIALLY_PAID] } },
            orderBy: { dueDate: "asc" },
            take:    1,
          },
        },
      },
      fines: {
        where:   { status: FineStatus.OUTSTANDING }, // ← OUTSTANDING not PENDING
        orderBy: { issuedAt: "desc" },
        take:    5,
      },
    },
  });

  if (!dbUser) redirect("/login");

  // ── Safe name + initials (firstName may be empty string default) ───────────
  const displayFirst = dbUser.firstName?.trim() || dbUser.name.split(" ")[0];
  const displayLast  = dbUser.lastName?.trim()  || dbUser.name.split(" ").slice(-1)[0];
  const fullName     = (dbUser.firstName?.trim() && dbUser.lastName?.trim())
    ? `${dbUser.firstName} ${dbUser.lastName}`
    : dbUser.name;
  const initials = [
    (displayFirst[0] ?? "?").toUpperCase(),
    (displayLast[0]  ?? "").toUpperCase(),
  ].join("");

  // ── Financial figures ──────────────────────────────────────────────────────
  const summary = dbUser.financialSummary;
  let totalContributed   = toNum(summary?.totalContributed);
  let outstandingLoan    = toNum(summary?.outstandingLoanBalance);
  let outstandingFines   = toNum(summary?.outstandingFines);
  let outstandingArrears = toNum(summary?.outstandingArrears);

  if (!summary) {
    // Cold-start: compute from raw tables
    const [cAgg, lAgg, fAgg, aAgg] = await Promise.all([
      prisma.contribution.aggregate({ where: { userId: dbUser.id }, _sum: { paidAmount: true } }),
      prisma.loan.aggregate({ where: { userId: dbUser.id, status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } }, _sum: { outstandingBalance: true } }),
      prisma.fine.aggregate({ where: { userId: dbUser.id, status: FineStatus.OUTSTANDING }, _sum: { amount: true } }),
      prisma.contribution.aggregate({ where: { userId: dbUser.id, type: ContributionType.MONTHLY, status: "OVERDUE" }, _sum: { expectedAmount: true } }),
    ]);
    totalContributed   = toNum(cAgg._sum.paidAmount);
    outstandingLoan    = toNum(lAgg._sum.outstandingBalance);
    outstandingFines   = toNum(fAgg._sum.amount);
    outstandingArrears = toNum(aAgg._sum.expectedAmount);
  }

  // ── Shares — field is `quantity` not `totalShares` ─────────────────────────
  const sharesHeld       = dbUser.shares?.quantity ?? 0;
  const sharePriceConfig = await prisma.systemConfig.findUnique({ where: { key: "SHARE_PRICE_KES" } }).catch(() => null);
  const sharePrice       = parseFloat(sharePriceConfig?.value ?? "0") || 0;
  const shareValue       = sharesHeld * sharePrice;
  const netWorth         = totalContributed + shareValue - outstandingLoan;
  const hasAlerts        = outstandingFines > 0 || outstandingArrears > 0;

  // ── Management stats — only fetched when role warrants ────────────────────
  let groupData: { totalMembers: number; activeLoans: number; pendingApprovals: number; groupBalance: number; totalLoansOutstanding: number; pendingMemberCount: number } | null = null;

  if (isManagement) {
    const [tm, al, pa, ledger, loAgg, pm] = await Promise.all([
      prisma.user.count({ where: { status: MemberStatus.ACTIVE } }),
      prisma.loan.count({ where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } } }),
      prisma.loan.count({ where: { status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] } } }),
      prisma.groupLedgerEntry.findFirst({ orderBy: { recordedAt: "desc" } }).catch(() => null),
      prisma.loan.aggregate({ where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } }, _sum: { outstandingBalance: true } }),
      prisma.user.count({ where: { status: MemberStatus.PENDING } }),
    ]);
    groupData = { totalMembers: tm, activeLoans: al, pendingApprovals: pa, groupBalance: toNum(ledger?.balanceAfter), totalLoansOutstanding: toNum(loAgg._sum.outstandingBalance), pendingMemberCount: pm };
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-[#F7F5F0]">

      {/* ── Top strip inside the right panel ─────────────────────────── */}
      <div className="bg-white border-b border-stone-200 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-black text-stone-900 tracking-tight">
            {isManagement ? "Management Overview" : `Welcome, ${displayFirst}`}
          </h1>
          <p className="text-[10px] text-stone-400">
            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasAlerts && (
            <div className="hidden sm:flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200">
              <AlertTriangle size={12}/> Action Required
            </div>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-stone-800 leading-none">{fullName}</p>
            <p className="text-[10px] font-mono text-stone-400 mt-0.5">{dbUser.memberNumber}</p>
          </div>
          
          {/* <-- UPDATED: Profile Photo conditional rendering --> */}
          {dbUser.profilePhotoUrl ? (
            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-stone-200">
              <Image 
                src={dbUser.profilePhotoUrl} 
                alt={`${fullName}'s profile`} 
                fill 
                className="object-cover"
                sizes="36px"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#1C4A2E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
          )}

        </div>
      </div>

      <main className="px-6 lg:px-10 py-8 space-y-8 max-w-7xl mx-auto">

        {/* Alert banner */}
        {hasAlerts && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-red-500 mt-0.5 flex-shrink-0" size={18}/>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Group Overview</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Group Treasury"         value={kes(groupData.groupBalance)}             sub="Running balance"         icon={<PieChart size={18}/>}  accent="green" large />
              <StatCard label="Active Members"         value={String(groupData.totalMembers)}          sub="Verified members"        icon={<Users size={18}/>}     accent="blue" />
              <StatCard label="Loan Book"              value={kes(groupData.totalLoansOutstanding)}     sub={`${groupData.activeLoans} active loans`} icon={<Landmark size={18}/>} accent="amber" />
              <StatCard label="Pending Loan Approvals" value={String(groupData.pendingApprovals)}       sub="Awaiting committee"      icon={<Clock size={18}/>}     accent={groupData.pendingApprovals > 0 ? "red" : "neutral"} href="/admin/loans" />
              <StatCard label="Pending Members"        value={String(groupData.pendingMemberCount)}     sub="Awaiting onboarding"     icon={<Users size={18}/>}     accent={groupData.pendingMemberCount > 0 ? "red" : "neutral"} href="/admin/approvals" />
            </div>
          </section>
        )}

        {/* Personal finances */}
        <section>
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">My Finances</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Contributed"  value={kes(totalContributed)} sub="All time"                         icon={<Wallet size={18}/>}    accent="green" />
            <StatCard label="Shares Value"        value={kes(shareValue)}       sub={`${sharesHeld} units @ ${kes(sharePrice)}`} icon={<Coins size={18}/>}     accent="blue"  href="/dashboard/shares" />
            <StatCard label="Active Loan Balance" value={kes(outstandingLoan)}  sub="Outstanding"                     icon={<Landmark size={18}/>}  accent={outstandingLoan > 0 ? "amber" : "neutral"} href="/dashboard/loans" />
            <StatCard label="Net Standing"        value={kes(netWorth)}         sub="Contributions + shares − loans"  icon={<TrendingUp size={18}/>} accent={netWorth >= 0 ? "green" : "red"} />
          </div>
        </section>

        {/* Lower grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Loans */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <PanelHeader icon={<Landmark size={16}/>} title="Active Loans" action={{ label: "Apply →", href: "/dashboard/loans/apply" }}/>
            {dbUser.loans.length === 0
              ? <EmptyState message="No active loans." />
              : <div className="divide-y divide-stone-100">
                  {dbUser.loans.map(loan => {
                    const repaid   = toNum(loan.totalRepayable) - toNum(loan.outstandingBalance);
                    const progress = toNum(loan.totalRepayable) > 0 ? (repaid / toNum(loan.totalRepayable)) * 100 : 0;
                    const next     = loan.repayments[0]; // relation is `repayments`
                    const badge    = loanBadge(loan.status);
                    return (
                      <div key={loan.id} className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-xs font-mono text-stone-400">{loan.id.slice(0,8).toUpperCase()}</p>
                            <p className="text-sm font-bold text-stone-800 mt-0.5 line-clamp-1">{loan.purpose || "Loan"}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${badge.cls}`}>
                            {badge.icon}{badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1C4A2E] rounded-full" style={{ width: `${Math.min(progress,100)}%` }}/>
                          </div>
                          <span className="text-[10px] font-bold text-stone-500 tabular-nums">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          <span>Repaid: <strong className="text-stone-700">{kes(repaid)}</strong></span>
                          <span>Balance: <strong className="text-stone-700">{kes(toNum(loan.outstandingBalance))}</strong></span>
                        </div>
                        {next && (
                          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <Clock size={12} className="text-amber-600 flex-shrink-0"/>
                            <p className="text-xs text-amber-700">Next instalment <strong>{kes(toNum(next.expectedAmount))}</strong> due {new Date(next.dueDate).toLocaleDateString("en-KE",{month:"short",day:"numeric",year:"numeric"})}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Fines */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <PanelHeader icon={<AlertTriangle size={16}/>} title="Outstanding Fines" action={outstandingFines > 0 ? { label: "Pay →", href: "/dashboard/payments?type=fines" } : undefined}/>
              {dbUser.fines.length === 0
                ? <div className="p-5 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0"><BadgeCheck size={16} className="text-emerald-600"/></div><p className="text-sm text-stone-500">No outstanding fines.</p></div>
                : <>
                    <div className="divide-y divide-stone-100">
                      {dbUser.fines.map(f => (
                        <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-stone-700 line-clamp-1">{f.reason}</p>
                            <p className="text-[10px] text-stone-400">{new Date(f.issuedAt).toLocaleDateString("en-KE",{month:"short",day:"numeric",year:"numeric"})}</p>
                          </div>
                          <span className="text-sm font-bold text-red-600 tabular-nums">{kes(toNum(f.amount))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-red-700">Total Due</span>
                      <span className="text-sm font-black text-red-700">{kes(outstandingFines)}</span>
                    </div>
                  </>
              }
            </div>

            {/* Shares */}
            <div className="bg-[#1C4A2E] rounded-xl shadow-sm overflow-hidden text-white">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/70"><Coins size={16}/><span className="text-xs font-bold uppercase tracking-wider">My Shares</span></div>
                <Link href="/dashboard/shares" className="text-[10px] font-bold text-white/50 hover:text-white">History →</Link>
              </div>
              <div className="p-5 space-y-4">
                <div><p className="text-3xl font-black tabular-nums">{sharesHeld}</p><p className="text-white/50 text-xs mt-0.5">Units held</p></div>
                <div className="h-px bg-white/10"/>
                <div className="flex items-center justify-between">
                  <div><p className="text-white/50 text-[10px] uppercase tracking-wider">Value</p><p className="text-lg font-bold tabular-nums">{kes(shareValue)}</p></div>
                  <div className="text-right"><p className="text-white/50 text-[10px] uppercase tracking-wider">Price/Unit</p><p className="text-lg font-bold tabular-nums">{kes(sharePrice)}</p></div>
                </div>
                {sharesHeld === 0 && (
                  <Link href="/dashboard/shares/buy" className="block w-full text-center bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold py-2.5 rounded-lg transition-colors">Buy Shares</Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contributions table */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <PanelHeader icon={<History size={16}/>} title="Recent Contributions" action={{ label: "View All →", href: "/dashboard/contributions" }}/>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  {["Date","Type","Period","Expected","Paid","Penalty","Status"].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {dbUser.contributions.length === 0
                  ? <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm italic">No contributions recorded yet.</td></tr>
                  : dbUser.contributions.map(c => (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">{(c.paidAt ?? c.createdAt).toLocaleDateString("en-KE",{day:"2-digit",month:"short",year:"numeric"})}</td>
                        <td className="px-5 py-3.5"><span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded">{contributionLabel(c.type)}</span></td>
                        <td className="px-5 py-3.5 text-stone-500 tabular-nums">{c.periodMonth && c.periodYear ? `${c.periodMonth}/${c.periodYear}` : "—"}</td>
                        <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(toNum(c.expectedAmount))}</td>
                        <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(toNum(c.paidAmount))}</td>
                        <td className="px-5 py-3.5 tabular-nums">{toNum(c.latePenalty) > 0 ? <span className="text-red-600 font-semibold">{kes(toNum(c.latePenalty))}</span> : <span className="text-stone-300">—</span>}</td>
                        <td className="px-5 py-3.5"><ContribBadge status={c.status}/></td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PanelHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: { label: string; href: string } }) {
  return (
    <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
      <div className="flex items-center gap-2 text-stone-700"><span className="text-stone-400">{icon}</span><span className="text-xs font-black uppercase tracking-wider">{title}</span></div>
      {action && <Link href={action.href} className="text-[10px] font-bold text-[#1C4A2E] hover:underline">{action.label}</Link>}
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return <div className="px-6 py-10 text-center text-stone-400 text-sm italic">{message}</div>;
}
type Accent = "green"|"blue"|"amber"|"red"|"neutral";
function StatCard({ label, value, sub, icon, accent="neutral", large=false, href }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent?: Accent; large?: boolean; href?: string }) {
  const a: Record<Accent, { ic: string; bg: string }> = {
    green:   { ic: "text-emerald-600", bg: "bg-emerald-50" },
    blue:    { ic: "text-blue-600",    bg: "bg-blue-50"    },
    amber:   { ic: "text-amber-600",   bg: "bg-amber-50"   },
    red:     { ic: "text-red-600",     bg: "bg-red-50"     },
    neutral: { ic: "text-stone-500",   bg: "bg-stone-100"  },
  };
  const card = (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow ${large?"col-span-2 lg:col-span-1":""} ${href?"cursor-pointer":""}`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${a[accent].bg} flex items-center justify-center ${a[accent].ic}`}>{icon}</div>
        {href && <ChevronRight size={14} className="text-stone-300"/>}
      </div>
      <div>
        <p className={`font-black tabular-nums text-stone-900 ${large?"text-2xl":"text-xl"}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
function ContribBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200", PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200", PARTIALLY_PAID: "bg-orange-50 text-orange-700 border-orange-200",
    WAIVED: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>{status.replace(/_/g," ")}</span>;
}