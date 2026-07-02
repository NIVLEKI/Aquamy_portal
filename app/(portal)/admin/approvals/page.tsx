// app/(portal)/admin/approvals/page.tsx — v2
// Adds: Reject button + shows National ID + email verified badge
"use client";

import { useEffect, useState } from "react";
import { approveMember, rejectMember, getPendingMembers } from "@/app/actions/auth-actions";
import {
  CheckCircle2, XCircle, Clock, Loader2,
  Mail, Phone, Hash, ShieldCheck, AlertTriangle,
} from "lucide-react";

type Member = {
  id:           string;
  name:         string;
  firstName:    string | null;
  lastName:     string | null;
  email:        string | null;
  phone:        string;
  nationalId:   string | null;
  memberNumber: string;
  createdAt:    string;
  emailVerified: string | null;
};

export default function ApprovalsPage() {
  const [members,   setMembers]   = useState<Member[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState<string | null>(null);
  const [feedback,  setFeedback]  = useState<{ type: "success"|"error"; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    const data = await getPendingMembers();
    setMembers(data as unknown as Member[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string, name: string) {
    setActing(id); setFeedback(null);
    try {
      await approveMember(id);
      setFeedback({ type: "success", msg: `${name} has been approved. An approval email has been sent.` });
      await load();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(null); }
  }

  async function handleReject(id: string, name: string) {
    if (!confirm(`Reject ${name}'s application? They will receive an email notification.`)) return;
    setActing(id); setFeedback(null);
    try {
      await rejectMember(id);
      setFeedback({ type: "success", msg: `${name}'s application has been rejected. A notification email has been sent.` });
      await load();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(null); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Loading applications...
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Membership Approvals</h1>
        <p className="text-stone-500 text-sm mt-1">
          {members.length} pending application{members.length !== 1 ? "s" : ""}
        </p>
      </div>

      {feedback && (
        <div className={`flex items-start gap-2 p-4 rounded-xl border text-sm
          ${feedback.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"}`}>
          {feedback.type === "success"
            ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="opacity-50 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-black text-stone-800">All clear</h2>
          <p className="text-stone-400 text-sm mt-1">No pending membership applications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {members.map(m => {
            const displayName = m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
            const initials    = (m.firstName?.[0] ?? m.name[0]).toUpperCase() +
                                (m.lastName?.[0] ?? "").toUpperCase();
            const isActing    = acting === m.id;

            return (
              <div key={m.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1C4A2E]/10 flex items-center justify-center text-[#1C4A2E] font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800">{displayName}</p>
                      <p className="text-[10px] font-mono text-stone-400">{m.memberNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.emailVerified ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={10} /> Email Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> Email Unverified
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-full">
                      <Clock size={10} /> Pending
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-b border-stone-100">
                  <div className="flex items-center gap-2 text-stone-500">
                    <Mail size={12} className="text-stone-400 flex-shrink-0" />
                    {m.email ?? "—"}
                  </div>
                  <div className="flex items-center gap-2 text-stone-500">
                    <Phone size={12} className="text-stone-400 flex-shrink-0" />
                    {m.phone}
                  </div>
                  <div className="flex items-center gap-2 text-stone-500">
                    <Hash size={12} className="text-stone-400 flex-shrink-0" />
                    ID: {m.nationalId ?? "—"}
                  </div>
                </div>

                <div className="px-6 py-3 border-b border-stone-100 text-[10px] text-stone-400">
                  Applied {new Date(m.createdAt).toLocaleDateString("en-KE", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleApprove(m.id, displayName)}
                    disabled={isActing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {isActing
                      ? <Loader2 size={13} className="animate-spin" />
                      : <CheckCircle2 size={13} />}
                    Approve Membership
                  </button>
                  <button
                    onClick={() => handleReject(m.id, displayName)}
                    disabled={isActing}
                    className="flex items-center gap-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {isActing
                      ? <Loader2 size={13} className="animate-spin" />
                      : <XCircle size={13} />}
                    Reject Application
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}