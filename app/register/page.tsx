// app/register/page.tsx — v3
// Adds: National ID field (manual, validated), terms & conditions checkbox
// with readable modal, removes auto-assigned member number input.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerMember } from "@/app/actions/auth-actions";
import TermsModal from "@/components/TermsModal";
import Link from "next/link";
import { AlertTriangle, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

const inputCls = "w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all";
const labelCls = "text-[10px] font-bold text-stone-400 uppercase tracking-wider";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPw,        setShowPw]        = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Please accept the Terms and Conditions to continue.");
      return;
    }

    setSubmitting(true); setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("acceptedTerms", "true");

    try {
      await registerMember(fd);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally { setSubmitting(false); }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-md w-full overflow-hidden">
          <div className="bg-[#1C4A2E] px-8 py-7 text-center">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
            <p className="text-white font-black text-xl mt-1">Application Submitted</p>
          </div>
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
            <h2 className="text-xl font-black text-stone-900">Registration Received!</h2>
            <div className="text-stone-600 text-sm leading-relaxed space-y-2">
              <p>Your application has been submitted and is now in the waiting room.</p>
              <p>We have sent <strong>two emails</strong> to your address:</p>
              <ul className="text-left space-y-1 bg-stone-50 rounded-xl p-4 text-xs">
                <li>✉️ <strong>Email verification</strong> — please click the link to verify your address</li>
                <li>📋 <strong>Registration confirmation</strong> — details about next steps</li>
              </ul>
              <p className="text-xs text-stone-400">Committee approval is required before you can log in. You will be emailed once a decision is made.</p>
            </div>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-5 py-2.5 rounded-lg mt-2 transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#1C4A2E] px-8 py-7">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
          <h1 className="text-white font-black text-2xl mt-1 tracking-tight">Create Account</h1>
          <p className="text-white/60 text-xs mt-1">
            Already a member?{" "}
            <Link href="/login" className="text-white font-bold hover:underline">Sign in</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>First Name *</label>
              <input name="firstName" required placeholder="James" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Middle Name</label>
              <input name="middleName" placeholder="Mwangi" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Last Name *</label>
              <input name="lastName" required placeholder="Kamau" className={inputCls} />
            </div>
          </div>

          {/* National ID — manually entered, no auto-assign */}
          <div className="space-y-1.5">
            <label className={labelCls}>National ID Number *</label>
            <input
              name="nationalId" required
              placeholder="e.g. 12345678"
              maxLength={8}
              pattern="[0-9]{6,8}"
              title="Enter your 6–8 digit National ID number"
              className={inputCls}
            />
            <p className="text-[10px] text-stone-400">
              Your Government-issued National ID number (6–8 digits). Used for identity verification only.
            </p>
          </div>

          {/* Date of birth */}
          <div className="space-y-1.5">
            <label className={labelCls}>Date of Birth *</label>
            <input type="date" name="dob" required
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
              className={inputCls}
            />
            <p className="text-[10px] text-stone-400">Members must be between 18 and 35 years old per the AQUAMY constitution.</p>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Email Address *</label>
              <input type="email" name="email" required placeholder="you@example.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>M-Pesa Phone *</label>
              <input type="tel" name="phone" required placeholder="07XX XXX XXX" className={inputCls} />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className={labelCls}>Password *</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                name="password" required minLength={8}
                placeholder="Min 8 characters"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Invite code */}
          <div className="space-y-1.5">
            <label className={labelCls}>Invite Code *</label>
            <input
              name="inviteCode" required
              placeholder="e.g. AQM-XXXXXX"
              className={`${inputCls} uppercase tracking-widest font-mono`}
            />
            <p className="text-[10px] text-stone-400">
              Obtain your invite code from the AQUAMY Secretary before registering.
            </p>
          </div>

          {/* Terms and conditions checkbox */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${acceptedTerms ? "bg-emerald-50 border-emerald-200" : "bg-stone-50 border-stone-200"}`}>
            <div className="flex-shrink-0 mt-0.5">
              <button
                type="button"
                onClick={() => setAcceptedTerms(t => !t)}
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  acceptedTerms
                    ? "bg-[#1C4A2E] border-[#1C4A2E]"
                    : "bg-white border-stone-300 hover:border-[#1C4A2E]"
                }`}
              >
                {acceptedTerms && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
            <span className="text-sm text-stone-600 leading-relaxed">
              I have read and agree to the{" "}
              <TermsModal />
              {" "}of the Agricultural and Aquatic Muirungi Youth Self-Help Group.
            </span>
          </div>  {/* ← this was missing */}

          <button type="submit" disabled={submitting || !acceptedTerms}
            className="w-full flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-3.5 rounded-lg transition-colors text-sm">
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Submitting Application...</>
              : "Submit Application"}
          </button>

          <p className="text-[10px] text-stone-400 text-center">
            By submitting, your application enters a waiting room pending committee approval.
            You cannot log in until approved.
          </p>
        </form>
      </div>
    </div>
  );
}