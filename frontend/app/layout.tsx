import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SupabaseSyncProvider } from "@/components/providers/SupabaseSyncProvider";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { MobileAwareLayout } from "@/components/layout/MobileAwareLayout";
// TooltipProvider removed - all Radix tooltips replaced with native title attributes
// to prevent "Maximum update depth exceeded" errors with React 19

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Thanh To Do",
  description: "Manage tasks and track expenses together",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <SupabaseSyncProvider>
            <ThemeProvider>
            {/* Skip link for keyboard navigation - WCAG 2.4.1 */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Skip to main content
            </a>
            <SidebarProvider>
              <MobileAwareLayout>{children}</MobileAwareLayout>
            </SidebarProvider>
            </ThemeProvider>
          </SupabaseSyncProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
