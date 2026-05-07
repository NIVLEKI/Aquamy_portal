// app/actions/auth-actions.ts
// ⚠️  This file is SERVER ACTIONS only — "use server" at the top.
//     It is NOT the NextAuth config. That lives at:
//     app/api/auth/[...nextauth]/route.ts
"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

// =============================================================================
// HELPERS
// =============================================================================

async function generateMemberNumber(): Promise<string> {
  const latest = await prisma.user.findFirst({
    orderBy: { createdAt: "desc" },
    select:  { memberNumber: true },
  });
  if (!latest?.memberNumber) return "AQUAMY-0001";
  const match = latest.memberNumber.match(/(\d+)$/);
  const next  = match ? parseInt(match[1], 10) + 1 : 1;
  return `AQUAMY-${String(next).padStart(4, "0")}`;
}

function getAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// =============================================================================
// REGISTER MEMBER
// =============================================================================

export async function registerMember(formData: FormData) {
  const firstName  = (formData.get("firstName")  as string)?.trim();
  const lastName   = (formData.get("lastName")   as string)?.trim();
  const middleName = (formData.get("middleName") as string)?.trim() || "";
  const email      = (formData.get("email")      as string)?.trim().toLowerCase();
  const phone      = (formData.get("phone")      as string)?.trim();
  const dobRaw     = formData.get("dob")         as string;
  const password   = formData.get("password")    as string;
  const inviteCode = (formData.get("inviteCode") as string)?.trim().toUpperCase();

  if (!firstName || !lastName || !email || !phone || !dobRaw || !password || !inviteCode) {
    throw new Error("All required fields must be filled in.");
  }

  // ── Invite code ────────────────────────────────────────────────────────────
  const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
  if (!invite)       throw new Error("Invalid invite code. Please check your code and try again.");
  if (invite.isUsed) throw new Error("This invite code has already been used.");

  // ── Age validation ─────────────────────────────────────────────────────────
  const dateOfBirth = new Date(dobRaw);
  if (isNaN(dateOfBirth.getTime())) throw new Error("Invalid date of birth.");
  const age = getAge(dateOfBirth);
  if (age > 35) throw new Error(`The AQUAMY constitution limits membership to persons aged 35 and below. Your current age is ${age}.`);
  if (age < 18) throw new Error("Members must be at least 18 years old.");

  // ── Duplicate checks ───────────────────────────────────────────────────────
  const [emailExists, phoneExists] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { phone } }),
  ]);
  if (emailExists) throw new Error("An account with this email address already exists.");
  if (phoneExists) throw new Error("An account with this phone number already exists.");

  const fullName     = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const passwordHash = await bcrypt.hash(password, 12);
  const memberNumber = await generateMemberNumber();

  // ── Create user + consume invite atomically ────────────────────────────────
  await prisma.$transaction([
    prisma.user.create({
      data: {
        memberNumber,
        name:        fullName,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        password:    passwordHash,
        role:        "MEMBER",
        status:      "PENDING",
        isActive:    false,
      },
    }),
    prisma.inviteCode.update({
      where: { code: inviteCode },
      data:  { isUsed: true },
    }),
  ]);
}

// =============================================================================
// GET PENDING MEMBERS
// =============================================================================

export async function getPendingMembers() {
  return prisma.user.findMany({
    where: {
      OR:  [{ status: "PENDING" }, { isActive: false }],
      NOT: { status: "ACTIVE" },
    },
    select: {
      id: true, name: true, firstName: true, lastName: true,
      email: true, phone: true, memberNumber: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

// =============================================================================
// APPROVE MEMBER
// =============================================================================

export async function approveMember(userId: string) {
  if (!userId) throw new Error("No user ID provided.");

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { status: true },
  });
  if (!user)                    throw new Error("Member not found.");
  if (user.status === "ACTIVE") throw new Error("Member is already active.");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data:  { status: "ACTIVE", isActive: true },
    }),
    prisma.memberFinancialSummary.upsert({
      where:  { userId },
      create: { userId, totalContributed: 0, totalSharesValue: 0, totalPenaltiesPaid: 0, totalFinesPaid: 0, outstandingArrears: 0, outstandingFines: 0, outstandingLoanBalance: 0, totalLoansRepaid: 0 },
      update: {},
    }),
    prisma.share.upsert({
      where:  { userId },
      create: { userId, quantity: 0, totalValue: 0 },
      update: {},
    }),
  ]);

  revalidatePath("/admin/approvals");
  revalidatePath("/dashboard");
}