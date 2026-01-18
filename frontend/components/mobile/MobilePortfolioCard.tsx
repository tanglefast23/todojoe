"use client";

import { memo } from "react";
import Image from "next/image";
import type { HoldingWithValue } from "@/types/portfolio";
import type { ChangePeriod, PeriodChange } from "@/hooks/useHoldingPeriodChanges";
import { useFormatters } from "@/hooks/useFormatters";
import { formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface MobilePortfolioCardProps {
  holding: HoldingWithValue;
  onClick?: () => void;
  selectedPeriod: ChangePeriod;
  periodChange?: PeriodChange;
}

/** Compact portfolio holding card for mobile view */
export const MobilePortfolioCard = memo(function MobilePortfolioCard({
  holding,
  onClick,
  selectedPeriod,
  periodChange,
}: MobilePortfolioCardProps) {
  const { formatCurrency } = useFormatters();

  // Use period change if available, otherwise fall back to day change
  const changePercent = periodChange?.percent ?? holding.dayChangePercent;
  const changeDollars = periodChange?.dollars ?? holding.dayChange;
  const isPercentPositive = changePercent >= 0;
  const isDollarsPositive = changeDollars >= 0;

  // Logo URL based on asset type
  const logoUrl =
    holding.assetType === "crypto"
      ? `https://assets.coincap.io/assets/icons/${holding.symbol.toLowerCase()}@2x.png`
      : `https://assets.parqet.com/logos/symbol/${holding.symbol}?format=png`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 active:bg-muted transition-colors text-left touch-manipulation"
    >
      {/* Logo */}
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-muted">
        <Image
          src={logoUrl}
          alt={holding.symbol}
          fill
          className="object-contain p-1"
          onError={(e) => {
            // Hide broken image
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Fallback initials */}
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
          {holding.symbol.slice(0, 2)}
        </div>
      </div>

      {/* Symbol + Name + Price + Shares */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base truncate">{holding.symbol}</span>
          <span
            className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded",
              holding.assetType === "crypto"
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            )}
          >
            {holding.assetType === "crypto" ? "C" : "S"}
          </span>
          <span className="text-sm text-muted-foreground">
            {holding.priceAvailable ? formatCurrency(holding.currentPrice, 0, 0) : "N/A"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {holding.name || holding.symbol}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {holding.quantity.toLocaleString()} shares
        </p>
      </div>

      {/* Total Value + Period Change % */}
      <div className="flex flex-col items-end flex-shrink-0">
        <span className="font-medium text-base">
          {holding.priceAvailable ? formatCurrency(holding.currentValue, 0, 0) : "N/A"}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            isPercentPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {formatPercent(changePercent)}
        </span>
      </div>

      {/* Period Dollar Change */}
      <div className="flex flex-col items-end flex-shrink-0 pl-1.5 border-l border-border/50">
        <span
          className={cn(
            "font-semibold text-base",
            isDollarsPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {isDollarsPositive ? "+" : "-"}{formatCurrency(Math.abs(changeDollars), 0, 0)}
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedPeriod.toLowerCase()}
        </span>
      </div>
    </button>
  );
});
