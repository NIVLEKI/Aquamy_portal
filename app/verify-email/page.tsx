// app/verify-email/page.tsx
// Landing page after clicking the verification link.
// Shows one of four states based on the ?status= query param.
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

interface Props {
  searchParams: { status?: string };
}

const STATES = {
  success: {
    icon:  <CheckCircle2 size={48} className="text-emerald-500" />,
    title: "Email Verified!",
    body:  "Your email address has been successfully verified. Your application is still awaiting review by the AQUAMY management committee. You will receive another email once a decision has been made.",
    sub:   "This may take a few days depending on the committee schedule.",
    color: "border-emerald-200 bg-emerald-50",
  },
  expired: {
    icon:  <Clock size={48} className="text-amber-500" />,
    title: "Link Expired",
    body:  "This verification link has expired. Verification links are valid for 24 hours. Please contact the AQUAMY Secretary to request a new link.",
    sub:   "",
    color: "border-amber-200 bg-amber-50",
  },
  "already-used": {
    icon:  <CheckCircle2 size={48} className="text-stone-400" />,
    title: "Already Verified",
    body:  "This verification link has already been used. Your email address is already verified.",
    sub:   "If you are still waiting for approval, the committee will be in touch.",
    color: "border-stone-200 bg-stone-50",
  },
  invalid: {
    icon:  <XCircle size={48} className="text-red-500" />,
    title: "Invalid Link",
    body:  "This verification link is invalid or has been tampered with. Please use the original link sent to your email address.",
    sub:   "If you need help, please contact the AQUAMY Secretary.",
    color: "border-red-200 bg-red-50",
  },
};

export default function VerifyEmailPage({ searchParams }: Props) {
  const status = (searchParams.status ?? "invalid") as keyof typeof STATES;
  const state  = STATES[status] ?? STATES.invalid;

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#1C4A2E] px-8 py-6 text-center">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">AQUAMY</p>
          <p className="text-white font-black text-lg mt-1">Email Verification</p>
        </div>

        {/* Content */}
        <div className={`mx-6 my-6 rounded-xl border p-6 text-center ${state.color}`}>
          <div className="flex justify-center mb-4">{state.icon}</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">{state.title}</h1>
          <p className="text-stone-600 text-sm leading-relaxed">{state.body}</p>
          {state.sub && (
            <p className="text-stone-400 text-xs mt-3">{state.sub}</p>
          )}
        </div>

        <div className="px-8 pb-8 text-center">
          <Link href="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#1C4A2E] hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}