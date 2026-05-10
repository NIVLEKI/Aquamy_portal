// app/api/loan-policy/route.ts
// Returns the currently active LoanPolicy as JSON.
// Called by the loan application page to show policy details
// and compute the repayment preview without a server action.

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await prisma.loanPolicy.findFirst({
    where: { active: true },
    select: {
      interestRate:          true,
      interestMethod:        true,
      maxDuration:           true,
      minDuration:           true,
      minimumLoanAmount:     true,
      maximumLoanAmount:     true,
      requiredGuarantors:    true,
      minimumMonthsAsMember: true,
    },
  });

  if (!policy) {
    return NextResponse.json({ error: "No active loan policy found." }, { status: 404 });
  }

  return NextResponse.json(policy);
}