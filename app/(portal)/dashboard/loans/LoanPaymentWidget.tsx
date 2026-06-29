// app/(portal)/dashboard/loans/LoanPaymentWidget.tsx
// Matches your existing AQUAMY green theme.
// Calls router.refresh() when Safaricom confirms payment —
// this re-runs the server component and updates the progress bar live.
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { initiateSTKPush, checkPaymentStatus } from "@/app/actions/mpesa-actions";
import {
  Smartphone, Loader2, CheckCircle2,
  AlertTriangle, CreditCard, X,
} from "lucide-react";

interface LoanPaymentWidgetProps {
  loanId:             string;
  outstandingBalance: number;
  instalment:         number;
  userPhone:          string;
}

type Stage = "idle" | "form" | "pending" | "success" | "error";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default function LoanPaymentWidget({
  loanId,
  outstandingBalance,
  instalment,
  userPhone,
}: LoanPaymentWidgetProps) {
  const router  = useRouter();
  const [stage,              setStage]             = useState<Stage>("idle");
  const [phone,              setPhone]             = useState(userPhone);
  const [amount,             setAmount]            = useState(instalment.toFixed(0));
  const [message,            setMessage]           = useState("");
  const [checkoutRequestId,  setCheckoutRequestId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Poll Safaricom until the transaction resolves ─────────────────────────
  useEffect(() => {
    if (stage !== "pending" || !checkoutRequestId) return;

    pollRef.current = setInterval(async () => {
      const res = await checkPaymentStatus(checkoutRequestId);

      if (res.status === "SUCCESS") {
        clearInterval(pollRef.current!);
        setStage("success");
        setMessage("Payment confirmed! Your loan balance has been updated.");
        // Refresh the server component — progress bar updates immediately
        setTimeout(() => router.refresh(), 1000);
      }

      if (res.status === "FAILED" || res.status === "CANCELLED" || res.status === "ERROR") {
        clearInterval(pollRef.current!);
        setStage("error");
        setMessage("Payment was not completed. Please try again.");
      }
    }, 4000); // poll every 4 seconds

    return () => clearInterval(pollRef.current!);
  }, [stage, checkoutRequestId, router]);

  async function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setStage("error");
      setMessage("Enter a valid amount.");
      return;
    }

    setStage("pending");
    setMessage("Sending STK Push to your phone…");

    const formData = new FormData();
    formData.set("phone",    phone);
    formData.set("amount",   parsed.toFixed(0));
    formData.set("category", "loan");
    formData.set("loanId",   loanId);

    const res = await initiateSTKPush(formData);

    if (!res.success) {
      setStage("error");
      setMessage(res.error ?? "STK Push failed. Try again.");
      return;
    }

    setCheckoutRequestId(res.checkoutRequestId ?? null);
    setMessage("STK Push sent. Enter your M-Pesa PIN on your phone…");
  }

  function reset() {
    setStage("idle");
    setMessage("");
    setCheckoutRequestId(null);
    clearInterval(pollRef.current!);
  }

  // ── Idle — just a Pay button ──────────────────────────────────────────────
  if (stage === "idle") {
    return (
      <button
        onClick={() => setStage("form")}
        className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
      >
        <CreditCard size={13} /> Pay Instalment via M-Pesa
      </button>
    );
  }

  // ── Payment form ──────────────────────────────────────────────────────────
  if (stage === "form") {
    return (
      <form
        onSubmit={handlePay}
        className="bg-[#1C4A2E]/5 border border-[#1C4A2E]/20 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={14} className="text-[#1C4A2E]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#1C4A2E]">
              Pay via M-Pesa
            </span>
          </div>
          <button type="button" onClick={reset}
            className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              required
              className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-semibold">
                KES
              </span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                max={outstandingBalance}
                required
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
              />
            </div>
            <p className="text-[10px] text-stone-400">
              Suggested: {kes(instalment)} · Max: {kes(outstandingBalance)}
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
        >
          <Smartphone size={14} /> Send STK Push
        </button>
      </form>
    );
  }

  // ── Pending — polling ─────────────────────────────────────────────────────
  if (stage === "pending") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Loader2 size={16} className="text-amber-600 animate-spin flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Awaiting Payment</p>
          <p className="text-xs text-amber-700 mt-0.5">{message}</p>
          <p className="text-[10px] text-amber-500 mt-2">
            Checking automatically every 4 seconds…
          </p>
        </div>
        <button onClick={reset} className="ml-auto text-amber-400 hover:text-amber-600 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-800">Payment Confirmed!</p>
          <p className="text-xs text-emerald-700 mt-0.5">{message}</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-800">Payment Failed</p>
        <p className="text-xs text-red-700 mt-0.5">{message}</p>
      </div>
      <button
        onClick={() => setStage("form")}
        className="ml-auto text-xs font-bold text-red-600 hover:underline flex-shrink-0"
      >
        Try Again
      </button>
    </div>
  );
}