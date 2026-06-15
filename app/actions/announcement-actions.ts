// app/actions/announcement-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { MemberStatus } from "@prisma/client";

const MANAGEMENT_ROLES = [
  "ADMIN","CHAIRPERSON","VICE_CHAIRPERSON",
  "SECRETARY","TREASURER",
];

// =============================================================================
// CREATE ANNOUNCEMENT
// =============================================================================

export async function createAnnouncement(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!MANAGEMENT_ROLES.includes(role))
    throw new Error("Only management roles can post announcements.");

  const title    = (formData.get("title")    as string)?.trim();
  const body     = (formData.get("body")     as string)?.trim();
  const isPinned = formData.get("isPinned") === "true";

  if (!title || !body)
    throw new Error("Title and body are required.");
  if (title.length > 120)
    throw new Error("Title must be 120 characters or fewer.");

  const actor = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!actor) throw new Error("Actor not found.");

  // Create the announcement
  await prisma.announcement.create({
    data: { title, body, authorId: actor.id, isPinned },
  });

  // Fan out IN_APP notifications to every active member
  const members = await prisma.user.findMany({
    where:  { status: MemberStatus.ACTIVE, id: { not: actor.id } },
    select: { id: true },
  });

  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map(m => ({
        userId:  m.id,
        channel: "IN_APP",
        subject: `📢 ${title}`,
        body,
      })),
    });
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
}

// =============================================================================
// FETCH ALL ANNOUNCEMENTS  (admin view — newest first)
// =============================================================================

export async function getAllAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      _count: true,
    },
  });
}

// =============================================================================
// FETCH ANNOUNCEMENTS FOR MEMBER  (newest first, pinned at top)
// =============================================================================

export async function getMemberAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

// =============================================================================
// TOGGLE PIN
// =============================================================================

export async function togglePin(announcementId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!MANAGEMENT_ROLES.includes(role))
    throw new Error("Insufficient permissions.");

  const existing = await prisma.announcement.findUnique({
    where:  { id: announcementId },
    select: { isPinned: true },
  });
  if (!existing) throw new Error("Announcement not found.");

  await prisma.announcement.update({
    where: { id: announcementId },
    data:  { isPinned: !existing.isPinned },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard/announcements");
}

// =============================================================================
// DELETE ANNOUNCEMENT
// =============================================================================

export async function deleteAnnouncement(announcementId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!["ADMIN","CHAIRPERSON"].includes(role))
    throw new Error("Only Admin or Chairperson can delete announcements.");

  await prisma.announcement.delete({ where: { id: announcementId } });

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard/announcements");
}

// =============================================================================
// GET UNREAD COUNT  (for sidebar badge — unread = no readAt in Notification)
// =============================================================================

export async function getUnreadNotificationCount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return 0;

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return 0;

  return prisma.notification.count({
    where: { userId: dbUser.id, readAt: null },
  });
}

// =============================================================================
// MARK NOTIFICATIONS READ
// =============================================================================

export async function markNotificationsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return;

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return;

  await prisma.notification.updateMany({
    where:  { userId: dbUser.id, readAt: null },
    data:   { readAt: new Date() },
  });

  //revalidatePath("/dashboard/announcements");
}