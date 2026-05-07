"use server";

import prisma from "../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ContributionStatus, ContributionType, UserStatus } from "@prisma/client";

export async function recordContribution(formData: FormData) {
  const userId = formData.get("userId") as string;
  const rawAmount = parseFloat(formData.get("amount") as string);
  const type = formData.get("type") as ContributionType;
  const paidAt = formData.get("paidAt") as string;
  const mpesaReceiptId = formData.get("mpesaReceiptId") as string;
  
  // New fields for monthly tracking
  const periodMonth = formData.get("periodMonth") ? parseInt(formData.get("periodMonth") as string) : null;
  const periodYear = formData.get("periodYear") ? parseInt(formData.get("periodYear") as string) : null;

  if (!userId || !rawAmount || !type) {
    throw new Error("Missing required fields.");
  }

  // 1. Create the Contribution Record (Aligned with v3 schema)
  await prisma.contribution.create({
    data: {
      userId,
      paidAmount: rawAmount,          // New source of truth
      expectedAmount: rawAmount,      // Assuming manual entry means they paid what was expected
      type: type,
      status: ContributionStatus.PAID, // Using Prisma enum
      periodMonth,
      periodYear,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      mpesaReceiptId: mpesaReceiptId || null,
    },
  });

  // 2. Update the Member's Financial Summary
  await prisma.memberFinancialSummary.upsert({
    where: { userId },
    update: {
      totalContributed: { increment: rawAmount },
    },
    create: {
      userId,
      totalContributed: rawAmount,
    }
  });

  // 3. Append to the Group Ledger
  const lastEntry = await prisma.groupLedgerEntry.findFirst({
    orderBy: { recordedAt: 'desc' }
  });
  
  // Convert Decimal to number for safe math
  const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

  await prisma.groupLedgerEntry.create({
    data: {
      description: `Manual entry: ${type} for user ${userId}`,
      entryType: "CONTRIBUTION",
      amount: rawAmount,
      isCredit: true,
      balanceAfter: currentBalance + rawAmount,
      recordedBy: "ADMIN_MANUAL_ENTRY", // Ideally replaced with session.user.id later
    }
  });

  revalidatePath("/admin/data-entry");
  return { success: true };
}

export async function getActiveMembers() {
  return await prisma.user.findMany({
    where: { 
      status: UserStatus.ACTIVE // Updated to use Enum
    }, 
    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      middleName: true,
      memberNumber: true 
    },
    orderBy: { firstName: "asc" } // Changed from `name` to `firstName`
  });
}