// app/(portal)/dashboard/shares/buy/page.tsx — v2
// Server component: fetches share price + user phone, renders the widget.
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SharePaymentWidget from "./SharePaymentWidget";

export default async function BuySharesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { phone: true },
  });
  if (!dbUser) redirect("/login");

  const priceConfig = await prisma.systemConfig.findUnique({
    where: { key: "SHARE_PRICE_KES" },
  });
  const sharePrice = parseFloat(priceConfig?.value ?? "100");

  return (
    <div className="p-6 lg:p-10 max-w-md mx-auto space-y-6">
      <div>
        <Link href="/dashboard/shares"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors mb-3">
          <ArrowLeft size={13} /> Back to Shares
        </Link>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Buy Shares</h1>
        <p className="text-stone-500 text-sm mt-1">
          Current price: KES {sharePrice.toLocaleString()} per unit
        </p>
      </div>

      <SharePaymentWidget sharePrice={sharePrice} userPhone={dbUser.phone ?? ""} />
    </div>
  );
}