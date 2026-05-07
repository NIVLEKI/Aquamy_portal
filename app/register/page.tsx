"use client";
// app/register/page.tsx
// Changes from original:
//   - Removed memberNumber input (now auto-generated server-side)
//   - dob max date now enforced via JS to the 35-year cutoff
//   - All other UI, styling, and form fields preserved exactly

import { useState } from "react";
import { registerMember } from "../actions/auth-actions";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Calculate the max allowed date of birth (must be ≤ 35 today) ─────────
  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18); // minimum age 18
  const minDob = new Date();
  minDob.setFullYear(minDob.getFullYear() - 35); // maximum age 35

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    try {
      await registerMember(formData);
      router.push("/waiting-room");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans flex flex-col items-center justify-center p-6">

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#1C4A2E] flex items-center justify-center shadow-sm mb-4">
          <span className="text-white text-lg font-black tracking-tighter">AQ</span>
        </div>
        <h1 className="text-2xl font-black text-stone-900 uppercase tracking-widest text-center">
          AQUAMY
        </h1>
        <p className="text-xs font-bold text-stone-400 tracking-widest uppercase mt-1">
          Member Registration
        </p>
      </div>

      {/* Form Card */}
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-lg font-black text-stone-900 leading-none mb-2">
          Join the Group
        </h2>
        <p className="text-xs text-stone-500 mb-6">
          Enter your official details as per the Chama constitution to request access.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-lg border border-red-100">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Invite Code
            </label>
            <input
              name="inviteCode"
              placeholder="e.g. AQ-XXXX"
              required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                First Name
              </label>
              <input
                name="firstName"
                placeholder="Official"
                required
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Last Name
              </label>
              <input
                name="lastName"
                placeholder="Name"
                required
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Middle Name <span className="normal-case font-normal">(Optional)</span>
            </label>
            <input
              name="middleName"
              placeholder="Optional"
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              M-Pesa Phone Number
            </label>
            <input
              name="phone"
              placeholder="07XX XXX XXX"
              required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
            />
          </div>

          {/* ── Date of Birth with browser-enforced age range ────────────── */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Date of Birth
            </label>
            <input
              name="dob"
              type="date"
              required
              // min = 35 years ago (oldest allowed), max = 18 years ago (youngest allowed)
              min={minDob.toISOString().split("T")[0]}
              max={maxDob.toISOString().split("T")[0]}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-500 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
            />
            <p className="text-[10px] text-stone-400">
              Per the AQUAMY constitution, membership is open to persons aged 18–35.
            </p>
          </div>

          {/* ── memberNumber REMOVED — auto-generated as AQUAMY-XXXX ──────── */}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Secure Password
            </label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white p-3.5 rounded-lg font-bold transition-colors mt-2 text-sm"
          >
            {loading ? "Processing..." : "Register & Request Access"}
          </button>
        </form>
      </div>

      <p className="text-xs text-stone-400 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-[#1C4A2E] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}