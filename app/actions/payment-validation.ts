// app/actions/payment-validation.ts
// Checks the member's actual state BEFORE a payment is allowed to start.
// Called when the category changes on the Payments page.
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { LoanStatus, ContributionType, FineStatus } from "@prisma/client";

export type PaymentCategory = "monthly" | "loan" | "fines" | "shares";

export interface PaymentContext {
  allowed:        boolean;   // false = block the form / show a message instead
  message:        string;    // shown to the user either way
  suggestedAmount: number;   // pre-fills the amount field
  maxAmount?:     number;    // caps the input where relevant (e.g. don't overpay a balance)
  refId?:         string;    // contributionId / loanId / etc — used by the submit handler
}

function kes(v: number) {
  return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export async function getPaymentContext(
  category: PaymentCategory
): Promise<PaymentContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { allowed: false, message: "Not authenticated.", suggestedAmount: 0 };
  }

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) {
    return { allowed: false, message: "User not found.", suggestedAmount: 0 };
  }

  // ── MONTHLY CONTRIBUTION ────────────────────────────────────────────────
  if (category === "monthly") {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const existing = await prisma.contribution.findFirst({
      where: {
        userId:      dbUser.id,
        type:        ContributionType.MONTHLY,
        periodMonth: month,
        periodYear:  year,
      },
    });

    const feeConfig = await prisma.systemConfig.findUnique({
      where: { key: "MONTHLY_CONTRIBUTION_KES" },
    });
    const monthlyFee = parseFloat(feeConfig?.value ?? "500");

    if (existing && existing.status === "PAID") {
      return {
        allowed: false,
        message: `You have already paid your ${now.toLocaleDateString("en-KE", { month: "long", year: "numeric" })} contribution in full.`,
        suggestedAmount: 0,
      };
    }

    if (existing && existing.status === "PARTIALLY_PAID") {
      const balance = existing.expectedAmount - existing.paidAmount;
      return {
        allowed: true,
        message: `You have a partial balance of ${kes(balance)} remaining for ${now.toLocaleDateString("en-KE", { month: "long", year: "numeric" })}.`,
        suggestedAmount: balance,
        maxAmount: balance,
        refId: existing.id,
      };
    }

    // No record yet — full month is owed
    return {
      allowed: true,
      message: `Pay your ${now.toLocaleDateString("en-KE", { month: "long", year: "numeric" })} contribution of ${kes(monthlyFee)}.`,
      suggestedAmount: monthlyFee,
      refId: existing?.id,
    };
  }

  // ── LOAN REPAYMENT ──────────────────────────────────────────────────────
  if (category === "loan") {
    const activeLoan = await prisma.loan.findFirst({
      where: {
        userId: dbUser.id,
        status: { in: [LoanStatus.DISBURSED, LoanStatus.REPAYING] },
      },
      include: {
        repayments: {
          where:   { status: { in: ["PENDING", "MISSED", "PARTIALLY_PAID"] } },
          orderBy: { dueDate: "asc" },
          take:    1,
        },
      },
    });

    if (!activeLoan) {
      return {
        allowed: false,
        message: "You have no active loan to repay. Apply for a loan from the Loans page if you need one.",
        suggestedAmount: 0,
      };
    }

    const nextInstalment = activeLoan.repayments[0];
    const suggested = nextInstalment
      ? nextInstalment.expectedAmount - nextInstalment.paidAmount
      : activeLoan.monthlyInstalment;

    return {
      allowed: true,
      message: `Outstanding loan balance: ${kes(activeLoan.outstandingBalance)}.${
        nextInstalment
          ? ` Next instalment of ${kes(suggested)} due ${new Date(nextInstalment.dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.`
          : ""
      }`,
      suggestedAmount: suggested,
      maxAmount: activeLoan.outstandingBalance,
      refId: activeLoan.id,
    };
  }

  // ── FINES ───────────────────────────────────────────────────────────────
  if (category === "fines") {
    const outstandingFines = await prisma.fine.findMany({
      where: { userId: dbUser.id, status: FineStatus.OUTSTANDING },
    });

    const total = outstandingFines.reduce((s, f) => s + f.amount, 0);

    if (outstandingFines.length === 0) {
      return {
        allowed: false,
        message: "You have no outstanding fines. Nothing to pay here.",
        suggestedAmount: 0,
      };
    }

    return {
      allowed: true,
      message: `You have ${outstandingFines.length} outstanding fine${outstandingFines.length > 1 ? "s" : ""} totalling ${kes(total)}.`,
      suggestedAmount: total,
      maxAmount: total,
    };
  }

  // ── SHARES ──────────────────────────────────────────────────────────────
  if (category === "shares") {
    const priceConfig = await prisma.systemConfig.findUnique({
      where: { key: "SHARE_PRICE_KES" },
    });
    const sharePrice = parseFloat(priceConfig?.value ?? "100");

    return {
      allowed: true,
      message: `Current share price: ${kes(sharePrice)} per unit. Enter the amount you'd like to invest.`,
      suggestedAmount: sharePrice,
    };
  }

  return { allowed: false, message: "Unknown payment category.", suggestedAmount: 0 };
}