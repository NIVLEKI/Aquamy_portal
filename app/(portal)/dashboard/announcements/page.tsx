// app/(portal)/dashboard/announcements/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getMemberAnnouncements, markNotificationsRead } from "@/app/actions/announcement-actions";
import { Megaphone, Pin, Bell, BellOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) redirect("/login");

  // Fetch announcements + unread notifications in parallel
  const [announcements, unreadNotifications] = await Promise.all([
    getMemberAnnouncements(),
    prisma.notification.findMany({
      where:   { userId: dbUser.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take:    20,
    }),
  ]);

  // Mark all notifications as read when the page loads
  await markNotificationsRead();

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
            Group notices from the AQUAMY management committee.
          </p>
        </div>
        {unreadNotifications.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-2 rounded-full">
            <Bell size={13}/>
            {unreadNotifications.length} unread notification{unreadNotifications.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Unread notifications panel */}
      {unreadNotifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <Bell size={14} className="text-amber-600"/>
            <span className="text-xs font-black uppercase tracking-wider text-amber-700">
              New Notifications
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {unreadNotifications.map(n => (
              <div key={n.id} className="px-5 py-3.5">
                <p className="text-sm font-semibold text-amber-800">{n.subject}</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-amber-500 mt-1.5">
                  {new Date(n.createdAt).toLocaleDateString("en-KE", {
                    weekday: "short", day: "numeric",
                    month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned announcements */}
      {pinned.length > 0 && (
        <section>
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-1.5">
            <Pin size={11}/> Pinned
          </p>
          <div className="space-y-3">
            {pinned.map(a => (
              <AnnouncementCard key={a.id} announcement={a} pinned />
            ))}
          </div>
        </section>
      )}

      {/* All announcements */}
      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-1.5">
              <Megaphone size={11}/> Latest
            </p>
          )}
          <div className="space-y-3">
            {unpinned.map(a => (
              <AnnouncementCard key={a.id} announcement={a} pinned={false} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {announcements.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
          <BellOff size={36} className="text-stone-200 mx-auto mb-4"/>
          <p className="text-stone-500 text-sm font-medium">No announcements yet.</p>
          <p className="text-stone-400 text-xs mt-1">
            Announcements from the management committee will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ANNOUNCEMENT CARD  (server component — no interactivity needed)
// =============================================================================

function AnnouncementCard({
  announcement,
  pinned,
}: {
  announcement: {
    id:        string;
    title:     string;
    body:      string;
    isPinned:  boolean;
    createdAt: Date;
  };
  pinned: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden
      ${pinned ? "border-[#1C4A2E]/30" : "border-stone-200"}`}>

      {pinned && (
        <div className="bg-[#1C4A2E]/5 border-b border-[#1C4A2E]/10 px-5 py-1.5 flex items-center gap-1.5">
          <Pin size={11} className="text-[#1C4A2E]"/>
          <span className="text-[10px] font-bold text-[#1C4A2E] uppercase tracking-wider">Pinned</span>
        </div>
      )}

      <div className="px-5 py-5">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
            ${pinned ? "bg-[#1C4A2E] text-white" : "bg-stone-100 text-stone-500"}`}>
            <Megaphone size={15}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-800">{announcement.title}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">
              {new Date(announcement.createdAt).toLocaleDateString("en-KE", {
                weekday: "long", day: "numeric",
                month:   "long", year: "numeric",
              })}
            </p>
            <p className="text-sm text-stone-600 mt-3 leading-relaxed whitespace-pre-line">
              {announcement.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}