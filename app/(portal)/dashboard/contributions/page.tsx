// app/(portal)/dashboard/contributions/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ContributionType } from "@prisma/client";
import Link from "next/link";
import {
  Wallet, CheckCircle2, AlertTriangle,
  Clock, CreditCard, ArrowUpRight,
} from "lucide-react";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const TYPE_LABELS: Record<ContributionType, string> = {
  REGISTRATION_FEE: "Registration",
  MAINTENANCE_FEE:  "Maintenance",
  MONTHLY:          "Monthly",
  LATE_PENALTY:     "Late Penalty",
  ARREAR_PAYMENT:   "Arrear Payment",
};

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  PAID:           { label: "Paid",           classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING:        { label: "Pending",        classes: "bg-amber-50   text-amber-700   border-amber-200"   },
  OVERDUE:        { label: "Overdue",        classes: "bg-red-50     text-red-700     border-red-200"     },
  PARTIALLY_PAID: { label: "Partial",        classes: "bg-orange-50  text-orange-700  border-orange-200"  },
  WAIVED:         { label: "Waived",         classes: "bg-slate-100  text-slate-500   border-slate-200"   },
};

// Build the payment URL with pre-filled query params
function buildPaymentUrl(type: ContributionType, month?: number | null, year?: number | null, amount?: number) {
  const params = new URLSearchParams();
  params.set("type", type === ContributionType.MONTHLY ? "monthly" : "contribution");
  if (month) params.set("month", String(month));
  if (year)  params.set("year",  String(year));
  if (amount) params.set("amount", String(amount));
  return `/dashboard/payments?${params.toString()}`;
}

export default async function ContributionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true, memberNumber: true, createdAt: true },
  });
  if (!dbUser) redirect("/login");

  // Fetch all contributions + fee schedule in parallel
  const [contributions, summary, feeConfig] = await Promise.all([
    prisma.contribution.findMany({
      where:   { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
    }),

    prisma.memberFinancialSummary.findUnique({
      where: { userId: dbUser.id },
    }),

    prisma.systemConfig.findMany({
      where: {
        key: { in: [
          "MONTHLY_CONTRIBUTION_KES",
          "LATE_PENALTY_KES",
          "REGISTRATION_FEE_KES",
          "MAINTENANCE_FEE_KES",
        ]},
      },
    }),
  ]);

  // Build fee map for quick lookup
  const fees = Object.fromEntries(feeConfig.map(c => [c.key, parseFloat(c.value)]));
  const monthlyFee = fees["MONTHLY_CONTRIBUTION_KES"] ?? 500;

  // ── Summary figures ────────────────────────────────────────────────────────
  const totalPaid      = contributions.reduce((s, c) => s + c.paidAmount, 0);
  const totalOutstanding = contributions
    .filter(c => c.status === "PENDING" || c.status === "OVERDUE" || c.status === "PARTIALLY_PAID")
    .reduce((s, c) => s + Math.max(c.expectedAmount - c.paidAmount, 0), 0);
  const totalPenalties = contributions.reduce((s, c) => s + c.latePenalty, 0);

  // ── Detect unpaid months (for "Pay Outstanding" quick actions) ────────────
  const now          = new Date();
  const joinMonth    = new Date(dbUser.createdAt);
  const paidMonthSet = new Set(
    contributions
      .filter(c => c.type === ContributionType.MONTHLY && c.status === "PAID")
      .map(c => `${c.periodYear}-${c.periodMonth}`)
  );

  // Build list of months from joining to today that are unpaid
  const unpaidMonths: { month: number; year: number; label: string }[] = [];
  const cursor = new Date(joinMonth.getFullYear(), joinMonth.getMonth(), 1);
  const endOf  = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= endOf && unpaidMonths.length < 6) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    if (!paidMonthSet.has(`${y}-${m}`)) {
      unpaidMonths.push({
        month: m, year: y,
        label: cursor.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const hasOutstanding = totalOutstanding > 0 || unpaidMonths.length > 0;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            My Contributions
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Payment history and outstanding balances — {dbUser.memberNumber}
          </p>
        </div>
        <Link href="/dashboard/payments"
          className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <CreditCard size={15} /> Make a Payment
        </Link>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-black text-stone-900">{kes(totalPaid)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">
              Total Paid
            </p>
          </div>
        </div>

        <div className={`bg-white rounded-xl border shadow-sm p-5 flex items-center gap-4
          ${totalOutstanding > 0 ? "border-red-200" : "border-stone-200"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${totalOutstanding > 0 ? "bg-red-50" : "bg-stone-100"}`}>
            <AlertTriangle size={18} className={totalOutstanding > 0 ? "text-red-500" : "text-stone-400"} />
          </div>
          <div>
            <p className={`text-xl font-black ${totalOutstanding > 0 ? "text-red-700" : "text-stone-900"}`}>
              {kes(totalOutstanding)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">
              Outstanding
            </p>
          </div>
          {totalOutstanding > 0 && (
            <Link href="/dashboard/payments"
              className="ml-auto flex-shrink-0 text-xs font-bold text-red-600 hover:underline">
              Pay →
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-black text-stone-900">{kes(totalPenalties)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">
              Penalties Incurred
            </p>
          </div>
        </div>
      </div>

      {/* ── Unpaid months — quick pay buttons ─────────────────────────────── */}
      {unpaidMonths.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-600" />
            <p className="text-sm font-bold text-amber-800">
              {unpaidMonths.length} month{unpaidMonths.length > 1 ? "s" : ""} unpaid
            </p>
            <span className="text-xs text-amber-600">— KES 500 each</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {unpaidMonths.map(({ month, year, label }) => (
              <Link
                key={`${year}-${month}`}
                href={buildPaymentUrl(ContributionType.MONTHLY, month, year, monthlyFee)}
                className="flex items-center gap-1.5 bg-white border border-amber-200 hover:border-[#1C4A2E] hover:bg-[#1C4A2E] hover:text-white text-amber-800 text-xs font-bold px-3 py-2 rounded-lg transition-all group"
              >
                <CreditCard size={12} className="group-hover:text-white" />
                {label}
              </Link>
            ))}

            {/* Pay all outstanding at once */}
            {unpaidMonths.length > 1 && (
              <Link
                href={`/dashboard/payments?type=monthly&amount=${unpaidMonths.length * monthlyFee}`}
                className="flex items-center gap-1.5 bg-[#1C4A2E] hover:bg-[#153822] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                <ArrowUpRight size={12} />
                Pay All ({kes(unpaidMonths.length * monthlyFee)})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Full contributions table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-stone-400" />
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">
              All Contributions ({contributions.length})
            </span>
          </div>
        </div>

        {contributions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Wallet size={36} className="text-stone-200 mx-auto mb-4" />
            <p className="text-stone-500 text-sm font-medium">No contributions recorded yet.</p>
            <p className="text-stone-400 text-xs mt-1">
              Your payments will appear here once recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  {["Date", "Type", "Period", "Expected", "Paid", "Penalty", "Status", ""].map(h => (
                    <th key={h}
                      className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {contributions.map(c => {
                  const badge    = STATUS_BADGE[c.status] ?? STATUS_BADGE.PENDING;
                  const balance  = Math.max(c.expectedAmount - c.paidAmount, 0);
                  const canPay   = c.status !== "PAID" && c.status !== "WAIVED" && balance > 0;

                  return (
                    <tr key={c.id} className="hover:bg-stone-50 transition-colors">

                      {/* Date */}
                      <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                        {(c.paidAt ?? c.createdAt).toLocaleDateString("en-KE", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded">
                          {TYPE_LABELS[c.type]}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="px-5 py-3.5 text-stone-500 tabular-nums text-xs">
                        {c.periodMonth && c.periodYear
                          ? new Date(c.periodYear, c.periodMonth - 1).toLocaleDateString("en-KE", {
                              month: "short", year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Expected */}
                      <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">
                        {kes(c.expectedAmount)}
                      </td>

                      {/* Paid */}
                      <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">
                        {kes(c.paidAmount)}
                      </td>

                      {/* Penalty */}
                      <td className="px-5 py-3.5 tabular-nums">
                        {c.latePenalty > 0
                          ? <span className="text-red-600 font-semibold">{kes(c.latePenalty)}</span>
                          : <span className="text-stone-300">—</span>}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* ── Pay Now button — only shown when balance > 0 ─── */}
                      <td className="px-5 py-3.5">
                        {canPay ? (
                          <Link
                            href={buildPaymentUrl(c.type, c.periodMonth, c.periodYear, balance)}
                            className="flex items-center gap-1.5 bg-[#1C4A2E] hover:bg-[#153822] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <CreditCard size={11} />
                            Pay {kes(balance)}
                          </Link>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}