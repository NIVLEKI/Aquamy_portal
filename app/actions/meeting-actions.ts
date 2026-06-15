// app/actions/meeting-actions.ts — v2
// Fixed: agenda field removed from create until migration is run,
// then re-added. Also guards against the field not existing yet.
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { MeetingType, MemberStatus } from "@prisma/client";

const ALLOWED_ROLES = [
  "ADMIN","CHAIRPERSON","VICE_CHAIRPERSON","SECRETARY","TREASURER",
];

export async function scheduleMeeting(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!ALLOWED_ROLES.includes(role))
    throw new Error("Only management roles can schedule meetings.");

  const title   = (formData.get("title")  as string)?.trim();
  const typeRaw = (formData.get("type")   as string);
  const dateRaw = (formData.get("date")   as string);
  const venue   = (formData.get("venue")  as string)?.trim();
  const agenda  = (formData.get("agenda") as string)?.trim() || null;

  if (!title || !typeRaw || !dateRaw || !venue)
    throw new Error("Title, type, date and venue are required.");

  const validTypes = Object.values(MeetingType) as string[];
  if (!validTypes.includes(typeRaw))
    throw new Error(`Invalid meeting type: ${typeRaw}`);

  const scheduledAt = new Date(dateRaw);
  if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date.");
  if (scheduledAt < new Date())     throw new Error("Meeting date must be in the future.");

  // ── Create meeting ────────────────────────────────────────────────────────
  // `agenda` is included — make sure you've run:
  //   npx prisma migrate dev --name add_meeting_agenda
  // before using this action, otherwise remove the agenda line below.
  const meeting = await prisma.meeting.create({
    data: {
      title,
      type:  typeRaw as MeetingType,
      date:  scheduledAt,
      venue,
      agenda,           // ← requires migration; remove if not yet migrated
    },
  });

  // ── Notify all active members ─────────────────────────────────────────────
  const activeMembers = await prisma.user.findMany({
    where:  { status: MemberStatus.ACTIVE },
    select: { id: true },
  });

  if (activeMembers.length > 0) {
    const dateStr = scheduledAt.toLocaleDateString("en-KE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = scheduledAt.toLocaleTimeString("en-KE", {
      hour: "2-digit", minute: "2-digit",
    });

    await prisma.notification.createMany({
      data: activeMembers.map(m => ({
        userId:  m.id,
        channel: "IN_APP",
        subject: `📅 Meeting Scheduled: ${title}`,
        body: [
          `A ${typeRaw.replace(/_/g, " ")} has been scheduled.`,
          `📅 Date: ${dateStr} at ${timeStr}`,
          `📍 Venue: ${venue}`,
          agenda ? `📋 Agenda: ${agenda}` : null,
        ].filter(Boolean).join("\n"),
      })),
    });
  }

  revalidatePath("/admin/data-entry");
  revalidatePath("/dashboard/announcements");

  return { success: true, meetingId: meeting.id };
}