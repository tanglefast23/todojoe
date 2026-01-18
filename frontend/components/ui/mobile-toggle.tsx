"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore, type ActiveView } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

// Mapping between desktop routes and mobile views
const ROUTE_TO_MOBILE_VIEW: Record<string, ActiveView> = {
  "/portfolio": "home",
  "/dashboard": "watchlist",
  "/quick-overview": "add",
  "/planning": "add",
};

const MOBILE_VIEW_TO_ROUTE: Record<ActiveView, string> = {
  home: "/portfolio",
  watchlist: "/dashboard",
  add: "/quick-overview",
};

interface MobileToggleProps {
  className?: string;
  size?: "sm" | "md";
}

/** Toggle between mobile and desktop view modes */
export const MobileToggle = memo(function MobileToggle({
  className,
  size = "md",
}: MobileToggleProps) {
  // Prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const pathname = usePathname();
  const router = useRouter();

  // Use useShallow to batch subscriptions and prevent unnecessary re-renders
  const { mobileMode, activeView, setMobileMode, setActiveView } = useSettingsStore(
    useShallow((state) => ({
      mobileMode: state.mobileMode,
      activeView: state.activeView,
      setMobileMode: state.setMobileMode,
      setActiveView: state.setActiveView,
    }))
  );

  const handleToggle = useCallback(() => {
    playClickSound();

    if (mobileMode === "mobile") {
      // Switching from mobile to desktop: navigate to equivalent route
      const targetRoute = MOBILE_VIEW_TO_ROUTE[activeView] || "/portfolio";
      setMobileMode("desktop");
      router.push(targetRoute);
    } else {
      // Switching from desktop to mobile: set activeView based on current route
      const targetView = ROUTE_TO_MOBILE_VIEW[pathname] || "home";
      setActiveView(targetView);
      setMobileMode("mobile");
      // Navigate to dashboard which renders MobileApp in mobile mode
      if (pathname !== "/dashboard" && pathname !== "/portfolio") {
        router.push("/dashboard");
      }
    }
  }, [mobileMode, activeView, pathname, router, setMobileMode, setActiveView]);

  // Use default "desktop" on server, actual value after mount
  const displayMode = isMounted ? mobileMode : "desktop";
  const isMobile = displayMode === "mobile";

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
