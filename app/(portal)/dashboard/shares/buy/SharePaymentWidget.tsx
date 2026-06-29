// app/(portal)/dashboard/shares/buy/SharePaymentWidget.tsx
// Mirrors LoanPaymentWidget exactly — same stages, same theme, same polling.
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { initiateSharePurchase } from "@/app/actions/mpesa-actions";
import { checkPaymentStatus } from "@/app/actions/mpesa-actions";
import {
  Smartphone, Loader2, CheckCircle2,
  AlertTriangle, Coins, X,
} from "lucide-react";

interface SharePaymentWidgetProps {
  sharePrice: number;
  userPhone:  string;
}

type Stage = "form" | "pending" | "success" | "error";

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default function SharePaymentWidget({
  sharePrice,
  userPhone,
}: SharePaymentWidgetProps) {
  const router = useRouter();
  const [stage,             setStage]             = useState<Stage>("form");
  const [phone,             setPhone]             = useState(userPhone);
  const [units,             setUnits]             = useState("1");
  const [message,           setMessage]           = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const totalCost = (parseInt(units) || 0) * sharePrice;

  // ── Poll until Safaricom confirms ─────────────────────────────────────────
  useEffect(() => {
    if (stage !== "pending" || !checkoutRequestId) return;

    pollRef.current = setInterval(async () => {
      const res = await checkPaymentStatus(checkoutRequestId);

      if (res.status === "SUCCESS") {
        clearInterval(pollRef.current!);
        setStage("success");
        setMessage("Payment confirmed! Your shares have been credited.");
        setTimeout(() => router.push("/dashboard/shares"), 2000);
      }

      if (res.status === "FAILED" || res.status === "CANCELLED" || res.status === "ERROR") {
        clearInterval(pollRef.current!);
        setStage("error");
        setMessage("Payment was not completed. Please try again.");
      }
    }, 4000);

    return () => clearInterval(pollRef.current!);
  }, [stage, checkoutRequestId, router]);

  async function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsedUnits = parseInt(units);
    if (isNaN(parsedUnits) || parsedUnits < 1) {
      setStage("error");
      setMessage("Enter a valid number of units.");
      return;
    }
    if (!phone.trim()) {
      setStage("error");
      setMessage("Phone number is required.");
      return;
    }

    setStage("pending");
    setMessage("Sending STK Push to your phone…");

    const res = await initiateSharePurchase(parsedUnits, phone);

    if (!res.success) {
      setStage("error");
      setMessage(res.message);
      return;
    }

    setCheckoutRequestId(res.checkoutRequestId ?? null);
    setMessage("STK Push sent. Enter your M-Pesa PIN on your phone…");
  }

  function reset() {
    setStage("form");
    setMessage("");
    setCheckoutRequestId(null);
    clearInterval(pollRef.current!);
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  if (stage === "form") {
    return (
      <form onSubmit={handlePay}
        className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Coins size={15} className="text-stone-400" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">
            Purchase Shares
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Number of Units *
            </label>
            <input
              type="number" required min="1" max="1000"
              value={units}
              onChange={e => setUnits(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              M-Pesa Phone Number *
            </label>
            <input
              type="tel" required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
            />
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">
                {units || 0} units × {kes(sharePrice)}
              </span>
              <span className="text-lg font-black text-stone-900">{kes(totalCost)}</span>
            </div>
          </div>

          <button type="submit" disabled={totalCost === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            <Smartphone size={16} /> Pay {kes(totalCost)} via M-Pesa
          </button>
        </div>
      </form>
    );
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (stage === "pending") {
    return (
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-8 text-center">
        <Loader2 size={36} className="text-amber-500 animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-black text-stone-900">Awaiting Payment</h2>
        <p className="text-stone-500 text-sm mt-2">{message}</p>
        <p className="text-[10px] text-stone-400 mt-3">
          Checking automatically every 4 seconds…
        </p>
        <button onClick={reset}
          className="mt-5 text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-10 text-center">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
        <h2 className="text-lg font-black text-stone-900">Shares Purchased!</h2>
        <p className="text-stone-500 text-sm mt-2">{message}</p>
        <p className="text-[10px] text-stone-400 mt-3">Redirecting to your shares page…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
      <AlertTriangle size={36} className="text-red-500 mx-auto mb-4" />
      <h2 className="text-lg font-black text-stone-900">Payment Failed</h2>
      <p className="text-stone-500 text-sm mt-2">{message}</p>
      <button onClick={() => setStage("form")}
        className="mt-5 flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-5 py-2.5 rounded-lg mx-auto transition-colors">
        Try Again
      </button>
    </div>
  );
}