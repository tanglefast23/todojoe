"use client";

import { memo, useCallback } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { useMobileMode } from "@/hooks/useMobileMode";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

interface MobileToggleProps {
  className?: string;
  size?: "sm" | "md";
}

/** Toggle between mobile and desktop view modes - stays on current page */
export const MobileToggle = memo(function MobileToggle({
  className,
  size = "md",
}: MobileToggleProps) {
  const { isMobile, isMounted, setMobileMode } = useMobileMode();

  const handleToggle = useCallback(() => {
    playClickSound();
    // Toggle to the opposite of what's currently displayed
    // This overrides auto mode and sets a firm preference
    setMobileMode(isMobile ? "desktop" : "mobile");
  }, [isMobile, setMobileMode]);

  return (
    <button
      onClick={handleToggle}
      disabled={!isMounted}
      className={cn(
        "relative flex items-center justify-center rounded-md border border-border/50 transition-all hover:bg-muted",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        !isMounted && "opacity-50",
        className
      )}
      title={isMobile ? "Switch to desktop view" : "Switch to mobile view"}
      aria-label={`View mode: ${isMobile ? "mobile" : "desktop"}. Click to switch.`}
    >
      {isMobile ? (
        <Smartphone className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <Monitor className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
    </button>
  );
});
