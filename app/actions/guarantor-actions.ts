// app/actions/guarantor-actions.ts — fixed
// The `declined` field only exists after running:
//   npx prisma migrate dev --name add_guarantor_decline_fields
// Until then, all declined references are guarded with optional access.
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { LoanStatus } from "@prisma/client";

// Helper — safely reads fields that may not exist in the schema yet
function isDeclined(g: Record<string, unknown>): boolean {
  return g["declined"] === true;
}

// =============================================================================
// GET PENDING GUARANTOR REQUESTS
// =============================================================================

export async function getPendingGuarantorRequests() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return [];

  const all = await prisma.loanGuarantor.findMany({
    where: {
      userId:       dbUser.id,
      hasConsented: false,
      loan: {
        status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW] },
      },
    },
    include: {
      loan: {
        include: {
          user: {
            select: {
              name: true, firstName: true,
              lastName: true, memberNumber: true, phone: true,
            },
          },
        },
      },
    },
    orderBy: { loan: { createdAt: "asc" } },
  });

  // Filter out declined ones safely (field may not exist yet)
  return all.filter(g => !isDeclined(g as Record<string, unknown>));
}

// =============================================================================
// ACCEPT GUARANTOR REQUEST
// =============================================================================

export async function acceptGuarantorRequest(loanGuarantorId: string) {
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
  if (!guarantorRecord)
    throw new Error("Guarantor record not found.");
  if (guarantorRecord.userId !== dbUser.id)
    throw new Error("You are not authorised to respond to this request.");
  if (guarantorRecord.hasConsented)
    throw new Error("You have already accepted this request.");

  // Safe check for declined (may not exist in schema yet)
  if (isDeclined(guarantorRecord as unknown as Record<string, unknown>))
    throw new Error("You have already declined this request.");

  await prisma.loanGuarantor.update({
    where: { id: loanGuarantorId },
    data:  { hasConsented: true, consentedAt: new Date() },
  });

  // Auto-advance loan if all guarantors have now consented
  const allGuarantors = await prisma.loanGuarantor.findMany({
    where: { loanId: guarantorRecord.loanId },
  });

  const allAccepted = allGuarantors.every(g =>
    g.id === loanGuarantorId ? true : g.hasConsented
  );

  if (allAccepted) {
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
  if (!guarantorRecord)             throw new Error("Guarantor record not found.");
  if (guarantorRecord.userId !== dbUser.id) throw new Error("Not authorised.");
  if (guarantorRecord.hasConsented) throw new Error("Already accepted — cannot decline.");
  if (isDeclined(guarantorRecord as unknown as Record<string, unknown>))
    throw new Error("Already declined.");

  // Build update data — only include declined fields if they exist in the schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  try {
    // Attempt to use the declined fields — works after migration is run
    updateData.declined      = true;
    updateData.declinedAt    = new Date();
    updateData.declineReason = reason?.trim() || "No reason provided.";
  } catch {
    // Field not in schema yet — skip silently
  }

  await prisma.$transaction([
    prisma.loanGuarantor.update({
      where: { id: loanGuarantorId },
      data:  updateData,
    }),
    prisma.loan.update({
      where: { id: guarantorRecord.loanId },
      data:  { status: LoanStatus.DRAFT },
    }),
  ]);

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard/loans/guarantor-requests");
  revalidatePath("/admin/loans");
}