// app/actions/guarantor-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { LoanStatus } from "@prisma/client";

// =============================================================================
// GET PENDING GUARANTOR REQUESTS
// Returns loans where the current user is listed as a guarantor
// and has not yet responded (neither consented nor declined).
// =============================================================================

export async function getPendingGuarantorRequests() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return [];

  return prisma.loanGuarantor.findMany({
    where: {
      userId:      dbUser.id,
      hasConsented: false,
      declined:     false,
      loan: {
        status: {
          in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW],
        },
      },
    },
    include: {
      loan: {
        include: {
          user: {
            select: {
              name:         true,
              firstName:    true,
              lastName:     true,
              memberNumber: true,
              phone:        true,
            },
          },
        },
      },
    },
    orderBy: { loan: { createdAt: "asc" } },
  });
}

// =============================================================================
// ACCEPT GUARANTOR REQUEST
// Marks the guarantor as consented.
// If ALL guarantors on the loan have now consented, automatically
// advances the loan from SUBMITTED → UNDER_REVIEW for the committee.
// =============================================================================

export async function acceptGuarantorRequest(loanGuarantorId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) throw new Error("User not found.");

  // Verify this guarantor record belongs to the current user
  const guarantorRecord = await prisma.loanGuarantor.findUnique({
    where: { id: loanGuarantorId },
  });
  if (!guarantorRecord)
    throw new Error("Guarantor record not found.");
  if (guarantorRecord.userId !== dbUser.id)
    throw new Error("You are not authorised to respond to this request.");
  if (guarantorRecord.hasConsented)
    throw new Error("You have already accepted this request.");
  if (guarantorRecord.declined)
    throw new Error("You have already declined this request.");

  // Mark this guarantor as consented
  await prisma.loanGuarantor.update({
    where: { id: loanGuarantorId },
    data:  { hasConsented: true, consentedAt: new Date() },
  });

  // Check if ALL guarantors on this loan have now consented
  const allGuarantors = await prisma.loanGuarantor.findMany({
    where: { loanId: guarantorRecord.loanId },
  });

  const allAccepted = allGuarantors.every(g =>
    g.id === loanGuarantorId ? true : g.hasConsented // include the one we just updated
  );

  if (allAccepted) {
    // Auto-advance loan to UNDER_REVIEW — ready for committee
    await prisma.loan.update({
      where: { id: guarantorRecord.loanId },
      data:  { status: LoanStatus.UNDER_REVIEW },
    });
  }

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard/loans/guarantor-requests");
  revalidatePath("/admin/loans");
}

// =============================================================================
// DECLINE GUARANTOR REQUEST
// Marks the guarantor as declined and moves the loan back to DRAFT
// so the applicant can select a different guarantor.
// =============================================================================

export async function declineGuarantorRequest(
  loanGuarantorId: string,
  reason: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) throw new Error("User not found.");

  const guarantorRecord = await prisma.loanGuarantor.findUnique({
    where: { id: loanGuarantorId },
  });
  if (!guarantorRecord)         throw new Error("Guarantor record not found.");
  if (guarantorRecord.userId !== dbUser.id) throw new Error("Not authorised.");
  if (guarantorRecord.declined) throw new Error("Already declined.");
  if (guarantorRecord.hasConsented) throw new Error("Already accepted — cannot decline.");

  await prisma.$transaction([
    // Mark this guarantor as declined
    prisma.loanGuarantor.update({
      where: { id: loanGuarantorId },
      data:  {
        declined:      true,
        declinedAt:    new Date(),
        declineReason: reason?.trim() || "No reason provided.",
      },
    }),

    // Move loan back to DRAFT so applicant can resubmit with new guarantor
    prisma.loan.update({
      where: { id: guarantorRecord.loanId },
      data:  { status: LoanStatus.DRAFT },
    }),
  ]);

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard/loans/guarantor-requests");
  revalidatePath("/admin/loans");
}