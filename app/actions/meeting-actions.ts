// app/actions/meeting-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { MeetingType, MemberStatus } from "@prisma/client";

export async function scheduleMeeting(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!["ADMIN","CHAIRPERSON","VICE_CHAIRPERSON","SECRETARY","TREASURER"].includes(role))
    throw new Error("Only management roles can schedule meetings.");

  const title   = (formData.get("title")   as string)?.trim();
  const typeRaw = formData.get("type")      as string;
  const dateRaw = formData.get("date")      as string;
  const venue   = (formData.get("venue")   as string)?.trim();
  const agenda  = (formData.get("agenda")  as string)?.trim() || null;

  if (!title || !typeRaw || !dateRaw || !venue)
    throw new Error("Title, type, date and venue are required.");

  const validTypes = Object.values(MeetingType) as string[];
  if (!validTypes.includes(typeRaw))
    throw new Error("Invalid meeting type.");

  const scheduledAt = new Date(dateRaw);
  if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date.");
  if (scheduledAt < new Date())     throw new Error("Meeting date must be in the future.");

  // Create the meeting
  const meeting = await prisma.meeting.create({
    data: {
      title,
      type:        typeRaw as MeetingType,
      date:        scheduledAt,
      venue,
      agenda,
    },
  });

  // Notify all active members
  const activeMembers = await prisma.user.findMany({
    where:  { status: MemberStatus.ACTIVE },
    select: { id: true },
  });

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
      subject: `Meeting Scheduled: ${title}`,
      body:    `A ${typeRaw.replace(/_/g," ")} has been scheduled for ${dateStr} at ${timeStr}, ${venue}.${agenda ? ` Agenda: ${agenda}` : ""}`,
    })),
  });

  revalidatePath("/admin/data-entry");
  revalidatePath("/dashboard");
}