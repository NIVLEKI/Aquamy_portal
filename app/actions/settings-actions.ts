// app/actions/settings-actions.ts — v2
// Fixed: removed occupation + subLocation (not in schema).
// To add them later: add `occupation String?` and `subLocation String?`
// to the User model in schema.prisma, then run prisma migrate dev.
"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

// =============================================================================
// UPDATE PROFILE
// =============================================================================

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const firstName       = (formData.get("firstName")  as string)?.trim();
  const lastName        = (formData.get("lastName")   as string)?.trim();
  const phone           = (formData.get("phone")      as string)?.trim();
  const profilePhotoUrl = (formData.get("profilePhotoUrl") as string)?.trim() || null;

  if (!firstName || !lastName) throw new Error("First and last name are required.");
  if (!phone)                  throw new Error("Phone number is required.");

  const currentUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!currentUser) throw new Error("User not found.");

  // Check phone isn't taken by another member
  const phoneConflict = await prisma.user.findFirst({
    where: { phone, id: { not: currentUser.id } },
  });
  if (phoneConflict) throw new Error("This phone number is already registered to another member.");

  await prisma.user.update({
    where: { id: currentUser.id },
    data:  {
      firstName,
      lastName,
      name:            `${firstName} ${lastName}`,
      phone,
      profilePhotoUrl: profilePhotoUrl || null,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

// =============================================================================
// CHANGE PASSWORD
// =============================================================================

export async function changePassword(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword     = formData.get("newPassword")     as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword)
    throw new Error("All password fields are required.");
  if (newPassword !== confirmPassword)
    throw new Error("New passwords do not match.");
  if (newPassword.length < 8)
    throw new Error("Password must be at least 8 characters.");
  if (newPassword === currentPassword)
    throw new Error("New password must be different from current password.");

  const user = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true, password: true },
  });
  if (!user) throw new Error("User not found.");

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error("Current password is incorrect.");

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  { password: hashed },
  });
}

// =============================================================================
// ADMIN: UPDATE MEMBER
// Handles joining date override + role + status changes.
// =============================================================================

export async function adminUpdateMember(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const actorRole = (session.user as { role?: string }).role ?? "MEMBER";
  if (!["ADMIN","CHAIRPERSON","SECRETARY","TREASURER"].includes(actorRole))
    throw new Error("Insufficient permissions.");

  const userId      = formData.get("userId")    as string;
  const firstName   = (formData.get("firstName") as string)?.trim();
  const lastName    = (formData.get("lastName")  as string)?.trim();
  const phone       = (formData.get("phone")     as string)?.trim();
  const role        = formData.get("role")        as string;
  const status      = formData.get("status")      as string;
  const joinedAtRaw = formData.get("joinedAt")   as string;

  if (!userId) throw new Error("Member ID is required.");

  const updateData: Record<string, unknown> = {};

  if (firstName && lastName) {
    updateData.firstName = firstName;
    updateData.lastName  = lastName;
    updateData.name      = `${firstName} ${lastName}`;
  }
  if (phone)  updateData.phone  = phone;
  if (role)   updateData.role   = role;
  if (status) {
    updateData.status   = status;
    updateData.isActive = status === "ACTIVE";
  }

  // Joining date override — core feature for pre-existing members
  if (joinedAtRaw) {
    const joinedAt = new Date(joinedAtRaw);
    if (isNaN(joinedAt.getTime())) throw new Error("Invalid joining date.");
    if (joinedAt > new Date())     throw new Error("Joining date cannot be in the future.");
    updateData.createdAt = joinedAt;
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });

  // Audit log
  const actor = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (actor) {
    await prisma.auditLog.create({
      data: {
        actorId:    actor.id,
        action:     "ADMIN_MEMBER_UPDATE",
        entityType: "User",
        entityId:   userId,
        newValues:  updateData as object,
      },
    });
  }

  revalidatePath("/admin/members");
  revalidatePath("/admin/data-entry");
}