"use client";

import { signOut } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";
import Image from "next/image"; // <-- ADDED: Import Next.js Image

export default function Topbar({ user }: { user: any }) {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm">
      <div className="text-lg font-semibold text-gray-700">
        {user?.role === "ADMIN" ? "Administrator Dashboard" : "Member Dashboard"}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
          
          {/* <-- UPDATED: Render Image if URL exists, otherwise fallback to UserIcon */}
          {user?.profilePhotoUrl ? (
            <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
              <Image 
                src={user.profilePhotoUrl} 
                alt={`${user.name}'s profile photo`} 
                fill 
                className="object-cover"
                sizes="24px"
              />
            </div>
          ) : (
            <UserIcon size={16} className="text-blue-600" />
          )}

          <span className="font-medium">{user?.name}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">
            {user?.role}
          </span>
        </div>

        <button 
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium transition"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </header>
  );
}