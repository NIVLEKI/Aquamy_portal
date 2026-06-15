"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initiateSTKPush, checkPaymentStatus } from "@/app/actions/mpesa-actions";
import { Loader2, Smartphone, CheckCircle2, AlertTriangle } from "lucide-react";

export default function LoanPaymentWidget({ 
  loanId, 
  outstandingBalance, 
  instalment, 
  userPhone 
}: { 
  loanId: string, 
  outstandingBalance: number, 
  instalment: number,
  userPhone: string 
}) {
  const router = useRouter();
  // Default to the instalment amount, or the full balance if it's less than the instalment
  const [amount, setAmount] = useState((Math.min(instalment, outstandingBalance)).toString());
  const [phone, setPhone] = useState(userPhone || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "polling" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsProcessing(true);
    setStatus("idle");

    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("amount", amount);
    formData.append("category", "loan_repayment");
    formData.append("loanId", loanId); // Links the payment to this specific loan!

    try {
      const res = await initiateSTKPush(formData);
      if (res.success && res.checkoutRequestId) {
        setStatus("polling");
        setMessage("Check your phone! Enter your M-Pesa PIN.");
        pollStatus(res.checkoutRequestId);
      } else {
        setStatus("error");
        setMessage(res.error ?? "Failed to initiate payment.");
        setIsProcessing(false);
      }
    } catch (err) {
      setStatus("error");
      setMessage("An unexpected error occurred.");
      setIsProcessing(false);
    }
  }

  function pollStatus(checkoutRequestId: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 20) {
        clearInterval(interval);
        setStatus("error");
        setMessage("Verification timed out. If money was deducted, it will reflect shortly.");
        setIsProcessing(false);
        return;
      }

      const statusRes = await checkPaymentStatus(checkoutRequestId);
      
      if (statusRes.status === "SUCCESS") {
        clearInterval(interval);
        setStatus("success");
        setMessage("Payment successful! Balance updated.");
        setIsProcessing(false);
        router.refresh(); // Refreshes the server component to show new loan balance
      } else if (statusRes.status === "FAILED" || statusRes.status === "CANCELLED") {
        clearInterval(interval);
        setStatus("error");
        setMessage("Payment failed or was cancelled.");
        setIsProcessing(false);
      }
    }, 3000);
  }

  if (status === "success") {
    return (
      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm font-bold">
        <CheckCircle2 size={16} /> {message}
      </div>
    );
  }

  return (
    <form onSubmit={handlePayment} className="mt-4 p-4 bg-white border border-stone-200 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-bold text-stone-700">Make a Payment</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAmount(instalment.toString())} className="text-[#1C4A2E] hover:underline">Instalment</button>
          <span className="text-stone-300">|</span>
          <button type="button" onClick={() => setAmount(outstandingBalance.toString())} className="text-[#1C4A2E] hover:underline">Full Balance</button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs font-semibold">KES</span>
          <input type="number" required min="1" max={outstandingBalance} value={amount} onChange={e => setAmount(e.target.value)} disabled={isProcessing}
            className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] disabled:opacity-50"/>
        </div>
        <div className="relative flex-1">
          <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX..." disabled={isProcessing}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] disabled:opacity-50"/>
        </div>
      </div>

      {status === "error" && (
        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12}/> {message}</p>
      )}

      <button type="submit" disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-2 rounded-lg transition-colors text-sm">
        {isProcessing ? <><Loader2 size={16} className="animate-spin"/> {status === "polling" ? "Waiting for M-Pesa..." : "Processing..."}</> : <><Smartphone size={16}/> Pay KES {parseFloat(amount || "0").toLocaleString()}</>}
      </button>
    </form>
  );
}