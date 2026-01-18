"use client";

import { ReactNode } from "react";
import { useMobileMode } from "@/hooks/useMobileMode";
import { MobileBottomNav } from "./MobileBottomNav";

interface MobileAwareLayoutProps {
  children: ReactNode;
}

/**
 * Client component that renders content based on mobile mode.
 * Desktop uses top navigation in Header, mobile uses bottom nav.
 */
export function MobileAwareLayout({ children }: MobileAwareLayoutProps) {
  const { isMobile, isMounted } = useMobileMode();

  // During SSR, render the desktop layout
  if (!isMounted) {
    return (
      <div className="flex min-h-screen flex-col">
        <main id="main-content" className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    );
  }

  // Mobile mode: full width content with bottom navigation
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        <main id="main-content" className="flex-1 min-w-0 pb-20">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // Desktop mode: no sidebar, navigation in header
  return (
    <div className="flex min-h-screen flex-col">
      <main id="main-content" className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
