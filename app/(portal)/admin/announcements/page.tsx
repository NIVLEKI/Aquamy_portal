// app/(portal)/admin/announcements/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  getAllAnnouncements,
  createAnnouncement,
  togglePin,
  deleteAnnouncement,
} from "@/app/actions/announcement-actions";
import {
  Megaphone, Pin, PinOff, Trash2,
  Loader2, AlertTriangle, CheckCircle2,
  Plus, X,
} from "lucide-react";

type Announcement = {
  id:        string;
  title:     string;
  body:      string;
  authorId:  string;
  isPinned:  boolean;
  createdAt: string;
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [acting,        setActing]        = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [feedback,      setFeedback]      = useState<{ type: "success"|"error"; msg: string } | null>(null);
  const [isPinned,      setIsPinned]      = useState(false);
  const [charCount,     setCharCount]     = useState(0);

  async function load() {
    setLoading(true);
    const data = await getAllAnnouncements();
    setAnnouncements(data as unknown as Announcement[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setFeedback(null);
    const fd = new FormData(e.currentTarget);
    fd.set("isPinned", String(isPinned));
    try {
      await createAnnouncement(fd);
      setFeedback({ type: "success", msg: "Announcement posted and members notified." });
      setShowForm(false);
      setIsPinned(false);
      setCharCount(0);
      await load();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setSubmitting(false); }
  }

  async function handlePin(id: string) {
    setActing(id);
    try {
      await togglePin(id);
      await load();
    } finally { setActing(null); }
  }

  async function handleDelete(id: string) {
    setActing(id);
    try {
      await deleteAnnouncement(id);
      setConfirmDelete(null);
      setFeedback({ type: "success", msg: "Announcement deleted." });
      await load();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed." });
    } finally { setActing(null); }
  }

  const pinned   = announcements.filter(a => a.isPinned);
  const unpinned = announcements.filter(a => !a.isPinned);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Announcements
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Post group-wide announcements. All active members are notified instantly.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFeedback(null); }}
          className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={15}/> New Announcement
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm
          ${feedback.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"}`}>
          {feedback.type === "success"
            ? <CheckCircle2 size={16} className="flex-shrink-0"/>
            : <AlertTriangle size={16} className="flex-shrink-0"/>}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="opacity-50 hover:opacity-100">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-stone-400"/>
              <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                New Announcement
              </span>
            </div>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-stone-400 hover:text-stone-600 transition-colors">
              <X size={16}/>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Title *
                </label>
                <span className="text-[10px] text-stone-400">{charCount}/120</span>
              </div>
              <input
                name="title" required maxLength={120}
                onChange={e => setCharCount(e.target.value.length)}
                placeholder="e.g. Important: AGM Date Confirmed"
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Message *
              </label>
              <textarea
                name="body" required rows={5}
                placeholder="Write your announcement here. This will be sent as a notification to all active members..."
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1C4A2E]/20 focus:border-[#1C4A2E]"
              />
            </div>

            {/* Pin toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setIsPinned(p => !p)}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative
                  ${isPinned ? "bg-[#1C4A2E]" : "bg-stone-200"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${isPinned ? "translate-x-5" : "translate-x-1"}`}/>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-700">Pin this announcement</p>
                <p className="text-[10px] text-stone-400">
                  Pinned posts always appear at the top of the board.
                </p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] disabled:bg-stone-300 text-white font-bold py-2.5 rounded-lg transition-colors text-sm">
                {submitting
                  ? <><Loader2 size={14} className="animate-spin"/>Posting...</>
                  : <><Megaphone size={14}/>Post & Notify Members</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcement list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-stone-400">
          <Loader2 size={20} className="animate-spin mr-2"/> Loading...
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Megaphone size={36} className="text-stone-200 mx-auto mb-4"/>
          <p className="text-stone-500 text-sm font-medium">No announcements yet.</p>
          <p className="text-stone-400 text-xs mt-1">
            Post your first announcement to notify all members.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pinned, ...unpinned].map(a => (
            <div key={a.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden
                ${a.isPinned ? "border-[#1C4A2E]/30" : "border-stone-200"}`}>

              {/* Pin indicator */}
              {a.isPinned && (
                <div className="bg-[#1C4A2E]/5 border-b border-[#1C4A2E]/10 px-5 py-1.5 flex items-center gap-1.5">
                  <Pin size={11} className="text-[#1C4A2E]"/>
                  <span className="text-[10px] font-bold text-[#1C4A2E] uppercase tracking-wider">
                    Pinned
                  </span>
                </div>
              )}

              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-800">{a.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString("en-KE", {
                        weekday: "short", day: "numeric",
                        month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    <p className="text-sm text-stone-600 mt-2 leading-relaxed whitespace-pre-line">
                      {a.body}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handlePin(a.id)}
                      disabled={acting === a.id}
                      title={a.isPinned ? "Unpin" : "Pin"}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors">
                      {acting === a.id
                        ? <Loader2 size={13} className="animate-spin"/>
                        : a.isPinned
                          ? <PinOff size={13}/>
                          : <Pin size={13}/>}
                    </button>

                    {confirmDelete === a.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={acting === a.id}
                          className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-md transition-colors">
                          {acting === a.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[10px] font-bold text-stone-500 hover:text-stone-700 px-2 py-1">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(a.id)}
                        title="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}