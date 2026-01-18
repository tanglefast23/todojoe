"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { multiply, divide } from "@/lib/decimal";

interface PercentageInputProps {
  selectedSymbol: string;
  selectedPlainSymbol: string | null;
  priceMap: Record<string, number>;
  totals: Record<string, number>;
  totalPortfolioValue: number;
  percentageInput: string;
  error: string | null;
  percentageInputRef: React.RefObject<HTMLInputElement | null>;
  onPercentageChange: (value: string) => void;
  onPercentageConfirm: (directPercentage?: number) => void;
  onSellAll: () => void;
  onPercentageKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  formatShares: (shares: number, symbol: string) => string;
  roundShares: (shares: number, symbol: string) => number;
}

export function PercentageInput({
  selectedSymbol,
  selectedPlainSymbol,
  priceMap,
  totals,
  totalPortfolioValue,
  percentageInput,
  error,
  percentageInputRef,
  onPercentageChange,
  onPercentageConfirm,
  onSellAll,
  onPercentageKeyDown,
  formatShares,
  roundShares,
}: PercentageInputProps) {
  const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;
  const holdingsValue = (totals[selectedSymbol] || 0) * currentPrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
          <Check className="h-3 w-3" />
        </span>
        <span className="font-medium">{selectedSymbol}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          2
        </span>
        Enter percentage of portfolio to sell
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current Price</span>
          <span className="font-medium">{formatCurrency(currentPrice)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Your Holdings</span>
          <span className="font-medium">{totals[selectedSymbol]} shares</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Holdings Value</span>
          <span className="font-medium">{formatCurrency(holdingsValue)}</span>
        </div>
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-muted-foreground">Total Portfolio Value</span>
          <span className="font-bold">{formatCurrency(totalPortfolioValue)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Input
            ref={percentageInputRef}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={percentageInput}
            onChange={(e) => onPercentageChange(e.target.value)}
            onKeyDown={onPercentageKeyDown}
            placeholder="0"
            className="text-lg h-12 pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            %
          </span>
        </div>
      </div>

      {/* Quick selection buttons for fractions of the selected investment */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            // 1/3 of holdings value as percentage of total portfolio
            const pct = multiply(divide(holdingsValue, totalPortfolioValue), divide(100, 3));
            const pctValue = parseFloat(pct.toFixed(2));
            onPercentageChange(pct.toFixed(2));
            // Pass percentage directly to avoid race condition with state update
            if (currentPrice > 0) {
              onPercentageConfirm(pctValue);
            }
          }}
        >
          1/3 of {selectedSymbol}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            // 1/2 of holdings value as percentage of total portfolio
            const pct = multiply(divide(holdingsValue, totalPortfolioValue), 50);
            const pctValue = parseFloat(pct.toFixed(2));
            onPercentageChange(pct.toFixed(2));
            // Pass percentage directly to avoid race condition with state update
            if (currentPrice > 0) {
              onPercentageConfirm(pctValue);
            }
          }}
        >
          1/2 of {selectedSymbol}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onSellAll}
        >
          All {selectedSymbol}
        </Button>
      </div>

      {percentageInput && parseFloat(percentageInput) > 0 && (
        <div
          className="bg-red-500/10 hover:bg-red-500/20 rounded-lg p-4 space-y-1 cursor-pointer transition-colors"
          onClick={currentPrice > 0 ? () => onPercentageConfirm() : undefined}
        >
          <div className="flex justify-between text-sm">
            <span>{percentageInput}% of portfolio</span>
            <span className="font-medium">
              {formatCurrency(multiply(totalPortfolioValue, divide(parseFloat(percentageInput), 100)))}
            </span>
          </div>
          {currentPrice > 0 ? (
            <div className="flex justify-between text-sm">
              <span>Shares to sell</span>
              <span className="font-medium">
                {formatShares(
                  roundShares(
                    divide(multiply(totalPortfolioValue, divide(parseFloat(percentageInput), 100)), currentPrice),
                    selectedSymbol
                  ),
                  selectedSymbol
                )}{" "}
                shares
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Price unavailable - cannot calculate shares</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Press <kbd className="px-1 py-0.5 bg-muted rounded font-mono">A</kbd> for All, or Tab/Enter to continue
      </p>
    </div>
  );
}
