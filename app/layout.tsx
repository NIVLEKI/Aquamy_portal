// app/layout.tsx — v2
// Wraps the entire app with Providers (SessionProvider + ThemeProvider).
// suppressHydrationWarning on <html> prevents next-themes hydration mismatch.

import type { Metadata }  from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/app/api/auth/[...nextauth]/route";
import Providers             from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title:       "AQUAMY — Member Portal",
  description: "Agricultural and Aquatic Muirungi Youth Self-Help Group",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the session server-side and pass it to SessionProvider.
  // This avoids a loading flash — the session is immediately available
  // to useSession() calls in any child client component.
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}