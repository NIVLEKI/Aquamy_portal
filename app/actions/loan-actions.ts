// app/actions/loan-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { LoanStatus } from "@prisma/client";

// =============================================================================
// APPLY FOR LOAN
// Called from dashboard/loans/apply
// =============================================================================

export async function applyForLoan(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const dbUser = await prisma.user.findUnique({
    where:   { email: session.user.email },
    select:  { id: true, createdAt: true },
  });
  if (!dbUser) throw new Error("User not found.");

  const principal  = parseFloat(formData.get("amount")      as string);
  const termMonths = parseInt(formData.get("termMonths")    as string);
  const purpose    = (formData.get("purpose")               as string)?.trim();
  const guarantorIds = formData.getAll("guarantorId")        as string[];

  if (!principal || isNaN(principal) || principal <= 0) throw new Error("Invalid loan amount.");
  if (!termMonths || isNaN(termMonths))                  throw new Error("Invalid term.");
  if (!purpose)                                          throw new Error("Loan purpose is required.");

  // Get active loan policy
  const policy = await prisma.loanPolicy.findFirst({ where: { active: true } });
  if (!policy) throw new Error("No active loan policy. Please contact the Treasurer.");

  if (principal < policy.minimumLoanAmount)
    throw new Error(`Minimum loan amount is KES ${policy.minimumLoanAmount.toLocaleString()}.`);
  if (principal > policy.maximumLoanAmount)
    throw new Error(`Maximum loan amount is KES ${policy.maximumLoanAmount.toLocaleString()}.`);
  if (termMonths > policy.maxDuration)
    throw new Error(`Maximum loan term is ${policy.maxDuration} months.`);

  // Check minimum membership duration
  const monthsAsMember = Math.floor(
    (Date.now() - new Date(dbUser.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  //if (monthsAsMember < policy.minimumMonthsAsMember)
    //throw new Error(`You must be a member for at least ${policy.minimumMonthsAsMember} months to apply.`);

  // Validate guarantors
  const uniqueGuarantors = [...new Set(guarantorIds.filter(Boolean))];
  if (uniqueGuarantors.includes(dbUser.id))
    throw new Error("You cannot guarantee your own loan.");
  if (uniqueGuarantors.length < policy.requiredGuarantors)
    throw new Error(`You must select ${policy.requiredGuarantors} different guarantors.`);

  // Calculate repayment
  const interestAmount  = policy.interestMethod === "FLAT"
    ? principal * (policy.interestRate / 100) * (termMonths / 12)
    : principal * (policy.interestRate / 100) * (termMonths / 12); // simplified
  const totalRepayable   = principal + interestAmount;
  const monthlyInstalment = totalRepayable / termMonths;

  // Create loan + guarantors in a transaction
  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        userId:            dbUser.id,
        loanPolicyId:      policy.id,
        principal,
        interestRate:      policy.interestRate,
        termMonths,
        totalRepayable,
        outstandingBalance: totalRepayable,
        monthlyInstalment,
        purpose,
        status:            LoanStatus.SUBMITTED,
      },
    });

    // Create guarantor records
    await tx.loanGuarantor.createMany({
      data: uniqueGuarantors.map(userId => ({
        loanId: loan.id,
        userId,
        hasConsented: false,
      })),
    });

    // Generate repayment schedule
    const schedule = [];
    for (let i = 1; i <= termMonths; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDate.setDate(1); // first of each month
      schedule.push({
        loanId:          loan.id,
        instalmentNumber: i,
        dueDate,
        expectedAmount:  monthlyInstalment,
        status:          "PENDING" as const,
      });
    }
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
    where: { OR: [{ status: "ACTIVE" }, { isActive: true }], NOT: { status: "PENDING" } },
    select: { id: true, name: true, firstName: true, lastName: true, memberNumber: true },
    orderBy: { name: "asc" },
  });
}

// =============================================================================
// APPROVE LOAN  (Credit Committee / Admin)
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
// REJECT LOAN  (Credit Committee / Admin)
// =============================================================================

export async function rejectLoan(loanId: string, reason: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Loan not found.");

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
// DISBURSE LOAN  (Treasurer / Admin only)
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

    // Update member summary
    prisma.memberFinancialSummary.upsert({
      where:  { userId: loan.userId },
      create: { userId: loan.userId, outstandingLoanBalance: loan.totalRepayable },
      update: { outstandingLoanBalance: { increment: loan.totalRepayable } },
    }),
  ]);

  revalidatePath("/admin/loans");
  revalidatePath("/dashboard/loans");
}


//now we have to rectify some gaps, there is no approval page / button for fully guaranteed loan, then the admin should be able to terminate /suspend as in the constitution- users assuming procedure was followed by the commitee, also he will have the responsibility to update the joining dates(in the existing data entry hub not another page please) of each user since some registered before the site existed(make admin able to write over the auto dates) also he should bbe able to schedule meeting directly from the data entry page and notifications appaer as i have explained below . Then later we can deal with the settings page for users (profile updates ,pictures) Finally we can include a page dedicated for anoouncements/notifications from the admin