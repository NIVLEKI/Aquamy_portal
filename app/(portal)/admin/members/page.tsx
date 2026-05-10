// app/(portal)/admin/members/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MemberStatus } from "@prisma/client";
import { Users, Mail, Phone, Hash, ShieldCheck, Clock, XCircle, BadgeCheck } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
  ACTIVE:    { label: "Active",    classes: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <BadgeCheck size={10}/> },
  PENDING:   { label: "Pending",   classes: "bg-amber-50   text-amber-700   border-amber-200",   icon: <Clock size={10}/> },
  INACTIVE:  { label: "Inactive",  classes: "bg-stone-100  text-stone-500   border-stone-200",   icon: <Clock size={10}/> },
  SUSPENDED: { label: "Suspended", classes: "bg-red-50     text-red-700     border-red-200",     icon: <XCircle size={10}/> },
  EXPELLED:  { label: "Expelled",  classes: "bg-red-100    text-red-800     border-red-300",     icon: <XCircle size={10}/> },
};

export default async function AdminMembersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const members = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { financialSummary: true, shares: true },
  });

  const counts = {
    active:    members.filter(m => m.status === MemberStatus.ACTIVE).length,
    pending:   members.filter(m => m.status === MemberStatus.PENDING).length,
    suspended: members.filter(m => m.status === MemberStatus.SUSPENDED || m.status === MemberStatus.EXPELLED).length,
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Member Directory</h1>
          <p className="text-stone-500 text-sm mt-1">{members.length} total members</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Active",    value: counts.active,    color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Pending",   value: counts.pending,   color: "bg-amber-50   text-amber-700   border-amber-200"   },
            { label: "Suspended", value: counts.suspended, color: "bg-red-50     text-red-700     border-red-200"     },
          ].map(({ label, value, color }) => (
            <div key={label} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${color}`}>
              {value} {label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center gap-2">
          <Users size={15} className="text-stone-400"/>
          <span className="text-xs font-black uppercase tracking-wider text-stone-700">All Members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                {["Member","Contact","Role","Shares","Contributions","Status","Joined"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {members.map(m => {
                const displayName = m.firstName ? `${m.firstName} ${m.lastName}` : m.name;
                const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.INACTIVE;
                const initials = (m.firstName?.[0] ?? m.name[0]).toUpperCase() + (m.lastName?.[0] ?? "").toUpperCase();
                return (
                  <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1C4A2E]/10 flex items-center justify-center text-[#1C4A2E] text-xs font-bold flex-shrink-0">{initials}</div>
                        <div>
                          <p className="font-semibold text-stone-800">{displayName}</p>
                          <p className="text-[10px] font-mono text-stone-400">{m.memberNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5 text-xs text-stone-500">
                        {m.email && <div className="flex items-center gap-1"><Mail size={10}/>{m.email}</div>}
                        <div className="flex items-center gap-1"><Phone size={10}/>{m.phone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                        {m.role.replace(/_/g," ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600 tabular-nums text-xs">{m.shares?.quantity ?? 0} units</td>
                    <td className="px-4 py-3.5 text-stone-600 tabular-nums text-xs">
                      KES {(m.financialSummary?.totalContributed ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${badge.classes}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-400 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}