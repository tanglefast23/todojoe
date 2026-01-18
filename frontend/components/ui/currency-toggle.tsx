"use client";

import { memo, useState, useEffect } from "react";
import { useCurrencyStore } from "@/stores/currencyStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

interface CurrencyToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export const CurrencyToggle = memo(function CurrencyToggle({
  className,
  size = "md",
}: CurrencyToggleProps) {
  // Prevent hydration mismatch - server doesn't have persisted currency
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { currency, toggleCurrency, usdToCadRate } = useCurrencyStore();

  const handleToggle = () => {
    playClickSound();
    // Toggle currency in currencyStore (for immediate UI update)
    toggleCurrency();
    // Also update settingsStore directly (for Supabase sync)
    // This avoids bidirectional sync effects that cause infinite loops
    const newCurrency = currency === "CAD" ? "USD" : "CAD";
    useSettingsStore.getState().setCurrency(newCurrency);
  };

  // Use default "CAD" on server, actual value after mount
  const displayCurrency = isMounted ? currency : "CAD";
  const isCAD = displayCurrency === "CAD";

  return (
    <button
      onClick={handleToggle}
      disabled={!isMounted}
      className={cn(
        "relative flex items-center rounded-full bg-muted/50 border border-border/50 transition-all hover:bg-muted",
        size === "sm" ? "h-7 w-[72px] text-xs" : "h-8 w-20 text-sm",
        !isMounted && "opacity-50",
        className
      )}
      title={isMounted ? `1 USD = ${usdToCadRate.toFixed(4)} CAD` : "Loading..."}
      aria-label={`Currency: ${displayCurrency}. Click to switch to ${isCAD ? "USD" : "CAD"}`}
    >
      {/* Sliding background */}
      <span
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-full bg-primary transition-all duration-200",
          size === "sm" ? "w-[32px]" : "w-9",
          isCAD
            ? "left-0.5"
            : size === "sm"
              ? "left-[36px]"
              : "left-[42px]"
        )}
      />

      {/* CAD Label (left) */}
      <span
        className={cn(
          "relative z-10 flex-1 text-center font-medium transition-colors",
          isCAD ? "text-primary-foreground" : "text-muted-foreground"
        )}
      >
        CAD
      </span>

      {/* USD Label (right) */}
      <span
        className={cn(
          "relative z-10 flex-1 text-center font-medium transition-colors",
          !isCAD ? "text-primary-foreground" : "text-muted-foreground"
        )}
      >
        USD
      </span>
    </button>
  );
});
