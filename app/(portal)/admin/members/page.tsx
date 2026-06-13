// app/(portal)/admin/members/page.tsx  — v2
// Adds inline Suspend / Expel / Reactivate with reason modal
"use client";

import { useEffect, useState } from "react";
import { changeMemberStatus } from "@/app/actions/member-actions";
import {
  Users, Mail, Phone, Hash, BadgeCheck,
  Clock, XCircle, ShieldOff, ShieldCheck,
  Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Search,
} from "lucide-react";

type MemberStatus = "ACTIVE" | "PENDING" | "INACTIVE" | "SUSPENDED" | "EXPELLED" | "DECEASED" | "RESIGNED";

type Member = {
  id:           string;
  name:         string;
  firstName:    string;
  lastName:     string;
  email:        string | null;
  phone:        string;
  memberNumber: string;
  role:         string;
  status:       MemberStatus;
  createdAt:    string;
  financialSummary: { totalContributed: number } | null;
  shares:       { quantity: number } | null;
};

const STATUS_BADGE: Record<MemberStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  ACTIVE:    { label: "Active",    classes: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <BadgeCheck size={10}/> },
  PENDING:   { label: "Pending",   classes: "bg-amber-50   text-amber-700   border-amber-200",   icon: <Clock size={10}/> },
  INACTIVE:  { label: "Inactive",  classes: "bg-stone-100  text-stone-500   border-stone-200",   icon: <Clock size={10}/> },
  SUSPENDED: { label: "Suspended", classes: "bg-red-50     text-red-700     border-red-200",     icon: <ShieldOff size={10}/> },
  EXPELLED:  { label: "Expelled",  classes: "bg-red-100    text-red-800     border-red-300",     icon: <XCircle size={10}/> },
  DECEASED:  { label: "Deceased",  classes: "bg-stone-100  text-stone-500   border-stone-200",   icon: <XCircle size={10}/> },
  RESIGNED:  { label: "Resigned",  classes: "bg-stone-100  text-stone-500   border-stone-200",   icon: <XCircle size={10}/> },
};

type ActionType = "SUSPEND" | "EXPEL" | "REACTIVATE";

interface ConfirmModal {
  memberId:   string;
  memberName: string;
  action:     ActionType;
}

export default function AdminMembersPage() {
  const [members,   setMembers]   = useState<Member[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"ALL"|MemberStatus>("ALL");
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [modal,     setModal]     = useState<ConfirmModal | null>(null);
  const [reason,    setReason]    = useState("");
  const [acting,    setActing]    = useState(false);
  const [feedback,  setFeedback]  = useState<{ type: "success"|"error"; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/admin/members");
    const data = await res.json();
    setMembers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAction() {
    if (!modal || !reason.trim()) return;
    setActing(true);
    try {
      await changeMemberStatus(modal.memberId, modal.action, reason);
      setFeedback({ type: "success", msg: `${modal.memberName} has been ${modal.action.toLowerCase()}ed.` });
      setModal(null);
      setReason("");
      await load();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(false); }
  }

  const filtered = members.filter(m => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.memberNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      (m.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || m.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    ALL:       members.length,
    ACTIVE:    members.filter(m => m.status === "ACTIVE").length,
    PENDING:   members.filter(m => m.status === "PENDING").length,
    SUSPENDED: members.filter(m => m.status === "SUSPENDED").length,
    EXPELLED:  members.filter(m => m.status === "EXPELLED").length,
  };

  const ACTION_CONFIG: Record<ActionType, { label: string; confirm: string; btnCls: string }> = {
    SUSPEND:    { label: "Suspend",    confirm: "Suspend Member",    btnCls: "bg-amber-600 hover:bg-amber-700 text-white" },
    EXPEL:      { label: "Expel",      confirm: "Confirm Expulsion", btnCls: "bg-red-600   hover:bg-red-700   text-white" },
    REACTIVATE: { label: "Reactivate", confirm: "Reactivate",        btnCls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      <Loader2 size={22} className="animate-spin mr-2"/> Loading members...
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Member Directory</h1>
          <p className="text-stone-500 text-sm mt-1">{members.length} total members</p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-start gap-2 p-4 rounded-xl border text-sm
          ${feedback.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"}`}>
          {feedback.type === "success"
            ? <BadgeCheck size={16} className="flex-shrink-0 mt-0.5"/>
            : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5"/>}
          {feedback.msg}
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or member number..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
          />
        </div>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg overflow-x-auto flex-shrink-0">
          {(Object.entries(counts) as [string, number][]).map(([status, count]) => (
            <button key={status}
              onClick={() => setFilter(status as "ALL" | MemberStatus)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all
                ${filter === status
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"}`}>
              {status === "ALL" ? "All" : status} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
            No members match your search.
          </div>
        ) : filtered.map(m => {
          const badge       = STATUS_BADGE[m.status] ?? STATUS_BADGE.INACTIVE;
          const displayName = m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
          const initials    = (m.firstName?.[0] ?? m.name[0]).toUpperCase() + (m.lastName?.[0] ?? "").toUpperCase();
          const isExpanded  = expanded === m.id;

          return (
            <div key={m.id}
              className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">

              {/* Summary row */}
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#1C4A2E]/10 flex items-center justify-center text-[#1C4A2E] font-bold text-sm flex-shrink-0">
                  {initials}
                </div>

                {/* Name + member number */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-stone-800 truncate">{displayName}</p>
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-stone-400 mt-0.5">{m.memberNumber}</p>
                </div>

                {/* Role chip + expand */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:block text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded">
                    {m.role.replace(/_/g," ")}
                  </span>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : m.id)}
                    className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                </div>
              </div>

              {/* Expanded detail + actions */}
              {isExpanded && (
                <div className="border-t border-stone-100 px-5 py-4 space-y-4">

                  {/* Contact + stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {m.email && (
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <Mail size={12} className="text-stone-400"/>{m.email}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <Phone size={12} className="text-stone-400"/>{m.phone}
                    </div>
                    <div>
                      <p className="text-stone-400 font-medium">Contributions</p>
                      <p className="font-bold text-stone-700 mt-0.5">
                        KES {(m.financialSummary?.totalContributed ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-400 font-medium">Shares Held</p>
                      <p className="font-bold text-stone-700 mt-0.5">
                        {m.shares?.quantity ?? 0} units
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-400 font-medium">Member Since</p>
                      <p className="font-bold text-stone-700 mt-0.5">
                        {new Date(m.createdAt).toLocaleDateString("en-KE", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons — only shown for non-Admin members */}
                  {m.role !== "ADMIN" && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                      {m.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => { setModal({ memberId: m.id, memberName: displayName, action: "SUSPEND" }); setFeedback(null); }}
                            className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                            <ShieldOff size={13}/> Suspend
                          </button>
                          <button
                            onClick={() => { setModal({ memberId: m.id, memberName: displayName, action: "EXPEL" }); setFeedback(null); }}
                            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                            <XCircle size={13}/> Expel
                          </button>
                        </>
                      )}
                      {(m.status === "SUSPENDED" || m.status === "INACTIVE") && (
                        <button
                          onClick={() => { setModal({ memberId: m.id, memberName: displayName, action: "REACTIVATE" }); setFeedback(null); }}
                          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                          <ShieldCheck size={13}/> Reactivate
                        </button>
                      )}
                      {m.status === "EXPELLED" && (
                        <p className="text-xs text-stone-400 italic self-center">
                          Expelled members cannot be reactivated through this panel.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Confirmation modal ───────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

            {/* Modal header */}
            <div className={`px-6 py-5 border-b border-stone-100
              ${modal.action === "REACTIVATE" ? "bg-emerald-50" : "bg-red-50"}`}>
              <div className="flex items-center gap-3">
                {modal.action === "REACTIVATE"
                  ? <ShieldCheck size={20} className="text-emerald-600"/>
                  : <AlertTriangle size={20} className="text-red-600"/>}
                <div>
                  <p className={`font-black text-sm
                    ${modal.action === "REACTIVATE" ? "text-emerald-800" : "text-red-800"}`}>
                    {ACTION_CONFIG[modal.action].confirm}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {modal.memberName}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {modal.action !== "REACTIVATE" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 leading-relaxed">
                  <strong>Constitutional requirement:</strong> This action should only be taken after
                  a formal committee resolution has been passed and the member has been notified
                  per the AQUAMY constitution. This action is logged in the permanent audit trail.
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Reason / Committee Resolution Reference *
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={
                    modal.action === "SUSPEND"
                      ? "e.g. Resolution passed at June 2025 meeting — 6 months arrears outstanding"
                      : modal.action === "EXPEL"
                      ? "e.g. Expelled per AGM resolution — repeated default on loan obligations"
                      : "e.g. Reactivated following settlement of outstanding obligations"
                  }
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setModal(null); setReason(""); }}
                  disabled={acting}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={acting || !reason.trim()}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-colors disabled:opacity-50
                    ${ACTION_CONFIG[modal.action].btnCls}`}>
                  {acting
                    ? <><Loader2 size={14} className="animate-spin"/> Processing...</>
                    : ACTION_CONFIG[modal.action].confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}