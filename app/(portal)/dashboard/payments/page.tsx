"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initiateSTKPush, checkPaymentStatus, getRecentTransactions } from "@/app/actions/mpesa-actions";
import { getPaymentContext, type PaymentCategory } from "@/app/actions/payment-validation";
import { Smartphone, CheckCircle2, Loader2, AlertTriangle, Coins, Landmark, AlertOctagon, Clock, XCircle, ArrowRightLeft, Info } from "lucide-react";

export default function PaymentsPage() {
  const router = useRouter();
  const [category, setCategory]   = useState<PaymentCategory>("monthly");
  const [phone, setPhone]         = useState("");
  const [amount, setAmount]       = useState("500");
  const [submitting, setSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult]       = useState<"success"|"error"|"verified"|null>(null);
  const [message, setMessage]     = useState("");

  // ── NEW: validation state ────────────────────────────────────────────────
  // Tells us whether this category is even payable right now, and pre-fills
  // the correct amount based on real outstanding balances.
  const [checkingContext, setCheckingContext] = useState(true);
  const [contextAllowed,  setContextAllowed]  = useState(true);
  const [contextMessage,  setContextMessage]  = useState("");
  const [maxAmount,       setMaxAmount]       = useState<number | undefined>(undefined);
  const [refId,           setRefId]           = useState<string | undefined>(undefined);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  const categories: { id: PaymentCategory; label: string; icon: React.ReactNode; description: string }[] = [
    { id: "monthly", label: "Monthly Contribution", icon: <Coins size={18}/>,        description: "This month's contribution"        },
    { id: "loan",    label: "Loan Repayment",        icon: <Landmark size={18}/>,     description: "Pay your active loan instalment"   },
    { id: "fines",   label: "Pay Fines",              icon: <AlertOctagon size={18}/>, description: "Clear outstanding meeting fines"   },
    { id: "shares",  label: "Buy Shares",             icon: <Coins size={18}/>,        description: "Purchase group shares"             },
  ];

  useEffect(() => { loadTransactions(); }, []);

  // ── NEW: re-validate every time the category changes ────────────────────
  useEffect(() => {
    checkContext(category);
  }, [category]);

  async function checkContext(cat: PaymentCategory) {
    setCheckingContext(true);
    setResult(null);
    const ctx = await getPaymentContext(cat);
    setContextAllowed(ctx.allowed);
    setContextMessage(ctx.message);
    setMaxAmount(ctx.maxAmount);
    setRefId(ctx.refId);
    setAmount(ctx.suggestedAmount > 0 ? String(ctx.suggestedAmount) : "");
    setCheckingContext(false);
  }

  async function loadTransactions() {
    setLoadingTxs(true);
    const res = await getRecentTransactions();
    if (res.success && res.data) setTransactions(res.data);
    setLoadingTxs(false);
  }

  function handleCategoryChange(cat: PaymentCategory) {
    if (isPolling) return;
    setCategory(cat);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // ── NEW: hard stop if the validation check blocked this category ──────
    if (!contextAllowed) return;

    // ── NEW: don't allow paying more than the actual outstanding balance ──
    const parsedAmount = parseFloat(amount);
    if (maxAmount != null && parsedAmount > maxAmount + 1) {
      setResult("error");
      setMessage(`Amount cannot exceed the outstanding balance of KES ${maxAmount.toLocaleString()}.`);
      return;
    }

    setSubmitting(true); setResult(null);

    const formData = new FormData(e.currentTarget);
    formData.append("category", category);
    // Pass the specific record being paid (contribution/loan id) so the
    // backend can link the MpesaTransaction precisely — same pattern as
    // your existing loanId handling in initiateSTKPush.
    if (refId) formData.append("refId", refId);
    if (category === "loan" && refId) formData.append("loanId", refId);

    try {
      const res = await initiateSTKPush(formData);
      if (res.success && res.checkoutRequestId) {
        setResult("success");
        setMessage("STK Push sent! Please enter your M-Pesa PIN on your phone. Waiting for confirmation...");
        loadTransactions();
        startPolling(res.checkoutRequestId);
      } else {
        setResult("error");
        setMessage(res.error ?? "Payment initiation failed. Please try again.");
      }
    } catch (err: unknown) {
      setResult("error");
      setMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  function startPolling(checkoutRequestId: string) {
    setIsPolling(true);
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      if (attempts > 20) {
        clearInterval(interval);
        setIsPolling(false);
        setResult("error");
        setMessage("Verification timed out. If money was deducted, your balance will update shortly.");
        loadTransactions();
        return;
      }

      const statusRes = await checkPaymentStatus(checkoutRequestId);

      if (statusRes.status === "SUCCESS") {
        clearInterval(interval);
        setIsPolling(false);
        setResult("verified");
        setMessage("Payment received successfully! Your balances have been updated.");
        loadTransactions();
        checkContext(category); // ← NEW: re-check so "already paid" / blocked states update live
        router.refresh();
      } else if (statusRes.status === "FAILED" || statusRes.status === "CANCELLED") {
        clearInterval(interval);
        setIsPolling(false);
        setResult("error");
        setMessage("Payment was cancelled or failed. Please try again.");
        loadTransactions();
      }
    }, 3000);
  }

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "SUCCESS":
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md"><CheckCircle2 size={12}/> Success</span>;
      case "FAILED":
      case "CANCELLED":
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-1 rounded-md"><XCircle size={12}/> Failed</span>;
      default:
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-md"><Clock size={12}/> Pending</span>;
    }
  };

  const formDisabled = submitting || isPolling || result === "verified" || !contextAllowed || checkingContext;

  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Make a Payment</h1>
        <p className="text-stone-500 text-sm mt-1">Pay securely via M-Pesa STK Push.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.map(cat => (
          <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id)}
            disabled={isPolling}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all
              ${category === cat.id
                ? "bg-[#1C4A2E] text-white border-[#1C4A2E] shadow-md"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:shadow-sm"}
              ${isPolling ? "opacity-50 cursor-not-allowed" : ""}`}>
            <div className={category === cat.id ? "text-white" : "text-stone-400"}>{cat.icon}</div>
            <div>
              <p className={`text-xs font-bold ${category === cat.id ? "text-white" : "text-stone-800"}`}>{cat.label}</p>
              <p className={`text-[10px] mt-0.5 ${category === cat.id ? "text-white/60" : "text-stone-400"}`}>{cat.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── NEW: context banner — shows balance info OR blocks the category ── */}
      {checkingContext ? (
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-400">
          <Loader2 size={15} className="animate-spin" /> Checking your account...
        </div>
      ) : !contextAllowed ? (
        <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
          <Info size={18} className="text-stone-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-stone-600">{contextMessage}</p>
        </div>
      ) : (
        contextMessage && (
          <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4">
            <Info size={18} className="text-sky-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-sky-700">{contextMessage}</p>
          </div>
        )
      )}

      {result === "success" && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Loader2 size={20} className="text-amber-600 flex-shrink-0 mt-0.5 animate-spin"/>
          <div>
            <p className="text-sm font-bold text-amber-800">Awaiting Payment...</p>
            <p className="text-xs text-amber-700 mt-0.5">{message}</p>
          </div>
        </div>
      )}

      {result === "verified" && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-emerald-800">Payment Successful!</p>
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
                placeholder="7XX XXX XXX" pattern="[0-9]{9}" disabled={formDisabled}
                className="w-full pl-14 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] disabled:opacity-50"/>
            </div>
            <p className="text-[10px] text-stone-400">Enter without the country code or leading zero.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Amount (KES) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm font-semibold">KES</span>
              <input type="number" name="amount" required min="1" max={maxAmount} value={amount} onChange={e => setAmount(e.target.value)}
                disabled={formDisabled}
                className="w-full pl-12 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] disabled:opacity-50"/>
            </div>
            {maxAmount != null && (
              <p className="text-[10px] text-stone-400">Maximum payable: KES {maxAmount.toLocaleString()}</p>
            )}
          </div>

          <button type="submit" disabled={formDisabled}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 disabled:text-stone-500 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            {submitting || isPolling
              ? <><Loader2 size={16} className="animate-spin"/>{isPolling ? "Waiting for M-Pesa..." : "Sending STK Push..."}</>
              : !contextAllowed
                ? <>Nothing to Pay</>
                : <><Smartphone size={16}/>Pay KES {parseFloat(amount||"0").toLocaleString()} via M-Pesa</>}
          </button>
        </div>
      </form>

      <div className="pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={18} className="text-stone-400"/>
          <h2 className="text-lg font-bold text-stone-800 tracking-tight">Recent Transactions</h2>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          {loadingTxs ? (
            <div className="p-8 text-center text-stone-400 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-stone-300"/>
              <p className="text-sm">Loading ledger...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-sm">No recent transactions found.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {transactions.map((tx) => (
                <li key={tx.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-stone-800">KES {tx.amount.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-stone-500">
                        {new Date(tx.createdAt).toLocaleDateString("en-KE", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {tx.receiptNumber && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                          <p className="text-[11px] font-mono text-stone-500">{tx.receiptNumber}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={tx.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}