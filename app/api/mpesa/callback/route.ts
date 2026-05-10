// app/api/mpesa/callback/route.ts
// Safaricom POSTs to this URL after every STK push attempt.
// MUST be a public HTTPS URL — use ngrok in development.

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ContributionType } from "@prisma/client";

// Helper: update the group ledger after a successful payment
async function appendLedger(description: string, entryType: string, amount: number, userId: string) {
  const latest = await prisma.groupLedgerEntry.findFirst({ orderBy: { recordedAt: "desc" } });
  await prisma.groupLedgerEntry.create({
    data: {
      description,
      entryType,
      amount,
      isCredit:     true,
      balanceAfter: (latest?.balanceAfter ?? 0) + amount,
      recordedBy:   userId,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    // Find the pending transaction
    const tx = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId: CheckoutRequestID },
    });

    if (!tx) {
      console.error("[Callback] Unknown checkoutRequestId:", CheckoutRequestID);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ── Payment FAILED or CANCELLED ────────────────────────────────────────
    if (ResultCode !== 0) {
      await prisma.mpesaTransaction.update({
        where: { id: tx.id },
        data:  {
          status:              ResultCode === 1032 ? "CANCELLED" : "FAILED",
          resultCode:          ResultCode,
          resultDescription:   ResultDesc,
          callbackPayload:     body,
          completedAt:         new Date(),
        },
      });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ── Payment SUCCEEDED ─────────────────────────────────────────────────
    // Extract metadata items from the callback
    const meta: Record<string, string | number> = {};
    for (const item of CallbackMetadata?.Item ?? []) {
      meta[item.Name] = item.Value;
    }
    const receiptNumber = String(meta.MpesaReceiptNumber ?? "");
    const paidAmount    = Number(meta.Amount ?? tx.amount);

    // Mark transaction as successful
    await prisma.mpesaTransaction.update({
      where: { id: tx.id },
      data:  {
        status:            "SUCCESS",
        mpesaReceiptNumber: receiptNumber,
        resultCode:        0,
        resultDescription: ResultDesc,
        callbackPayload:   body,
        completedAt:       new Date(),
      },
    });

    // ── Settle the linked record based on what exists ───────────────────────
    // Check if linked to a Contribution
    const linkedContribution = await prisma.contribution.findFirst({
      where: { mpesaTransactionId: tx.id },
    });

    if (linkedContribution) {
      await prisma.contribution.update({
        where: { id: linkedContribution.id },
        data:  {
          paidAmount: linkedContribution.paidAmount + paidAmount,
          paidAt:     new Date(),
          status:     linkedContribution.paidAmount + paidAmount >= linkedContribution.expectedAmount ? "PAID" : "PARTIALLY_PAID",
          mpesaReceiptId: receiptNumber,
        },
      });

      // Update member summary
      await prisma.memberFinancialSummary.upsert({
        where:  { userId: tx.userId },
        create: { userId: tx.userId, totalContributed: paidAmount },
        update: { totalContributed: { increment: paidAmount } },
      });

      await appendLedger(
        `Monthly contribution — receipt ${receiptNumber}`,
        "MONTHLY_CONTRIBUTION",
        paidAmount,
        tx.userId
      );
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Check if linked to a LoanRepayment
    const linkedRepayment = await prisma.loanRepayment.findFirst({
      where: { mpesaTransactionId: tx.id },
    });

    if (linkedRepayment) {
      const newPaid  = linkedRepayment.paidAmount + paidAmount;
      const newStatus = newPaid >= linkedRepayment.expectedAmount ? "PAID" : "PARTIALLY_PAID";

      await prisma.loanRepayment.update({
        where: { id: linkedRepayment.id },
        data:  { paidAmount: newPaid, status: newStatus, paidAt: new Date() },
      });

      // Reduce loan outstanding balance
      await prisma.loan.update({
        where: { id: linkedRepayment.loanId },
        data:  { outstandingBalance: { decrement: paidAmount } },
      });

      // Check if fully repaid
      const loan = await prisma.loan.findUnique({ where: { id: linkedRepayment.loanId } });
      if (loan && loan.outstandingBalance <= 0) {
        await prisma.loan.update({
          where: { id: loan.id },
          data:  { status: "FULLY_REPAID", fullyRepaidAt: new Date() },
        });
      }

      await prisma.memberFinancialSummary.upsert({
        where:  { userId: tx.userId },
        create: { userId: tx.userId, totalLoansRepaid: paidAmount },
        update: {
          totalLoansRepaid:       { increment: paidAmount },
          outstandingLoanBalance: { decrement: paidAmount },
        },
      });

      await appendLedger(`Loan repayment — receipt ${receiptNumber}`, "LOAN_REPAYMENT", paidAmount, tx.userId);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Check if linked to a Fine
    const linkedFine = await prisma.fine.findFirst({
      where: { mpesaTransactionId: tx.id },
    });

    if (linkedFine) {
      await prisma.fine.update({
        where: { id: linkedFine.id },
        data:  { isPaid: true, status: "PAID", paidAt: new Date() },
      });
      await prisma.memberFinancialSummary.upsert({
        where:  { userId: tx.userId },
        create: { userId: tx.userId, totalFinesPaid: paidAmount },
        update: {
          totalFinesPaid:    { increment: paidAmount },
          outstandingFines:  { decrement: paidAmount },
        },
      });
      await appendLedger(`Fine payment — receipt ${receiptNumber}`, "FINE_COLLECTED", paidAmount, tx.userId);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Unlinked payment — record as unattributed MONTHLY contribution
    // (happens when user pays directly without going through a specific flow)
    const now = new Date();
    const newContrib = await prisma.contribution.create({
      data: {
        userId:            tx.userId,
        type:              ContributionType.MONTHLY,
        amount:            paidAmount,
        paidAmount,
        expectedAmount:    500, // constitutional amount
        status:            "PAID",
        periodMonth:       now.getMonth() + 1,
        periodYear:        now.getFullYear(),
        paidAt:            now,
        mpesaReceiptId:    receiptNumber,
        mpesaTransactionId: tx.id,
      },
    });

    await prisma.memberFinancialSummary.upsert({
      where:  { userId: tx.userId },
      create: { userId: tx.userId, totalContributed: paidAmount },
      update: { totalContributed: { increment: paidAmount } },
    });

    await appendLedger(`M-Pesa payment (auto) — receipt ${receiptNumber}`, "MONTHLY_CONTRIBUTION", paidAmount, tx.userId);

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("[M-Pesa Callback Error]", error);
    // Always return 200 to Safaricom even on error — they will retry otherwise
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}