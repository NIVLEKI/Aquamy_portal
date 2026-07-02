// app/layout.tsx — v2
// Wraps the entire app with Providers (SessionProvider + ThemeProvider).
// suppressHydrationWarning on <html> prevents next-themes hydration mismatch.

import type { Metadata }  from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/app/api/auth/[...nextauth]/route";
import Providers             from "@/components/Providers";
import Footer                from "@/components/Footer"; // 1. Import the Footer
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AQUAMY Member Portal",
  description: "Agricultural and Aquatic Muirungi Youth Self-Help Group",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
      {/* Added flex classes to push the footer to the bottom */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <Providers session={session}>
          {/* 2. Wrap children in main to take up available space */}
          <main className="flex-grow">
            {children}
          </main>
          
          {/* 3. Place the Footer right below the main content */}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}