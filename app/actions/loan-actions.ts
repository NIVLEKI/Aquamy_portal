// app/actions/loan-actions.ts — v2
// Added: active loan restriction in applyForLoan
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { LoanStatus } from "@prisma/client";

// Statuses that block a new application
const BLOCKING_STATUSES = [
  LoanStatus.SUBMITTED,
  LoanStatus.UNDER_REVIEW,
  LoanStatus.APPROVED,
  LoanStatus.DISBURSED,
  LoanStatus.REPAYING,
];

// =============================================================================
// APPLY FOR LOAN
// =============================================================================

export async function applyForLoan(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true, createdAt: true },
  });
  if (!dbUser) throw new Error("User not found.");

  // ── Active loan restriction ─────────────────────────────────────────────
  // Constitution: a member must clear existing obligations before borrowing again.
  const existingActiveLoan = await prisma.loan.findFirst({
    where: {
      userId: dbUser.id,
      status: { in: BLOCKING_STATUSES },
    },
    select: { id: true, status: true, outstandingBalance: true },
  });

  if (existingActiveLoan) {
    const statusLabel: Record<string, string> = {
      SUBMITTED:    "awaiting guarantor responses",
      UNDER_REVIEW: "under Credit Committee review",
      APPROVED:     "approved and awaiting disbursement",
      DISBURSED:    "disbursed",
      REPAYING:     "currently being repaid",
    };
    const label = statusLabel[existingActiveLoan.status] ?? existingActiveLoan.status;
    throw new Error(
      `You already have an active loan (${label}). ` +
      `Please clear your outstanding balance of KES ${existingActiveLoan.outstandingBalance.toLocaleString("en-KE")} ` +
      `before applying for a new one.`
    );
  }

  const principal  = parseFloat(formData.get("amount")     as string);
  const termMonths = parseInt(formData.get("termMonths")   as string);
  const purpose    = (formData.get("purpose")              as string)?.trim();
  const guarantorIds = formData.getAll("guarantorId")       as string[];

  if (!principal || isNaN(principal) || principal <= 0)
    throw new Error("Invalid loan amount.");
  if (!termMonths || isNaN(termMonths))
    throw new Error("Invalid term.");
  if (!purpose)
    throw new Error("Loan purpose is required per the AQUAMY constitution.");

  // Active policy
  const policy = await prisma.loanPolicy.findFirst({ where: { active: true } });
  if (!policy) throw new Error("No active loan policy. Contact the Treasurer.");

  if (principal < policy.minimumLoanAmount)
    throw new Error(`Minimum loan amount is KES ${policy.minimumLoanAmount.toLocaleString()}.`);
  if (principal > policy.maximumLoanAmount)
    throw new Error(`Maximum loan amount is KES ${policy.maximumLoanAmount.toLocaleString()}.`);
  if (termMonths > policy.maxDuration)
    throw new Error(`Maximum loan term is ${policy.maxDuration} months.`);

  // Membership duration check
  const monthsAsMember = Math.floor(
    (Date.now() - new Date(dbUser.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  if (monthsAsMember < policy.minimumMonthsAsMember)
    throw new Error(
      `You must be a member for at least ${policy.minimumMonthsAsMember} months to apply. ` +
      `You have been a member for ${monthsAsMember} month(s).`
    );

  // Guarantor validation
  const uniqueGuarantors = [...new Set(guarantorIds.filter(Boolean))];
  if (uniqueGuarantors.includes(dbUser.id))
    throw new Error("You cannot guarantee your own loan.");
  if (uniqueGuarantors.length < policy.requiredGuarantors)
    throw new Error(`You must select ${policy.requiredGuarantors} different guarantors.`);

  // Repayment calculation
  const interestAmount    = principal * (policy.interestRate / 100) * (termMonths / 12);
  const totalRepayable    = principal + interestAmount;
  const monthlyInstalment = totalRepayable / termMonths;

  // Create loan + guarantors + repayment schedule atomically
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        userId:             dbUser.id,
        loanPolicyId:       policy.id,
        principal,
        interestRate:       policy.interestRate,
        termMonths,
        totalRepayable,
        outstandingBalance: totalRepayable,
        monthlyInstalment,
        purpose,
        status:             LoanStatus.SUBMITTED,
      },
    });

    // Guarantor records
    await tx.loanGuarantor.createMany({
      data: uniqueGuarantors.map(userId => ({
        loanId: loan.id,
        userId,
        hasConsented: false,
      })),
    });

    // Repayment schedule
    const schedule = Array.from({ length: termMonths }, (_, i) => {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      dueDate.setDate(1);
      return {
        loanId:           loan.id,
        instalmentNumber: i + 1,
        dueDate,
        expectedAmount:   monthlyInstalment,
        status:           "PENDING" as const,
      };
    });

    await tx.loanRepayment.createMany({ data: schedule });
  });

  revalidatePath("/dashboard/loans");
  revalidatePath("/admin/loans");
}

// =============================================================================
// GET ACTIVE MEMBERS  (for guarantor dropdown)
// =============================================================================

export async function getActiveMembers() {
  return prisma.user.findMany({
    where:   { OR: [{ status: "ACTIVE" }, { isActive: true }], NOT: { status: "PENDING" } },
    select:  { id: true, name: true, firstName: true, lastName: true, memberNumber: true },
    orderBy: { name: "asc" },
  });
}

// =============================================================================
// APPROVE LOAN
// =============================================================================

export async function approveLoan(loanId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan not found.");
  if (loan.status !== LoanStatus.SUBMITTED && loan.status !== LoanStatus.UNDER_REVIEW)
    throw new Error("This loan cannot be approved in its current state.");

  await prisma.loan.update({
    where: { id: loanId },
    data:  { status: LoanStatus.APPROVED, approvedAt: new Date() },
  });

  revalidatePath("/admin/loans");
}

// =============================================================================
// REJECT LOAN
// =============================================================================

export async function rejectLoan(loanId: string, reason: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  await prisma.loan.update({
    where: { id: loanId },
    data:  {
      status:          LoanStatus.REJECTED,
      rejectionReason: reason || "Declined by Credit Committee.",
    },
  });

  revalidatePath("/admin/loans");
}

// =============================================================================
// DISBURSE LOAN
// =============================================================================

export async function disburseLoan(loanId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan not found.");
  if (loan.status !== LoanStatus.APPROVED)
    throw new Error("Only approved loans can be disbursed.");

  await prisma.$transaction([
    prisma.loan.update({
      where: { id: loanId },
      data:  { status: LoanStatus.DISBURSED, disbursedAt: new Date() },
    }),
    prisma.memberFinancialSummary.upsert({
      where:  { userId: loan.userId },
      create: { userId: loan.userId, outstandingLoanBalance: loan.totalRepayable },
      update: { outstandingLoanBalance: { increment: loan.totalRepayable } },
    }),
  ]);

  revalidatePath("/admin/loans");
  revalidatePath("/dashboard/loans");
}