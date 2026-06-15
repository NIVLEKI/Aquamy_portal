"use client"; // This is required to read the current route path

import { usePathname } from "next/navigation";

// Shared footer — used in both the portal layout and public pages.
export default function Footer() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  // Define the exact paths where the footer should NOT appear
  const hiddenRoutes = ["/login", "/register", "/admin/login"];

  // If the user is on any of the hidden routes, render nothing
  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-6 lg:px-10 py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left — AQUAMY branding */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#1C4A2E] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[8px] font-black tracking-tighter">AQ</span>
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            AQUAMY Member Portal
          </p>
        </div>
        
        {/* Centre — copyright */}
        <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
          &copy; {year} Agricultural and Aquatic Muirungi Youth Self-Help Group.
          All rights reserved.
        </p>
        
        {/* Right — built by */}
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Built by{" "}
          <a
            href="https://nivleksolutions.co.ke"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1C4A2E] dark:text-emerald-400 hover:underline underline-offset-2 transition-colors"
          >
            Nivlek Solutions
          </a>
        </p>
      </div>
    </footer>
  );
}