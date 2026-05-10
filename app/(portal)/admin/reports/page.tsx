// app/(portal)/admin/reports/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { LoanStatus, MemberStatus, FineStatus } from "@prisma/client";
import { BarChart2, Download } from "lucide-react";

function kes(v: number) { return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`; }

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);

  const [
    totalMembers, totalContribAgg, totalLoansAgg, totalFinesAgg,
    latestLedger, yearContribs, loanStatusCounts, monthlyBreakdown,
  ] = await Promise.all([
    prisma.user.count({ where: { status: MemberStatus.ACTIVE } }),
    prisma.contribution.aggregate({ where: { paidAt: { gte: yearStart } }, _sum: { paidAmount: true } }),
    prisma.loan.aggregate({ where: { status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] } }, _sum: { outstandingBalance: true, principal: true }, _count: true }),
    prisma.fine.aggregate({ where: { status: FineStatus.OUTSTANDING }, _sum: { amount: true }, _count: true }),
    prisma.groupLedgerEntry.findFirst({ orderBy: { recordedAt: "desc" } }),
    prisma.contribution.aggregate({ where: { paidAt: { gte: yearStart } }, _sum: { paidAmount: true, latePenalty: true } }),
    prisma.loan.groupBy({ by: ["status"], _count: { id: true } }),
    // Monthly totals for the year
    prisma.$queryRaw<{ month: number; total: number }[]>`
      SELECT EXTRACT(MONTH FROM "paidAt")::int AS month, SUM("paidAmount")::float AS total
      FROM "Contribution"
      WHERE "paidAt" >= ${yearStart} AND "paidAt" IS NOT NULL
      GROUP BY month ORDER BY month
    `,
  ]);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthData = months.map((label, i) => ({
    label,
    total: monthlyBreakdown.find(r => r.month === i + 1)?.total ?? 0,
  }));
  const maxMonth = Math.max(...monthData.map(m => m.total), 1);

  const loanStatusMap = Object.fromEntries(loanStatusCounts.map(l => [l.status, l._count.id]));

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Financial Reports</h1>
          <p className="text-stone-500 text-sm mt-1">{year} Annual Summary — AQUAMY</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 bg-white border border-stone-200 px-3 py-2 rounded-lg cursor-not-allowed opacity-50">
          <Download size={13}/> Export PDF
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Group Treasury",           value: kes(latestLedger?.balanceAfter ?? 0),         sub: "Running balance" },
          { label: "Contributions YTD",        value: kes(yearContribs._sum.paidAmount ?? 0),       sub: `${year} total collected` },
          { label: "Active Loan Book",         value: kes(totalLoansAgg._sum.outstandingBalance ?? 0), sub: `${totalLoansAgg._count} active loans` },
          { label: "Outstanding Fines",        value: kes(totalFinesAgg._sum.amount ?? 0),           sub: `${totalFinesAgg._count} unpaid` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <p className="text-xl font-black text-stone-900 tabular-nums">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{label}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={15} className="text-stone-400"/>
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">Monthly Contributions — {year}</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {monthData.map(({ label, total }) => {
            const height = (total / maxMonth) * 100;
            const isCurrent = label === months[new Date().getMonth()];
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-stone-500 tabular-nums font-medium">
                  {total > 0 ? `${(total/1000).toFixed(0)}k` : ""}
                </span>
                <div className="w-full flex items-end" style={{ height: "100px" }}>
                  <div className={`w-full rounded-t-sm transition-all ${isCurrent ? "bg-[#1C4A2E]" : "bg-stone-200"}`}
                    style={{ height: `${Math.max(height, total > 0 ? 4 : 0)}%` }}/>
                </div>
                <span className="text-[9px] text-stone-400 font-medium">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loan status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <p className="text-xs font-black uppercase tracking-wider text-stone-700 mb-4">Loan Status Breakdown</p>
          <div className="space-y-3">
            {Object.entries(loanStatusMap).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-xs text-stone-600">{status.replace(/_/g," ")}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1C4A2E] rounded-full"
                      style={{ width: `${(count / Math.max(...Object.values(loanStatusMap))) * 100}%` }}/>
                  </div>
                  <span className="text-xs font-bold text-stone-700 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <p className="text-xs font-black uppercase tracking-wider text-stone-700 mb-4">Year Summary</p>
          <div className="space-y-3 text-sm">
            {[
              ["Active Members",         totalMembers,                                       ""],
              ["Total Contributions",    kes(yearContribs._sum.paidAmount ?? 0),             ""],
              ["Late Penalties Collected", kes(yearContribs._sum.latePenalty ?? 0),          ""],
              ["Loans Issued",           totalLoansAgg._count,                               "active"],
              ["Outstanding Loan Book",  kes(totalLoansAgg._sum.outstandingBalance ?? 0),   ""],
              ["Outstanding Fines",      kes(totalFinesAgg._sum.amount ?? 0),               ""],
            ].map(([label, value, unit]) => (
              <div key={String(label)} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                <span className="text-stone-500">{label}</span>
                <span className="font-bold text-stone-800">{value} {unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}