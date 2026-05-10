// app/(portal)/dashboard/contributions/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ContributionType } from "@prisma/client";
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  PAID:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:        "bg-amber-50   text-amber-700   border-amber-200",
  OVERDUE:        "bg-red-50     text-red-700     border-red-200",
  PARTIALLY_PAID: "bg-orange-50  text-orange-700  border-orange-200",
  WAIVED:         "bg-slate-100  text-slate-500   border-slate-200",
};

const TYPE_LABELS: Record<ContributionType, string> = {
  REGISTRATION_FEE: "Registration",
  MAINTENANCE_FEE:  "Maintenance",
  MONTHLY:          "Monthly",
  LATE_PENALTY:     "Late Penalty",
  ARREAR_PAYMENT:   "Arrear Payment",
};

export default async function ContributionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, memberNumber: true },
  });
  if (!dbUser) redirect("/login");

  const [contributions, summary] = await Promise.all([
    prisma.contribution.findMany({
      where:   { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.memberFinancialSummary.findUnique({ where: { userId: dbUser.id } }),
  ]);

  const totalPaid    = contributions.filter(c => c.status === "PAID").reduce((s, c) => s + c.paidAmount, 0);
  const totalPending = contributions.filter(c => c.status === "PENDING" || c.status === "OVERDUE").reduce((s, c) => s + (c.expectedAmount - c.paidAmount), 0);
  const totalPenalty = contributions.reduce((s, c) => s + c.latePenalty, 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">My Contributions</h1>
        <p className="text-stone-500 text-sm mt-1">Full payment history — {dbUser.memberNumber}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Paid",       value: kes(totalPaid),    icon: <CheckCircle2 size={16} />, color: "text-emerald-600 bg-emerald-50" },
          { label: "Outstanding",      value: kes(totalPending), icon: <AlertTriangle size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Penalties Paid",   value: kes(totalPenalty), icon: <TrendingUp size={16} />, color: "text-red-500 bg-red-50" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
            <div>
              <p className="text-lg font-black text-stone-900">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Wallet size={15} className="text-stone-400" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">
            All Contributions ({contributions.length})
          </span>
        </div>
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
              {contributions.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 italic text-sm">No contributions recorded yet.</td></tr>
              ) : contributions.map(c => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                    {(c.paidAt ?? c.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded">
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 tabular-nums">
                    {c.periodMonth && c.periodYear ? `${c.periodMonth}/${c.periodYear}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(c.expectedAmount)}</td>
                  <td className="px-5 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(c.paidAmount)}</td>
                  <td className="px-5 py-3.5 tabular-nums">
                    {c.latePenalty > 0
                      ? <span className="text-red-600 font-semibold">{kes(c.latePenalty)}</span>
                      : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {c.status.replace("_"," ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}