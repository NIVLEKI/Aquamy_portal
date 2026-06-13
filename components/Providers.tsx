// components/Providers.tsx
// Client component wrapper for all context providers.
// Add any future client-side providers here (React Query, etc.)
"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider }   from "@/components/ThemeProvider";
import type { Session }    from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;  // passed from root layout
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="aquamy-theme"
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}