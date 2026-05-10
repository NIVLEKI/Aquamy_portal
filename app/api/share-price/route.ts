// app/api/share-price/route.ts
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const config = await prisma.systemConfig.findUnique({ where: { key: "SHARE_PRICE_KES" } }).catch(() => null);
  return NextResponse.json({ price: parseFloat(config?.value ?? "100") });
}