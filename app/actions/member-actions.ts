// app/actions/member-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { MemberStatus } from "@prisma/client";

type StatusAction = "SUSPEND" | "EXPEL" | "REACTIVATE";

// =============================================================================
// CHANGE MEMBER STATUS
// Handles Suspend, Expel, and Reactivate.
// All three write an immutable AuditLog entry.
// =============================================================================

export async function changeMemberStatus(
  userId:    string,
  action:    StatusAction,
  reason:    string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const actorRole = (session.user as { role?: string }).role ?? "MEMBER";

  // Only Chairperson and Admin can suspend or expel
  if (!["ADMIN", "CHAIRPERSON"].includes(actorRole))
    throw new Error("Only the Chairperson or Admin can change member status.");

  if (!reason?.trim())
    throw new Error("A reason is required. This is recorded in the audit log.");

  const target = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, status: true, name: true, firstName: true, role: true },
  });

  if (!target) throw new Error("Member not found.");

  // Prevent acting on another Admin
  if (target.role === "ADMIN")
    throw new Error("Admin accounts cannot be suspended or expelled through this panel.");

  // Validate state transitions
  if (action === "SUSPEND" && target.status === MemberStatus.SUSPENDED)
    throw new Error("Member is already suspended.");
  if (action === "EXPEL" && target.status === MemberStatus.EXPELLED)
    throw new Error("Member is already expelled.");
  if (action === "REACTIVATE" && target.status === MemberStatus.ACTIVE)
    throw new Error("Member is already active.");

  const newStatus: MemberStatus =
    action === "SUSPEND"    ? MemberStatus.SUSPENDED :
    action === "EXPEL"      ? MemberStatus.EXPELLED  :
    MemberStatus.ACTIVE;

  const actor = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data:  {
        status:   newStatus,
        isActive: newStatus === MemberStatus.ACTIVE,
        exitedAt: action === "EXPEL" ? new Date() : null,
      },
    }),

    // Notify the member
    prisma.notification.create({
      data: {
        userId,
        channel: "IN_APP",
        subject: `Account ${action === "SUSPEND" ? "Suspended" : action === "EXPEL" ? "Expelled" : "Reactivated"}`,
        body:
          action === "REACTIVATE"
            ? "Your AQUAMY account has been reactivated. You may now access the member portal."
            : `Your AQUAMY account has been ${action === "SUSPEND" ? "suspended" : "expelled"} by the committee. Reason: ${reason}. Please contact the Secretary for further information.`,
      },
    }),

    // Immutable audit entry
    prisma.auditLog.create({
      data: {
        actorId:    actor?.id ?? "SYSTEM",
        action:     `MEMBER_${action}`,
        entityType: "User",
        entityId:   userId,
        oldValues:  { status: target.status },
        newValues:  { status: newStatus, reason },
      },
    }),
  ]);

  revalidatePath("/admin/members");
}