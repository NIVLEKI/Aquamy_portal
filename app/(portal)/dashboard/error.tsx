// app/(portal)/dashboard/error.tsx
// Error boundary for the dashboard route.
// Next.js renders this when dashboard/page.tsx throws an unhandled error.
// Must be a Client Component.
"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development so we can see the real error
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F7F5F0] p-6 text-center">
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-10 max-w-md w-full">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h2 className="text-lg font-black text-stone-900 mb-2">
          Dashboard failed to load
        </h2>
        <p className="text-sm text-stone-500 mb-2">
          Something went wrong while loading your data.
        </p>
        {/* Show the real error message in development */}
        {process.env.NODE_ENV === "development" && (
          <pre className="text-left text-[10px] bg-red-50 border border-red-100 rounded-lg p-3 mb-4 overflow-auto text-red-700 max-h-32">
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
          </pre>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-[#1C4A2E] text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[#153822] transition-colors"
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <a
            href="/login"
            className="flex items-center gap-2 bg-white text-stone-700 border border-stone-200 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Sign Out & Back In
          </a>
        </div>
        <p className="text-[10px] text-stone-400 mt-4">
          If the problem persists, try signing out and back in to refresh your session.
        </p>
      </div>
    </div>
  );
}