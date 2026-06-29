// app/api/member/contributions/route.ts
// Called by the contributions page to load the member's contribution history.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return NextResponse.json([], { status: 200 });

  const contributions = await prisma.contribution.findMany({
    where:   { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id:             true,
      type:           true,
      status:         true,
      expectedAmount: true,
      paidAmount:     true,
      latePenalty:    true,
      periodMonth:    true,
      periodYear:     true,
      paidAt:         true,
      createdAt:      true,
    },
  });

  return NextResponse.json(contributions);
}