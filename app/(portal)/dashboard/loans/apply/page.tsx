// app/(portal)/dashboard/loans/apply/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { applyForLoan, getActiveMembers } from "@/app/actions/loan-actions";
import { AlertTriangle, Loader2, Landmark, CheckCircle2 } from "lucide-react";

type Policy = { interestRate: number; interestMethod: string; maxDuration: number; minimumLoanAmount: number; maximumLoanAmount: number; requiredGuarantors: number };
type Member = { id: string; name: string; firstName: string; lastName: string; memberNumber: string };

export default function LoanApplyPage() {
  const router = useRouter();
  const [policy, setPolicy]         = useState<Policy | null>(null);
  const [members, setMembers]       = useState<Member[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [amount, setAmount]         = useState("");
  const [term, setTerm]             = useState("12");

  // Monthly instalment preview
  const preview = (() => {
    if (!policy || !amount || !term) return null;
    const p = parseFloat(amount);
    const t = parseInt(term);
    if (isNaN(p) || isNaN(t) || t === 0) return null;
    const interest = policy.interestMethod === "FLAT"
      ? p * (policy.interestRate / 100) * (t / 12)
      : p * (policy.interestRate / 100) * (t / 12); // simplified
    const total    = p + interest;
    return { monthly: total / t, total, interest };
  })();

  useEffect(() => {
    Promise.all([
      fetch("/api/loan-policy").then(r => r.json()),
      getActiveMembers(),
    ]).then(([p, m]) => { setPolicy(p); setMembers(m); }).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await applyForLoan(new FormData(e.currentTarget));
      router.push("/dashboard/loans");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-400"><Loader2 size={24} className="animate-spin mr-2"/><span className="text-sm">Loading loan policy...</span></div>;

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Apply for a Loan</h1>
        <p className="text-stone-500 text-sm mt-1">Your application will be reviewed by the Credit Committee.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5"/>{error}
        </div>
      )}

      {policy && (
        <div className="bg-[#1C4A2E]/5 border border-[#1C4A2E]/20 rounded-xl p-4">
          <p className="text-[10px] font-bold text-[#1C4A2E] uppercase tracking-wider mb-2">Current Loan Policy</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><p className="text-stone-400">Interest</p><p className="font-bold text-stone-800">{policy.interestRate}% ({policy.interestMethod})</p></div>
            <div><p className="text-stone-400">Range</p><p className="font-bold text-stone-800">KES {policy.minimumLoanAmount.toLocaleString()} – {policy.maximumLoanAmount.toLocaleString()}</p></div>
            <div><p className="text-stone-400">Max Term</p><p className="font-bold text-stone-800">{policy.maxDuration} months</p></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Landmark size={15} className="text-stone-400"/>
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">Loan Application</span>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Loan Amount (KES) *</label>
              <input type="number" name="amount" required value={amount} onChange={e => setAmount(e.target.value)}
                min={policy?.minimumLoanAmount} max={policy?.maximumLoanAmount} placeholder="e.g. 10000"
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Repayment Term *</label>
              <select name="termMonths" required value={term} onChange={e => setTerm(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]">
                {Array.from({length: policy?.maxDuration ?? 12}, (_,i) => i+1).map(m => (
                  <option key={m} value={m}>{m} month{m !== 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Loan Purpose *</label>
            <textarea name="purpose" required rows={3} placeholder="Describe clearly how you intend to use this loan (required by constitution)"
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"/>
          </div>

          {/* Guarantors */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Guarantors * (select {policy?.requiredGuarantors ?? 2} members)
            </label>
            {Array.from({ length: policy?.requiredGuarantors ?? 2 }, (_, i) => (
              <select key={i} name="guarantorId" required
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]">
                <option value="">— Guarantor {i + 1} —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName || m.name} ({m.memberNumber})</option>
                ))}
              </select>
            ))}
          </div>

          {/* Payment preview */}
          {preview && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-emerald-600"/>
                <span className="text-xs font-bold text-emerald-700">Repayment Preview</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-emerald-600/70">Monthly</p><p className="font-black text-emerald-800">KES {preview.monthly.toFixed(2)}</p></div>
                <div><p className="text-emerald-600/70">Total Interest</p><p className="font-black text-emerald-800">KES {preview.interest.toFixed(2)}</p></div>
                <div><p className="text-emerald-600/70">Total Repayable</p><p className="font-black text-emerald-800">KES {preview.total.toFixed(2)}</p></div>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            {submitting ? <><Loader2 size={16} className="animate-spin"/>Submitting...</> : "Submit Loan Application"}
          </button>
          <p className="text-[10px] text-stone-400 text-center">Your application will be reviewed by the Credit Committee. You will be notified of the decision.</p>
        </div>
      </form>
    </div>
  );
}