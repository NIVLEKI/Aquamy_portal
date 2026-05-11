// components/Sidebar.tsx
// v2 — Mobile responsive (hamburger drawer) + Dark mode + Theme toggle
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Wallet, Landmark, Coins,
  Users, FileText, ShieldCheck, BarChart2,
  UserPlus, LogOut, ChevronRight, Settings,
  Sun, Moon, Menu, X,
} from "lucide-react";

interface SidebarProps {
  role:         string;
  name:         string;
  memberNumber: string;
}

const MEMBER_NAV = [
  { label: "Dashboard",     href: "/dashboard",             icon: LayoutDashboard },
  { label: "Contributions", href: "/dashboard/contributions", icon: Wallet         },
  { label: "Loans",         href: "/dashboard/loans",       icon: Landmark        },
  { label: "Shares",        href: "/dashboard/shares",      icon: Coins           },
  { label: "Payments",      href: "/dashboard/payments",    icon: Wallet          },
];

const ADMIN_NAV = [
  { label: "Overview",     href: "/admin",             icon: LayoutDashboard, roles: null },
  { label: "Approvals",    href: "/admin/approvals",   icon: UserPlus,        roles: null },
  { label: "Data Entry",   href: "/admin/data-entry",  icon: FileText,        roles: ["ADMIN","TREASURER"] },
  { label: "Members",      href: "/admin/members",     icon: Users,           roles: null },
  { label: "Loans",        href: "/admin/loans",       icon: Landmark,        roles: ["ADMIN","TREASURER","CHAIRPERSON","CREDIT_COMMITTEE_MEMBER","LOAN_OFFICER"] },
  { label: "Invite Codes", href: "/admin/codes",       icon: ShieldCheck,     roles: ["ADMIN","SECRETARY"] },
  { label: "Reports",      href: "/admin/reports",     icon: BarChart2,       roles: ["ADMIN","TREASURER","AUDITOR","CHAIRPERSON"] },
];

const ADMIN_ROLES = ["ADMIN","CHAIRPERSON","VICE_CHAIRPERSON","TREASURER","SECRETARY","AUDITOR","CREDIT_COMMITTEE_MEMBER","LOAN_OFFICER"];

export default function Sidebar({ role, name, memberNumber }: SidebarProps) {
  const pathname   = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted,      setMounted]  = useState(false);
  const [mobileOpen,   setMobileOpen] = useState(false);

  // Avoid hydration mismatch on theme
  useEffect(() => { setMounted(true); }, []);

  const isAdmin    = ADMIN_ROLES.includes(role);
  const initials   = name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() || "?";
  const isDark     = resolvedTheme === "dark";

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = pathname === href || (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(href));
    return (
      <Link href={href} onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
          ${active
            ? "bg-brand text-white shadow-sm"
            : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200"
          }`}>
        <Icon size={16} className={active ? "text-white" : "text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300"} />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight size={12} className="text-white/60" />}
      </Link>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black tracking-tighter">AQ</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest leading-none">AQUAMY</p>
            <p className="text-[10px] text-stone-400 dark:text-stone-500 leading-none mt-0.5">Member Portal</p>
          </div>
        </div>
        {/* Mobile close button */}
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[9px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-600 px-3 pb-2 pt-1">My Account</p>
        {MEMBER_NAV.map(item => <NavLink key={item.href} {...item} />)}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-600 px-3">
                {role.replace(/_/g, " ")}
              </p>
            </div>
            {ADMIN_NAV
              .filter(item => !item.roles || item.roles.includes(role))
              .map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-stone-100 dark:border-stone-700 space-y-1">
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-50 dark:bg-stone-800 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{name || "Member"}</p>
            <p className="text-[10px] font-mono text-stone-400 dark:text-stone-500">{memberNumber}</p>
          </div>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200 transition-all"
          >
            {isDark
              ? <Sun  size={15} className="text-amber-400" />
              : <Moon size={15} className="text-stone-400" />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        )}

        <Link href="/dashboard/settings" onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200 transition-all">
          <Settings size={15} className="text-stone-400" />
          Settings
        </Link>

        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all group">
          <LogOut size={15} className="text-stone-400 group-hover:text-red-500" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger button (shows on small screens) ──────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg flex items-center justify-center shadow-sm"
      >
        <Menu size={18} className="text-stone-600 dark:text-stone-400" />
      </button>

      {/* ── Mobile overlay backdrop ────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <aside className={`
        lg:hidden fixed inset-y-0 left-0 z-50 w-72
        bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-700
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <SidebarContent />
      </aside>

      {/* ── Desktop sidebar (always visible on lg+) ────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-700 flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
}