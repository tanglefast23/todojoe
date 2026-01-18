"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatPercent } from "@/lib/formatters";
import { useFormatters } from "@/hooks/useFormatters";
import { usePrivacyMode, usePrivacyBlur, usePrivacyBlurStrong } from "@/hooks/usePrivacyMode";
import { CurrencyToggle } from "@/components/ui/currency-toggle";
import { cn } from "@/lib/utils";
import type { PortfolioSummary as PortfolioSummaryType } from "@/types/portfolio";

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
  isLoading?: boolean;
}

export function PortfolioSummary({ summary, isLoading }: PortfolioSummaryProps) {
  // Use isMounted to prevent hydration mismatch between server/client render
  // Server renders with isLoading derived from TanStack Query which may differ from client
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { formatCurrency } = useFormatters();

  // Privacy mode - shared state across all widgets
  const privacyMode = usePrivacyMode((state) => state.privacyMode);
  const togglePrivacyMode = usePrivacyMode((state) => state.togglePrivacyMode);
  const blurClass = usePrivacyBlur();
  const heroBlurClass = usePrivacyBlurStrong();

  const {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    dayChange,
    dayChangePercent,
    holdings,
  } = summary;

  const isGainPositive = totalGain >= 0;
  const isDayPositive = dayChange >= 0;

  // Show loading state until mounted and data is loaded
  // This prevents hydration mismatch: server and initial client render both show loading
  const showLoading = !isMounted || isLoading;

  return (
    <div className="space-y-8">
      {/* Hero: Total Portfolio Value */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Portfolio Value
          </p>
          <button
            onDoubleClick={togglePrivacyMode}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            title="Double-click to toggle privacy mode"
            aria-label={privacyMode ? "Show values" : "Hide values"}
          >
            {privacyMode ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          <CurrencyToggle size="sm" />
        </div>
        <div className="flex items-baseline gap-4">
          <span className={cn("hero-number text-5xl md:text-6xl lg:text-7xl transition-all", heroBlurClass)}>
            {showLoading ? (
              <span className="text-muted-foreground/50">$--,---.--</span>
            ) : (
              formatCurrency(totalValue)
            )}
          </span>
          {!showLoading && (
            <span className="text-sm text-muted-foreground">
              {holdings.length} holding{holdings.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Secondary Metrics - Horizontal Flow */}
      <div className="flex flex-wrap gap-x-12 gap-y-6 pt-2 border-t border-border/50">
        {/* Total Gain/Loss */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Total Return
          </p>
          {showLoading ? (
            <p className="text-2xl tabular-nums text-muted-foreground/50">--</p>
          ) : (
            <div className={cn("flex items-baseline gap-3 transition-all", blurClass)}>
              <span
                className={cn(
                  "text-2xl font-semibold tabular-nums transition-all duration-300",
                  isGainPositive
                    ? "text-gain glow-gain-xl"
                    : "text-loss glow-loss-xl"
                )}
              >
                {isGainPositive ? "+" : ""}
                {formatCurrency(totalGain)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums transition-all duration-300",
                  isGainPositive
                    ? "text-gain glow-gain-lg"
                    : "text-loss glow-loss-lg"
                )}
              >
                {formatPercent(totalGainPercent)}
              </span>
            </div>
          )}
        </div>

        {/* Today's Change */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Today
          </p>
          {showLoading ? (
            <p className="text-2xl tabular-nums text-muted-foreground/50">--</p>
          ) : (
            <div className={cn("flex items-baseline gap-3 transition-all", blurClass)}>
              <span
                className={cn(
                  "text-2xl font-semibold tabular-nums transition-all duration-300",
                  isDayPositive
                    ? "text-gain glow-gain-xl"
                    : "text-loss glow-loss-xl"
                )}
              >
                {isDayPositive ? "+" : ""}
                {formatCurrency(dayChange)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums transition-all duration-300",
                  isDayPositive
                    ? "text-gain glow-gain-lg"
                    : "text-loss glow-loss-lg"
                )}
              >
                {formatPercent(dayChangePercent)}
              </span>
            </div>
          )}
        </div>

        {/* Cost Basis */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Cost Basis
          </p>
          {showLoading ? (
            <p className="text-2xl tabular-nums text-muted-foreground/50">--</p>
          ) : (
            <p className={cn("text-2xl font-semibold tabular-nums transition-all", blurClass)}>
              {formatCurrency(totalCost)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
