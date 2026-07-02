// app/reset-password/page.tsx — v2
// Fixed: searchParams is now a Promise in Next.js 15.
// Client components must use React.use() to unwrap it.
"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/app/actions/password-reset-actions";
import Link from "next/link";
import { Loader2, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default function ResetPasswordPage({ searchParams }: Props) {
  // ✅ Unwrap the Promise using React.use()
  const params = use(searchParams);
  const token  = params.token ?? "";

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");
  const [showPw,     setShowPw]     = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("token", token);
    try {
      await resetPassword(fd);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setSubmitting(false); }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm max-w-sm w-full p-8 text-center">
          <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
          <h1 className="font-black text-stone-900 text-lg">Invalid Link</h1>
          <p className="text-stone-500 text-sm mt-2">
            This reset link is missing a token. Please use the original link from your email.
          </p>
          <Link href="/forgot-password"
            className="inline-flex mt-4 text-sm font-bold text-[#1C4A2E] hover:underline">
            Request a new reset link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-sm w-full overflow-hidden">

        <div className="bg-[#1C4A2E] px-8 py-7 text-center">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
          <p className="text-white font-black text-xl mt-1">Set New Password</p>
        </div>

        <div className="p-8">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
              <h2 className="font-black text-stone-900 text-lg">Password Updated!</h2>
              <p className="text-stone-500 text-sm">
                Your password has been changed successfully. Redirecting to login…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}

              {[
                { name: "newPassword",     label: "New Password",     placeholder: "Min 8 characters" },
                { name: "confirmPassword", label: "Confirm Password", placeholder: "Re-enter new password" },
              ].map(({ name, label, placeholder }) => (
                <div key={name} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    {label}
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showPw ? "text" : "password"}
                      name={name} required minLength={8}
                      placeholder={placeholder}
                      className="w-full pl-9 pr-10 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
                    />
                    {name === "newPassword" && (
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3 rounded-lg transition-colors text-sm">
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Updating...</>
                  : "Set New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}