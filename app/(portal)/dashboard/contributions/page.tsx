// app/(portal)/dashboard/contributions/page.tsx — v3
// Each unpaid row has an inline M-Pesa payment form.
"use client";

import { useEffect, useState, useRef } from "react";
import {
  initiateContributionPayment,
} from "@/app/actions/mpesa-actions";
import {
  Wallet, CheckCircle2, AlertTriangle, Clock,
  CreditCard, Smartphone, Loader2, X, ChevronDown,
} from "lucide-react";

type Contribution = {
  id:             string;
  type:           string;
  status:         string;
  expectedAmount: number;
  paidAmount:     number;
  latePenalty:    number;
  periodMonth:    number | null;
  periodYear:     number | null;
  paidAt:         string | null;
  createdAt:      string;
};

const TYPE_LABELS: Record<string, string> = {
  REGISTRATION_FEE: "Registration",
  MAINTENANCE_FEE:  "Maintenance",
  MONTHLY:          "Monthly",
  LATE_PENALTY:     "Late Penalty",
  ARREAR_PAYMENT:   "Arrear Payment",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PAID:           { label: "Paid",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING:        { label: "Pending", cls: "bg-amber-50   text-amber-700   border-amber-200"   },
  OVERDUE:        { label: "Overdue", cls: "bg-red-50     text-red-700     border-red-200"     },
  PARTIALLY_PAID: { label: "Partial", cls: "bg-orange-50  text-orange-700  border-orange-200"  },
  WAIVED:         { label: "Waived",  cls: "bg-slate-100  text-slate-500   border-slate-200"   },
};

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

// ── Inline payment form per row ───────────────────────────────────────────────
function PayButton({
  contribution,
  defaultPhone,
}: {
  contribution: Contribution;
  defaultPhone: string;
}) {
  const balance = Math.max(contribution.expectedAmount - contribution.paidAmount, 0);
  const [open,       setOpen]       = useState(false);
  const [phone,      setPhone]      = useState(defaultPhone);
  const [amount,     setAmount]     = useState(balance.toFixed(0));
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<{ ok: boolean; msg: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (balance <= 0) return null;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    const res = await initiateContributionPayment(
      contribution.id,
      phone,
      parseFloat(amount)
    );
    setResult({ ok: res.success, msg: res.message });
    if (res.success) setTimeout(() => setOpen(false), 3000);
    setLoading(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setResult(null); }}
        className="flex items-center gap-1.5 bg-[#1C4A2E] hover:bg-[#153822] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        <CreditCard size={11} />
        Pay {kes(balance)}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-72 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone size={13} className="text-stone-400" />
              <span className="text-xs font-black uppercase tracking-wider text-stone-700">Pay via M-Pesa</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600">
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handlePay} className="p-4 space-y-3">
            {/* What is being paid */}
            <div className="bg-stone-50 rounded-lg p-2.5 text-xs">
              <p className="text-stone-500">
                {TYPE_LABELS[contribution.type] ?? contribution.type}
                {contribution.periodMonth && contribution.periodYear
                  ? ` — ${new Date(contribution.periodYear, contribution.periodMonth - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}`
                  : ""}
              </p>
              <p className="font-black text-stone-900 mt-0.5">Outstanding: {kes(balance)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                M-Pesa Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                required
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Amount (KES)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-semibold">KES</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="1"
                  max={balance}
                  required
                  className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
                />
              </div>
              <p className="text-[10px] text-stone-400">Max: {kes(balance)}</p>
            </div>

            {result && (
              <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs
                ${result.ok
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"}`}>
                {result.ok
                  ? <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />
                  : <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />}
                {result.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-2.5 rounded-lg transition-colors text-xs"
            >
              {loading
                ? <><Loader2 size={13} className="animate-spin" /> Sending STK Push...</>
                : <><Smartphone size={13} /> Pay KES {parseFloat(amount || "0").toLocaleString()} via M-Pesa</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [userPhone,     setUserPhone]     = useState("");
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/member/contributions").then(r => r.json()),
      fetch("/api/auth/session").then(r => r.json()),
    ]).then(([contribs, session]) => {
      setContributions(contribs);
      // Pre-fill phone from session if available; user can override
      setUserPhone(session?.user?.phone ?? "");
    }).finally(() => setLoading(false));
  }, []);

  const totalPaid    = contributions.reduce((s, c) => s + c.paidAmount, 0);
  const totalOutstanding = contributions
    .filter(c => !["PAID","WAIVED"].includes(c.status))
    .reduce((s, c) => s + Math.max(c.expectedAmount - c.paidAmount, 0), 0);
  const totalPenalties = contributions.reduce((s, c) => s + c.latePenalty, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Loading contributions...
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">My Contributions</h1>
        <p className="text-stone-500 text-sm mt-1">Payment history and outstanding balances.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Paid",       value: kes(totalPaid),       icon: <CheckCircle2 size={18}/>, color: "text-emerald-600 bg-emerald-50" },
          { label: "Outstanding",      value: kes(totalOutstanding), icon: <AlertTriangle size={18}/>, color: totalOutstanding > 0 ? "text-red-500 bg-red-50" : "text-stone-400 bg-stone-100" },
          { label: "Total Penalties",  value: kes(totalPenalties),  icon: <Clock size={18}/>,       color: "text-amber-600 bg-amber-50" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
            <div>
              <p className="text-xl font-black text-stone-900">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contributions table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Wallet size={15} className="text-stone-400" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">
            All Contributions ({contributions.length})
          </span>
        </div>

        {contributions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Wallet size={36} className="text-stone-200 mx-auto mb-4" />
            <p className="text-stone-500 text-sm">No contributions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  {["Date","Type","Period","Expected","Paid","Penalty","Status",""].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {contributions.map(c => {
                  const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3.5 text-stone-500 whitespace-nowrap text-xs">
                        {new Date(c.paidAt ?? c.createdAt).toLocaleDateString("en-KE", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-1 rounded">
                          {TYPE_LABELS[c.type] ?? c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-stone-500 text-xs">
                        {c.periodMonth && c.periodYear
                          ? new Date(c.periodYear, c.periodMonth - 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(c.expectedAmount)}</td>
                      <td className="px-4 py-3.5 font-semibold text-stone-700 tabular-nums">{kes(c.paidAmount)}</td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {c.latePenalty > 0
                          ? <span className="text-red-600 font-semibold">{kes(c.latePenalty)}</span>
                          : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {!["PAID","WAIVED"].includes(c.status) && (
                          <PayButton contribution={c} defaultPhone={userPhone} />
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