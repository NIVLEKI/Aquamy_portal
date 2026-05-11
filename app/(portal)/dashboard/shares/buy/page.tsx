// app/(portal)/dashboard/shares/buy/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buyShares } from "@/app/actions/shares-actions";
import { Coins, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function BuySharesPage() {
  const router = useRouter();
  const [sharePrice, setSharePrice] = useState(0);
  const [units, setUnits]           = useState("1");
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    fetch("/api/share-price").then(r => r.json()).then(d => setSharePrice(d.price ?? 0)).finally(() => setLoading(false));
  }, []);

  const totalCost = (parseInt(units) || 0) * sharePrice;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await buyShares(new FormData(e.currentTarget));
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/shares"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-stone-400"/></div>;

  return (
    <div className="p-6 lg:p-10 max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Buy Shares</h1>
        <p className="text-stone-500 text-sm mt-1">Current price: KES {sharePrice.toLocaleString()} per unit</p>
      </div>

      {success ? (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-10 text-center">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4"/>
          <h2 className="text-lg font-black text-stone-900">Shares Purchased!</h2>
          <p className="text-stone-500 text-sm mt-2">Redirecting to your shares page...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
            <Coins size={15} className="text-stone-400"/>
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">Purchase Shares</span>
          </div>
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>{error}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Number of Units *</label>
              <input type="number" name="units" required min="1" max="1000" value={units}
                onChange={e => setUnits(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"/>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{units || 0} units × KES {sharePrice.toLocaleString()}</span>
                <span className="text-lg font-black text-stone-900">KES {totalCost.toLocaleString()}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting || totalCost === 0}
              className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
              {submitting ? <><Loader2 size={16} className="animate-spin"/>Processing...</> : <><Coins size={16}/>Buy {units} Share{parseInt(units) !== 1 ? "s" : ""} for KES {totalCost.toLocaleString()}</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
