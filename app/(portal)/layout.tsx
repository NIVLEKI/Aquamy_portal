// app/(portal)/layout.tsx
// IMPORTANT: This layout must NOT import or render Topbar.
// The "N" avatar bug is caused by the old layout.tsx still including Topbar.
// This version is the authoritative replacement.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // These fields are set in the jwt + session callbacks in auth/[...nextauth]/route.ts
  const user = session.user as {
    name?:         string;
    role?:         string;
    memberNumber?: string;
    firstName?:    string;
  };

  // Use firstName if available, fall back to full name
  const displayName = user.firstName
    ? user.firstName
    : (user.name ?? "Member");

  return (
    <div className="flex min-h-screen bg-[#F7F5F0] font-sans">
      <Sidebar
        role={user.role ?? "MEMBER"}
        name={displayName}
        memberNumber={user.memberNumber ?? ""}
      />
      {/* Main content — flex-1 takes all remaining width */}
      <div className="flex-1 overflow-auto min-w-0">
        {children}
      </div>
    </div>
  );
}