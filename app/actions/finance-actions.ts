// app/actions/finance-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ContributionType } from "@prisma/client";

// =============================================================================
// HELPERS
// =============================================================================

/** Read a single fee constant from SystemConfig. Returns fallback if not seeded. */
async function getConfig(key: string, fallback: number): Promise<number> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row ? parseFloat(row.value) : fallback;
}

/** Map each ContributionType to its SystemConfig key and constitutional default */
const EXPECTED_AMOUNT_MAP: Record<
  ContributionType,
  { configKey: string; fallback: number }
> = {
  REGISTRATION_FEE: { configKey: "REGISTRATION_FEE_KES",     fallback: 250  },
  MAINTENANCE_FEE:  { configKey: "MAINTENANCE_FEE_KES",      fallback: 500  },
  MONTHLY:          { configKey: "MONTHLY_CONTRIBUTION_KES",  fallback: 500  },
  LATE_PENALTY:     { configKey: "LATE_PENALTY_KES",          fallback: 100  },
  ARREAR_PAYMENT:   { configKey: "MONTHLY_CONTRIBUTION_KES",  fallback: 500  },
};

/** Derive status from paid vs expected amounts */
function deriveStatus(paid: number, expected: number): string {
  if (paid <= 0)               return "PENDING";
  if (paid >= expected)        return "PAID";
  return "PARTIALLY_PAID";
}

// =============================================================================
// RECORD A CONTRIBUTION  (Treasurer data-entry action)
// =============================================================================

export async function recordContribution(formData: FormData) {
  const session = await getServerSession(authOptions);
  const recordedBy = (session?.user as { id?: string })?.id ?? "SYSTEM";
  // ── Parse form fields ──────────────────────────────────────────────────────
  const userId      = formData.get("userId")      as string;
  const typeRaw     = formData.get("type")         as string;
  const amountRaw   = formData.get("amount")       as string;
  const paidAtRaw   = formData.get("paidAt")       as string;
  const mpesaId     = (formData.get("mpesaReceiptId") as string)?.trim() || null;
  const monthRaw    = formData.get("periodMonth")  as string | null;
  const yearRaw     = formData.get("periodYear")   as string | null;
  const arrearsRaw  = formData.get("arrearsMonths") as string | null;

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!userId || !typeRaw || !amountRaw) {
    throw new Error("Missing required fields: member, type, and amount are required.");
  }

  // Validate the type is a valid ContributionType enum value
  const validTypes = Object.values(ContributionType) as string[];
  if (!validTypes.includes(typeRaw)) {
    throw new Error(`Invalid contribution type: ${typeRaw}`);
  }
  const type = typeRaw as ContributionType;

  const paidAmount = parseFloat(amountRaw);
  if (isNaN(paidAmount) || paidAmount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  // ── Get the constitutional expected amount from SystemConfig ───────────────
  const { configKey, fallback } = EXPECTED_AMOUNT_MAP[type];
  const expectedAmount = await getConfig(configKey, fallback);

  // ── Period fields (only meaningful for MONTHLY / ARREAR_PAYMENT) ──────────
  const isMonthly = type === ContributionType.MONTHLY || type === ContributionType.ARREAR_PAYMENT;
  const periodMonth = isMonthly && monthRaw ? parseInt(monthRaw, 10) : null;
  const periodYear  = isMonthly && yearRaw  ? parseInt(yearRaw, 10)  : null;
  const arrearsMonths = arrearsRaw ? parseInt(arrearsRaw, 10) : 0;

  if (isMonthly && (!periodMonth || !periodYear)) {
    throw new Error("Period month and year are required for monthly contributions.");
  }

  // ── Check for duplicate monthly entry ─────────────────────────────────────
  if (isMonthly && periodMonth && periodYear) {
    const existing = await prisma.contribution.findFirst({
      where: { userId, type, periodMonth, periodYear },
    });
    if (existing) {
      throw new Error(
        `A ${type} record for ${periodMonth}/${periodYear} already exists for this member.`
      );
    }
  }

  // ── Create the contribution record ────────────────────────────────────────
  const contribution = await prisma.contribution.create({
    data: {
      userId,
      type,
      // Legacy field kept for backward compat
      amount:         paidAmount,
      // New split fields — source of truth going forward
      paidAmount,
      expectedAmount,
      status:         deriveStatus(paidAmount, expectedAmount),
      periodMonth,
      periodYear,
      arrearsMonths,
      // Late penalty: 1 × KES 100 per arrear month (auto-calculated)
      latePenalty:
        type === ContributionType.MONTHLY && arrearsMonths > 0
          ? await getConfig("LATE_PENALTY_KES", 100) * arrearsMonths
          : 0,
      paidAt:         paidAtRaw ? new Date(paidAtRaw) : new Date(),
      mpesaReceiptId: mpesaId,
      recordedBy,
    },
  });

  // ── Update MemberFinancialSummary (pre-computed cache) ────────────────────
  // This is what the dashboard reads — if we don't update it, the member's
  // totals stay stale regardless of what's in the contributions table.
  await prisma.memberFinancialSummary.upsert({
    where:  { userId },
    create: {
      userId,
      totalContributed:   paidAmount,
      totalPenaltiesPaid: type === ContributionType.LATE_PENALTY ? paidAmount : 0,
    },
    update: {
      totalContributed:   { increment: paidAmount },
      totalPenaltiesPaid: type === ContributionType.LATE_PENALTY
        ? { increment: paidAmount }
        : undefined,
    },
  });

  // ── Append to Group Ledger (running balance) ───────────────────────────────
  // The latest row's balanceAfter is the current group treasury balance.
  const latestEntry = await prisma.groupLedgerEntry.findFirst({
    orderBy: { recordedAt: "desc" },
    select: { balanceAfter: true },
  });
  const prevBalance = latestEntry?.balanceAfter ?? 0;

  const typeLabel: Record<ContributionType, string> = {
    REGISTRATION_FEE: "Registration fee",
    MAINTENANCE_FEE:  "Maintenance fee",
    MONTHLY:          `Monthly contribution ${periodMonth ? `(${periodMonth}/${periodYear})` : ""}`,
    LATE_PENALTY:     "Late penalty",
    ARREAR_PAYMENT:   `Arrear payment ${periodMonth ? `(${periodMonth}/${periodYear})` : ""}`,
  };

  await prisma.groupLedgerEntry.create({
    data: {
      description:  `${typeLabel[type]} — member ${userId}`,
      entryType:    type,
      amount:       paidAmount,
      isCredit:     true,
      balanceAfter: prevBalance + paidAmount,
      recordedBy,
    },
  });

  // Revalidate relevant pages so the UI reflects the new data immediately
  revalidatePath("/admin/data-entry");
  revalidatePath("/dashboard");

  return { success: true, contributionId: contribution.id };
}

// =============================================================================
// GET ACTIVE MEMBERS  (for the member dropdown in forms)
// =============================================================================

export async function getActiveMembers() {
  return prisma.user.findMany({
    where: {
      // Check both the legacy boolean AND the new status enum
      // so this works before and after the migration back-fill is run.
      OR: [
        { status: "ACTIVE" },
        { isActive: true },
      ],
    },
    select: {
      id:           true,
      name:         true,
      firstName:    true,
      lastName:     true,
      memberNumber: true,
    },
    orderBy: { name: "asc" },
  });
}

// =============================================================================
// GET GROUP BALANCE  (for Treasurer dashboard widget)
// =============================================================================

export async function getGroupBalance(): Promise<number> {
  const latest = await prisma.groupLedgerEntry.findFirst({
    orderBy: { recordedAt: "desc" },
    select:  { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

// =============================================================================
// GET MEMBER CONTRIBUTION SUMMARY  (for member dashboard)
// =============================================================================

export async function getMemberSummary(userId: string) {
  // Return the pre-computed summary — fast single-row read.
  const summary = await prisma.memberFinancialSummary.findUnique({
    where: { userId },
  });

  if (summary) return summary;

  // Cold-start fallback: compute from raw tables if summary doesn't exist yet.
  const [contributions, fines, loans] = await Promise.all([
    prisma.contribution.aggregate({
      where: { userId },
      _sum:  { paidAmount: true },
    }),
    prisma.fine.aggregate({
      where: { userId, status: "OUTSTANDING" },
      _sum:  { amount: true },
    }),
    prisma.loan.aggregate({
      where:  { userId, status: { in: ["DISBURSED", "REPAYING"] } },
      _sum:   { outstandingBalance: true },
    }),
  ]);

  return {
    totalContributed:       contributions._sum.paidAmount       ?? 0,
    outstandingFines:       fines._sum.amount                   ?? 0,
    outstandingLoanBalance: loans._sum.outstandingBalance       ?? 0,
    totalPenaltiesPaid:     0,
    outstandingArrears:     0,
    totalSharesValue:       0,
    totalFinesPaid:         0,
    totalLoansRepaid:       0,
  };
}

// =============================================================================
// GET FEE SCHEDULE  (for auto-filling amounts in forms)
// =============================================================================

export async function getFeeSchedule() {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "REGISTRATION_FEE_KES",
          "MAINTENANCE_FEE_KES",
          "MONTHLY_CONTRIBUTION_KES",
          "LATE_PENALTY_KES",
        ],
      },
    },
  });

  const map = Object.fromEntries(configs.map((c) => [c.key, parseFloat(c.value)]));

  return {
    REGISTRATION_FEE: map["REGISTRATION_FEE_KES"]     ?? 250,
    MAINTENANCE_FEE:  map["MAINTENANCE_FEE_KES"]      ?? 500,
    MONTHLY:          map["MONTHLY_CONTRIBUTION_KES"]  ?? 500,
    LATE_PENALTY:     map["LATE_PENALTY_KES"]          ?? 100,
    ARREAR_PAYMENT:   map["MONTHLY_CONTRIBUTION_KES"]  ?? 500,
  };
}