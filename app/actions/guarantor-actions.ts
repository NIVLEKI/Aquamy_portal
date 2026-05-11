// app/actions/guarantor-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { LoanStatus } from "@prisma/client";

// ── Decode declined status from notes field ──────────────────────────────────
// We avoid a schema migration by encoding decline in the existing `notes` field.
// DECLINED guarantors: hasConsented = false, notes = "DECLINED", consentedAt = set
// ACCEPTED guarantors: hasConsented = true,  consentedAt = set
// PENDING  guarantors: hasConsented = false, consentedAt = null
export const DECLINED_FLAG = "DECLINED";

// =============================================================================
// GET PENDING GUARANTOR REQUESTS  (for the logged-in user's guarantor page)
// =============================================================================

export async function getPendingGuarantorRequests() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!dbUser) return [];

  return prisma.loanGuarantor.findMany({
    where: {
      userId:       dbUser.id,
      hasConsented: false,
      notes:        { not: DECLINED_FLAG }, // not yet declined
      consentedAt:  null,                   // not yet responded at all
    },
    include: {
      loan: {
        include: {
          user: {
            select: { name: true, firstName: true, lastName: true, memberNumber: true, phone: true },
          },
          loanPolicy: { select: { interestRate: true, interestMethod: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// =============================================================================
// ACCEPT GUARANTOR REQUEST
// Shows a liability warning on the UI — the server records the acceptance.
// =============================================================================

export async function acceptGuarantorRequest(loanId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!dbUser) throw new Error("User not found.");

  const guarantor = await prisma.loanGuarantor.findUnique({
    where: { loanId_userId: { loanId, userId: dbUser.id } },
  });
  if (!guarantor) throw new Error("Guarantor record not found.");
  if (guarantor.hasConsented) throw new Error("You have already accepted this request.");
  if (guarantor.notes === DECLINED_FLAG) throw new Error("You have already declined this request.");

  // Mark this guarantor as consented
  await prisma.loanGuarantor.update({
    where: { loanId_userId: { loanId, userId: dbUser.id } },
    data:  { hasConsented: true, consentedAt: new Date() },
  });

  // ── Check if ALL guarantors have now accepted ──────────────────────────────
  const allGuarantors = await prisma.loanGuarantor.findMany({
    where: { loanId },
  });

  const allAccepted = allGuarantors.every(g =>
    g.userId === dbUser.id ? true : g.hasConsented // current one just accepted
  );

  if (allAccepted) {
    // Move loan to UNDER_REVIEW so Credit Committee can action it
    await prisma.loan.update({
      where: { id: loanId },
      data:  { status: LoanStatus.UNDER_REVIEW },
    });
  }

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard/loans/guarantor-requests");
  revalidatePath("/admin/loans");
}

// =============================================================================
// DECLINE GUARANTOR REQUEST
// =============================================================================

export async function declineGuarantorRequest(loanId: string, reason?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true, name: true, firstName: true },
  });
  if (!dbUser) throw new Error("User not found.");

  const guarantor = await prisma.loanGuarantor.findUnique({
    where: { loanId_userId: { loanId, userId: dbUser.id } },
  });
  if (!guarantor) throw new Error("Guarantor record not found.");
  if (guarantor.hasConsented)           throw new Error("You have already accepted — cannot decline.");
  if (guarantor.notes === DECLINED_FLAG) throw new Error("You have already declined this request.");

  // Encode decline in the notes field (no migration needed)
  const declineNote = reason
    ? `${DECLINED_FLAG}: ${reason}`
    : DECLINED_FLAG;

  await prisma.loanGuarantor.update({
    where: { loanId_userId: { loanId, userId: dbUser.id } },
    data:  { notes: declineNote, consentedAt: new Date() }, // consentedAt = responded at
  });

  // Keep loan at SUBMITTED but a decline is now visible to the applicant
  // (loan will NOT move to UNDER_REVIEW until a replacement guarantor is found)

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard/loans/guarantor-requests");
  revalidatePath("/admin/loans");
}