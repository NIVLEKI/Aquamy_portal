// app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/app/actions/password-reset-actions";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [message,    setMessage]    = useState("");
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res = await requestPasswordReset(new FormData(e.currentTarget));
      setMessage(res.message);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-sm w-full overflow-hidden">
        <div className="bg-[#1C4A2E] px-8 py-7 text-center">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
          <p className="text-white font-black text-xl mt-1">Reset Password</p>
        </div>

        <div className="p-8">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
              <p className="text-stone-700 text-sm leading-relaxed">{message}</p>
              <p className="text-stone-400 text-xs">Check your spam folder if you don't see it within a few minutes.</p>
              <Link href="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#1C4A2E] hover:underline mt-2">
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-stone-500 text-sm">
                Enter your registered email address and we'll send you a password reset link.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input type="email" name="email" required
                    placeholder="your@email.com"
                    className="w-full pl-9 pr-3 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]" />
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3 rounded-lg transition-colors text-sm">
                {submitting ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : "Send Reset Link"}
              </button>

              <div className="text-center">
                <Link href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-600">
                  <ArrowLeft size={12} /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}