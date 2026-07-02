// app/login/page.tsx — v2
// Adds: "Forgot password?" link below the form
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showPw,     setShowPw]     = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email:    formData.get("email")    as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-sm w-full overflow-hidden">

        {/* Header */}
        <div className="bg-[#1C4A2E] px-8 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-black text-lg tracking-tight">AQ</span>
          </div>
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
          <h1 className="text-white font-black text-2xl mt-1 tracking-tight">Member Portal</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Email Address
            </label>
            <input type="email" name="email" required autoComplete="email"
              placeholder="you@example.com"
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Password
              </label>
              <Link href="/forgot-password"
                className="text-[10px] font-bold text-[#1C4A2E] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                name="password" required autoComplete="current-password"
                placeholder="••••••••"
                className="w-full p-3 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
              : "Sign In"}
          </button>

          <p className="text-center text-xs text-stone-400">
            Don't have an account?{" "}
            <Link href="/register" className="font-bold text-[#1C4A2E] hover:underline">
              Apply for membership
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}