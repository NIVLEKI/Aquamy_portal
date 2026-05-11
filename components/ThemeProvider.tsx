// components/ThemeProvider.tsx
// Wraps the app with next-themes for dark/light mode.
// Install: npm install next-themes
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"      // adds/removes `dark` class on <html>
      defaultTheme="light"   // default to light until user picks
      enableSystem={false}   // don't follow OS setting automatically
      storageKey="aquamy-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}




