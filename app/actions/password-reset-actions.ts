// app/actions/password-reset-actions.ts
// Forgot password + reset password server actions.
// Only ACTIVE members can reset passwords — PENDING/SUSPENDED cannot.
"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";
import { MemberStatus } from "@prisma/client";

// =============================================================================
// REQUEST PASSWORD RESET  (forgot password form)
// Always returns a generic message to prevent email enumeration.
// =============================================================================

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) throw new Error("Email address is required.");

  // Generic message returned regardless — prevents enumeration attacks
  const GENERIC = "If an active account exists for this email, a reset link has been sent.";

  const user = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, name: true, firstName: true, status: true },
  });

  // Only active members can reset — silently ignore others
  if (!user || user.status !== MemberStatus.ACTIVE) {
    return { message: GENERIC };
  }

  const displayName = user.firstName ?? user.name;
  await sendPasswordResetEmail(user.id, email, displayName);

  return { message: GENERIC };
}

// =============================================================================
// RESET PASSWORD  (from the reset link)
// =============================================================================

export async function resetPassword(formData: FormData) {
  const token           = (formData.get("token")           as string)?.trim();
  const newPassword     = (formData.get("newPassword")     as string);
  const confirmPassword = (formData.get("confirmPassword") as string);

  if (!token)                              throw new Error("Reset token is missing.");
  if (!newPassword || !confirmPassword)    throw new Error("Please fill in all fields.");
  if (newPassword !== confirmPassword)     throw new Error("Passwords do not match.");
  if (newPassword.length < 8)             throw new Error("Password must be at least 8 characters.");

  const record = await prisma.passwordResetToken.findUnique({
    where:   { token },
    include: { user: { select: { id: true, status: true } } },
  });

  if (!record)                              throw new Error("This reset link is invalid.");
  if (record.usedAt)                        throw new Error("This reset link has already been used.");
  if (record.expiresAt < new Date())        throw new Error("This reset link has expired. Please request a new one.");
  if (record.user.status !== MemberStatus.ACTIVE)
    throw new Error("Only active members can reset their password.");

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  { password: hashed },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
  ]);
}