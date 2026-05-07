"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // This will catch invalid credentials OR blocked/pending accounts
        // depending on how you configured your NextAuth authorize function.
        setError(result.error || "Invalid email or password. Please try again.");
      } else {
        // Successful login: route to dashboard.
        // The dashboard itself, along with middleware, handles role-based rendering.
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

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
          Secure Portal
        </p>
      </div>

      {/* Form Card */}
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-lg font-black text-stone-900 leading-none mb-2">
          Welcome Back
        </h2>
        <p className="text-xs text-stone-500 mb-6">
          Enter your credentials to access your dashboard.
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
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E] transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white p-3.5 rounded-lg font-bold transition-colors mt-2 text-sm"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>

      <p className="text-xs text-stone-400 mt-6">
        Not a member yet?{" "}
        <Link href="/register" className="font-bold text-[#1C4A2E] hover:underline">
          Request Access
        </Link>
      </p>
    </div>
  );
}