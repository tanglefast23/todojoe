"use client";

import { memo } from "react";
import { Home, Eye, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

export type MobileView = "home" | "add" | "watchlist";

interface MobileBottomNavProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
}

/** Classic mobile app bottom navigation bar */
export const MobileBottomNav = memo(function MobileBottomNav({
  activeView,
  onViewChange,
}: MobileBottomNavProps) {
  const handleNavClick = (view: MobileView) => {
    if (view !== activeView) {
      playClickSound();
      onViewChange(view);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {/* Home Button */}
        <button
          onClick={() => handleNavClick("home")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
            activeView === "home"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Portfolio Home"
          aria-current={activeView === "home" ? "page" : undefined}
        >
          <Home className={cn("h-5 w-5", activeView === "home" && "fill-primary/20")} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        {/* Watchlist Button */}
        <button
          onClick={() => handleNavClick("watchlist")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
            activeView === "watchlist"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Watchlist"
          aria-current={activeView === "watchlist" ? "page" : undefined}
        >
          <Eye className={cn("h-5 w-5", activeView === "watchlist" && "fill-primary/20")} />
          <span className="text-[10px] font-medium">Watchlist</span>
        </button>

        {/* Add Button */}
        <button
          onClick={() => handleNavClick("add")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
            activeView === "add"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Add Transaction"
          aria-current={activeView === "add" ? "page" : undefined}
        >
          <PlusCircle className={cn("h-5 w-5", activeView === "add" && "fill-primary/20")} />
          <span className="text-[10px] font-medium">Add</span>
        </button>
      </div>
    </nav>
  );
});
