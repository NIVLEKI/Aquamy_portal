// app/api/admin/members/route.ts
// Called by the admin/members client component to load the full member list.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = [
  "ADMIN","CHAIRPERSON","VICE_CHAIRPERSON",
  "SECRETARY","TREASURER","AUDITOR",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? "MEMBER";
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id:           true,
      name:         true,
      firstName:    true,
      lastName:     true,
      email:        true,
      phone:        true,
      memberNumber: true,
      role:         true,
      status:       true,
      createdAt:    true,
      financialSummary: {
        select: { totalContributed: true },
      },
      shares: {
        select: { quantity: true },
      },
    },
  });

  return NextResponse.json(members);
}