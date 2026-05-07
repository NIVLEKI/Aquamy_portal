"use client";
// app/waiting-room/page.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

const POLL_INTERVAL_MS = 5000; // check every 5 seconds

export default function WaitingRoom() {
  const router = useRouter();
  const [dots, setDots]       = useState(".");   // animated ellipsis
  const [approved, setApproved] = useState(false);

  // ── Animated ellipsis ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 600);
    return () => clearInterval(id);
  }, []);

  // ── Approval polling ────────────────────────────────────────────────────
  // We poll the DB directly (not the JWT token) because JWT sessions are
  // baked at login time and won't reflect the admin's approval until the
  // user gets a fresh token. The flow on approval is:
  //   1. Poll detects status === "ACTIVE"
  //   2. Sign the user out (clears the stale PENDING token)
  //   3. Redirect to /login with ?approved=true so the login page can show
  //      a "You've been approved! Please sign in." banner
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/status");
        if (!res.ok) return;

        const { status } = await res.json();

        if (status === "ACTIVE") {
          clearInterval(id);
          setApproved(true);

          // Small delay so the user sees the success state before redirect
          setTimeout(async () => {
            // Sign out to clear the stale JWT, then send to login with banner
            await signOut({ redirect: false });
            router.push("/login?approved=true");
          }, 2000);
        }
      } catch {
        // Network error — silently retry on next tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans flex flex-col items-center justify-center p-6">

      {/* Brand mark */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-12 h-12 rounded-xl bg-[#1C4A2E] flex items-center justify-center shadow-sm mb-4">
          <span className="text-white text-lg font-black tracking-tighter">AQ</span>
        </div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
          AQUAMY Member Portal
        </p>
      </div>

      {/* Card */}
      <div className="max-w-md w-full bg-white rounded-xl border border-stone-200 shadow-sm p-8 text-center">

        {approved ? (
          /* ── Approved state ──────────────────────────────────────────── */
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-stone-900 mb-2">
              You've Been Approved!
            </h1>
            <p className="text-sm text-stone-500">
              Welcome to AQUAMY. Redirecting you to sign in{dots}
            </p>
          </>
        ) : (
          /* ── Pending state ───────────────────────────────────────────── */
          <>
            {/* Animated hourglass */}
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="w-16 h-16 rounded-full border-4 border-stone-100 border-t-[#1C4A2E] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl">⏳</span>
              </div>
            </div>

            <h1 className="text-xl font-black text-stone-900 mb-2">
              Awaiting Approval{dots}
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              Your details have been submitted to the AQUAMY Executive Committee.
              An Admin or Treasurer will verify your membership shortly.
            </p>

            {/* Status indicator */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-400">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Checking for updates every 5 seconds
            </div>

            {/* Steps */}
            <div className="mt-8 text-left space-y-3">
              {[
                { done: true,  label: "Registration submitted"              },
                { done: true,  label: "Invite code verified"                },
                { done: false, label: "Executive Committee review"          },
                { done: false, label: "Account activated — access granted"  },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                    ${step.done
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-stone-100 text-stone-400 border border-stone-200"
                    }`}
                  >
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${step.done ? "text-stone-700 font-medium" : "text-stone-400"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sign out link */}
      {!approved && (
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-6 text-xs text-stone-400 hover:text-stone-600 transition-colors underline-offset-2 hover:underline"
        >
          Sign out and use a different account
        </button>
      )}
    </div>
  );
}