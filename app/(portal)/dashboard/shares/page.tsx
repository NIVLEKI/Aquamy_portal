// app/(portal)/dashboard/shares/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Coins, TrendingUp, ArrowUpRight } from "lucide-react";

function kes(v: number) { return `KES ${(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`; }

const TX_BADGE: Record<string, string> = {
  PURCHASE:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  BONUS:      "bg-blue-50    text-blue-700    border-blue-200",
  TRANSFER:   "bg-purple-50  text-purple-700  border-purple-200",
  REDEMPTION: "bg-red-50     text-red-700     border-red-200",
  ADJUSTMENT: "bg-amber-50   text-amber-700   border-amber-200",
};

export default async function SharesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:   { email: session.user.email },
    select:  { id: true },
    include: undefined,
  });
  if (!dbUser) redirect("/login");

  const [share, transactions, sharePriceConfig] = await Promise.all([
    prisma.share.findUnique({ where: { userId: dbUser.id } }),
    prisma.shareTransaction.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "desc" } }),
    prisma.systemConfig.findUnique({ where: { key: "SHARE_PRICE_KES" } }),
  ]);

  const quantity   = share?.quantity ?? 0;
  const sharePrice = parseFloat(sharePriceConfig?.value ?? "0");
  const totalValue = quantity * sharePrice;

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">My Shares</h1>
          <p className="text-stone-500 text-sm mt-1">Share holdings and transaction history.</p>
        </div>
        <Link href="/dashboard/shares/buy"
          className="flex items-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <Coins size={15}/> Buy Shares
        </Link>
      </div>

      {/* Holdings card */}
      <div className="bg-[#1C4A2E] rounded-xl p-6 text-white">
        <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-4">Current Holdings</p>
        <div className="grid grid-cols-3 gap-6">
          <div><p className="text-4xl font-black">{quantity}</p><p className="text-white/50 text-xs mt-1">Units Held</p></div>
          <div><p className="text-2xl font-black">{kes(sharePrice)}</p><p className="text-white/50 text-xs mt-1">Price / Unit</p></div>
          <div><p className="text-2xl font-black">{kes(totalValue)}</p><p className="text-white/50 text-xs mt-1">Total Value</p></div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <TrendingUp size={15} className="text-stone-400"/>
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">Transaction History</span>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-400 text-sm italic">No share transactions yet.</div>
        ) : (
          <div className="divide-y divide-stone-50">
            {transactions.map(tx => (
              <div key={tx.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TX_BADGE[tx.type]?.split(" ")[0]} flex-shrink-0`}>
                    <ArrowUpRight size={14} className={TX_BADGE[tx.type]?.split(" ")[1]}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-stone-800">{tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TX_BADGE[tx.type] ?? ""}`}>{tx.type}</span>
                    </div>
                    <p className="text-[10px] text-stone-400">{new Date(tx.createdAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})} {tx.notes && `· ${tx.notes}`}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm tabular-nums ${tx.units > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.units > 0 ? "+" : ""}{tx.units} units
                  </p>
                  <p className="text-[10px] text-stone-400">{kes(tx.totalAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}