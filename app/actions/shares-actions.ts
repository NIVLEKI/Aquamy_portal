// app/actions/shares-actions.ts
"use server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export async function buyShares(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not authenticated.");

  const units = parseInt(formData.get("units") as string);
  if (isNaN(units) || units < 1) throw new Error("Invalid number of units.");

  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!dbUser) throw new Error("User not found.");

  const priceConfig = await prisma.systemConfig.findUnique({ where: { key: "SHARE_PRICE_KES" } });
  const pricePerUnit = parseFloat(priceConfig?.value ?? "0");
  if (!pricePerUnit) throw new Error("Share price not configured. Contact the Treasurer.");

  const totalAmount = units * pricePerUnit;

  await prisma.$transaction(async (tx) => {
    const share = await tx.share.upsert({
      where:  { userId: dbUser.id },
      create: { userId: dbUser.id, quantity: units, totalValue: totalAmount },
      update: { quantity: { increment: units }, totalValue: { increment: totalAmount } },
    });

    await tx.shareTransaction.create({
      data: {
        userId:      dbUser.id,
        shareId:     share.id,
        type:        "PURCHASE",
        units,
        pricePerUnit,
        totalAmount,
        recordedBy:  dbUser.id,
      },
    });

    await tx.memberFinancialSummary.upsert({
      where:  { userId: dbUser.id },
      create: { userId: dbUser.id, totalSharesValue: totalAmount },
      update: { totalSharesValue: { increment: totalAmount } },
    });
  });

  revalidatePath("/dashboard/shares");
}