// app/api/auth/status/route.ts
// Polled by /waiting-room every 5 seconds to detect when admin approves a member.
// Reads LIVE status from DB — not from the stale JWT token.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ status: "UNAUTHENTICATED" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { status: true, isActive: true, role: true, memberNumber: true },
  });

  if (!user) {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  // Normalise: handle pre-migration users where status may still be null
  const resolvedStatus =
    user.status ?? (user.isActive ? "ACTIVE" : "PENDING");

  return NextResponse.json({
    status:       resolvedStatus,
    role:         user.role,
    memberNumber: user.memberNumber,
  });
}