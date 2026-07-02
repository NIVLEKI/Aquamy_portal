// app/api/verify-email/route.ts
// Handles clicks on the verification link sent to the user's email.
// Marks the email as verified but does NOT activate the account.
// Committee approval remains the only path to activation.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/verify-email?status=invalid", req.url)
    );
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where:   { token },
    include: { user: { select: { id: true, status: true } } },
  });

  // Token not found
  if (!record) {
    return NextResponse.redirect(
      new URL("/verify-email?status=invalid", req.url)
    );
  }

  // Token already used
  if (record.usedAt) {
    return NextResponse.redirect(
      new URL("/verify-email?status=already-used", req.url)
    );
  }

  // Token expired
  if (record.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL("/verify-email?status=expired", req.url)
    );
  }

  // Mark token as used + mark email as verified
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data:  { emailVerified: new Date() },
    }),
  ]);

  // Redirect to success page — account still PENDING
  return NextResponse.redirect(
    new URL("/verify-email?status=success", req.url)
  );
}