// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Wallet, Landmark, Coins,
  Users, FileText, ShieldCheck, BarChart2,
  UserPlus, LogOut, ChevronRight, Settings,
} from "lucide-react";

type Role = string;

interface SidebarProps {
  role:         Role;
  name:         string;
  memberNumber: string;
}

// ── Nav items per role group ─────────────────────────────────────────────────

const MEMBER_NAV = [
  { label: "Dashboard",      href: "/dashboard",                  icon: LayoutDashboard },
  { label: "Contributions",  href: "/dashboard/contributions",    icon: Wallet          },
  { label: "Loans",          href: "/dashboard/loans",            icon: Landmark        },
  { label: "Shares",         href: "/dashboard/shares",           icon: Coins           },
  { label: "Payments",       href: "/dashboard/payments",         icon: Wallet          },
];

const ADMIN_NAV = [
  { label: "Overview",       href: "/admin",                      icon: LayoutDashboard },
  { label: "Approvals",      href: "/admin/approvals",            icon: UserPlus        },
  { label: "Data Entry",     href: "/admin/data-entry",           icon: FileText        },
  { label: "Members",        href: "/admin/members",              icon: Users           },
  { label: "Loans",          href: "/admin/loans",                icon: Landmark        },
  { label: "Invite Codes",   href: "/admin/codes",                icon: ShieldCheck     },
  { label: "Reports",        href: "/admin/reports",              icon: BarChart2       },
];

// Which roles see the admin section
const ADMIN_ROLES = [
  "ADMIN", "CHAIRPERSON", "VICE_CHAIRPERSON", "TREASURER",
  "SECRETARY", "AUDITOR", "CREDIT_COMMITTEE_MEMBER", "LOAN_OFFICER",
];

export default function Sidebar({ role, name, memberNumber }: SidebarProps) {
  const pathname    = usePathname();
  const isAdmin     = ADMIN_ROLES.includes(role);
  const displayName = name || "Member";
  const initials    = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = pathname === href || (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(href));
    return (
      <Link href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
          ${active
            ? "bg-[#1C4A2E] text-white shadow-sm"
            : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          }`}>
        <Icon size={16} className={active ? "text-white" : "text-stone-400 group-hover:text-stone-600"} />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight size={12} className="text-white/60" />}
      </Link>
    );
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-stone-200 flex flex-col">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C4A2E] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black tracking-tighter">AQ</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none">AQUAMY</p>
            <p className="text-[10px] text-stone-400 leading-none mt-0.5">Member Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* Member section — always shown */}
        <p className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-3 pb-2 pt-1">My Account</p>
        {MEMBER_NAV.map(item => <NavLink key={item.href} {...item} />)}

        {/* Admin section — role-gated */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-3">
                {role.replace(/_/g, " ")}
              </p>
            </div>
            {/* Filter admin nav by specific role */}
            {ADMIN_NAV
              .filter(item => {
                // Loan review: only Credit Committee roles + management
                if (item.href === "/admin/loans")
                  return ["ADMIN","TREASURER","CHAIRPERSON","CREDIT_COMMITTEE_MEMBER","LOAN_OFFICER"].includes(role);
                // Codes: Admin + Secretary only
                if (item.href === "/admin/codes")
                  return ["ADMIN","SECRETARY"].includes(role);
                // Data entry: Treasurer + Admin
                if (item.href === "/admin/data-entry")
                  return ["ADMIN","TREASURER"].includes(role);
                // Reports: Auditor + management
                if (item.href === "/admin/reports")
                  return ["ADMIN","TREASURER","AUDITOR","CHAIRPERSON"].includes(role);
                return true;
              })
              .map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-stone-100 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-50 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#1C4A2E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-800 truncate">{displayName}</p>
            <p className="text-[10px] font-mono text-stone-400">{memberNumber}</p>
          </div>
        </div>

        <Link href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all">
          <Settings size={15} className="text-stone-400" />
          Settings
        </Link>

        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-red-50 hover:text-red-600 transition-all group">
          <LogOut size={15} className="text-stone-400 group-hover:text-red-500" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}