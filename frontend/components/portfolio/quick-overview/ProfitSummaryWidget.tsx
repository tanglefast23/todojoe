"use client";

import { memo, useState, useRef, useEffect } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useFormatters } from "@/hooks/useFormatters";
import { usePrivacyBlur } from "@/hooks/usePrivacyMode";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle

export const ProfitSummaryWidget = memo(function ProfitSummaryWidget() {
  // Prevent hydration mismatch: server renders loading state, client may have cached data
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use the portfolio hook which calculates cost basis from transactions
  const { summary, isLoading } = usePortfolio();

  // Store access for cost basis override
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const setCostBasisOverride = usePortfolioStore((state) => state.setCostBasisOverride);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Currency-aware formatters
  const { formatCurrency, currency } = useFormatters();

  // Privacy mode blur
  const blurClass = usePrivacyBlur();

  // Extract values from summary (calculated from actual transactions)
  const costBasis = summary.totalCost;
  const currentValue = summary.totalValue;
  const profit = summary.totalGain;
  const profitPercent = summary.totalGainPercent;
  const isPositive = profit >= 0;
  const isOverridden = summary.costBasisOverridden;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setEditValue(costBasis.toFixed(2));
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsed = parseFloat(editValue.replace(/[^0-9.-]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      setCostBasisOverride(activePortfolioId, parsed);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    setCostBasisOverride(activePortfolioId, null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  // Show loading state until mounted to prevent hydration mismatch
  // Server and client both render loading state initially, then client updates after mount
  if (!isMounted || isLoading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="border-b px-4 py-3 bg-muted/30">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b px-4 py-3 bg-muted/30">
          <h3 className="text-sm font-semibold">Profit Summary ({currency})</h3>
        </div>

        {/* Metrics */}
        <div className="divide-y divide-border/50">
        {/* Cost Basis - what you paid (double-click to edit) */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 bg-muted/20 cursor-pointer transition-colors",
            "hover:bg-muted/40",
            isOverridden && "ring-1 ring-inset ring-primary/30"
          )}
          onDoubleClick={handleDoubleClick}
          title={isOverridden ? "Double-click to edit cost basis (using manual override)" : "Double-click to edit cost basis"}
        >
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            Cost Basis
            {isOverridden && (
              <span className="text-[10px] text-primary">(edited)</span>
            )}
          </span>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="h-8 w-32 text-right font-mono text-sm"
                placeholder="0.00"
              />
              {isOverridden && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <span className={cn("text-lg font-bold tabular-nums", blurClass)}>
              {formatCurrency(costBasis)}
            </span>
          )}
        </div>

        {/* Current Value */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Current
          </span>
          <span className={cn("text-lg font-bold tabular-nums", blurClass)}>
            {formatCurrency(currentValue)}
          </span>
        </div>

        {/* Profit */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <span className="text-sm font-medium text-muted-foreground">
            Profit
          </span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isPositive ? "text-gain" : "text-loss",
              blurClass
            )}
          >
            {isPositive ? "+" : ""}
            {formatCurrency(profit)}
          </span>
        </div>

        {/* Profit Percent */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            Profit %
          </span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isPositive ? "text-gain" : "text-loss",
              blurClass
            )}
          >
            {isPositive ? "+" : ""}
            {profitPercent.toFixed(2)}%
          </span>
        </div>
        </div>
      </div>
  );
});
