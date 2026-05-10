// app/(portal)/dashboard/payments/page.tsx
"use client";
import { useState } from "react";
import { initiateSTKPush } from "@/app/actions/mpesa-actions";
import { Smartphone, CheckCircle2, Loader2, AlertTriangle, Coins, Landmark, AlertOctagon } from "lucide-react";

type PaymentCategory = "monthly" | "loan" | "fines" | "shares";

export default function PaymentsPage() {
  const [category, setCategory]   = useState<PaymentCategory>("monthly");
  const [phone, setPhone]         = useState("");
  const [amount, setAmount]       = useState("500");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState<"success"|"error"|null>(null);
  const [message, setMessage]     = useState("");

  const categories: { id: PaymentCategory; label: string; icon: React.ReactNode; description: string; defaultAmount: string }[] = [
    { id: "monthly", label: "Monthly Contribution", icon: <Coins size={18}/>,        description: "KES 500 — current month",          defaultAmount: "500"  },
    { id: "loan",    label: "Loan Repayment",        icon: <Landmark size={18}/>,      description: "Pay your active loan instalment",  defaultAmount: "0"    },
    { id: "fines",   label: "Pay Fines",             icon: <AlertOctagon size={18}/>,  description: "Clear outstanding meeting fines",  defaultAmount: "0"    },
    { id: "shares",  label: "Buy Shares",            icon: <Coins size={18}/>,         description: "Purchase group shares",            defaultAmount: "100"  },
  ];

  function handleCategoryChange(cat: PaymentCategory) {
    setCategory(cat);
    const found = categories.find(c => c.id === cat);
    if (found) setAmount(found.defaultAmount);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setResult(null);

    const formData = new FormData(e.currentTarget);
    formData.append("category", category);

    try {
      const res = await initiateSTKPush(formData);
      if (res.success) {
        setResult("success");
        setMessage("STK Push sent! Check your phone and enter your M-Pesa PIN to complete the payment.");
      } else {
        setResult("error");
        setMessage(res.error ?? "Payment initiation failed. Please try again.");
      }
    } catch (err: unknown) {
      setResult("error");
      setMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Make a Payment</h1>
        <p className="text-stone-500 text-sm mt-1">Pay securely via M-Pesa STK Push.</p>
      </div>

      {/* Category selector */}
      <div className="grid grid-cols-2 gap-3">
        {categories.map(cat => (
          <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id)}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all
              ${category === cat.id
                ? "bg-[#1C4A2E] text-white border-[#1C4A2E] shadow-md"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:shadow-sm"}`}>
            <div className={category === cat.id ? "text-white" : "text-stone-400"}>{cat.icon}</div>
            <div>
              <p className={`text-xs font-bold ${category === cat.id ? "text-white" : "text-stone-800"}`}>{cat.label}</p>
              <p className={`text-[10px] mt-0.5 ${category === cat.id ? "text-white/60" : "text-stone-400"}`}>{cat.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Result banners */}
      {result === "success" && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-emerald-800">Payment Initiated!</p>
            <p className="text-xs text-emerald-700 mt-0.5">{message}</p>
          </div>
        </div>
      )}
      {result === "error" && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-sm text-red-700">{message}</p>
        </div>
      )}

      {/* Payment form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Smartphone size={15} className="text-stone-400"/>
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">M-Pesa Details</span>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">M-Pesa Phone Number *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">+254</span>
              <input type="tel" name="phone" required value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="7XX XXX XXX" pattern="[0-9]{9}"
                className="w-full pl-14 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"/>
            </div>
            <p className="text-[10px] text-stone-400">Enter the number without the country code or leading zero.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Amount (KES) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm font-semibold">KES</span>
              <input type="number" name="amount" required min="1" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full pl-12 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"/>
            </div>
          </div>

          <button type="submit" disabled={submitting || result === "success"}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            {submitting
              ? <><Loader2 size={16} className="animate-spin"/>Sending STK Push...</>
              : <><Smartphone size={16}/>Pay KES {parseFloat(amount||"0").toLocaleString()} via M-Pesa</>}
          </button>

          <div className="flex items-center gap-2 justify-center text-[10px] text-stone-400">
            <span className="w-6 h-px bg-stone-200"/>
            <span>Secured by Safaricom Daraja API</span>
            <span className="w-6 h-px bg-stone-200"/>
          </div>
        </div>
      </form>
    </div>
  );
}