"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, ChevronRight, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PlanningAccountAllocation } from "@/hooks/useSellPlanFlow";

interface BuyAllocatorSymbolsProps {
  mode: "symbols";
  selectedSymbol: string;
  selectedPlainSymbol: string | null;
  percentageInput: string;
  sellingAccounts: PlanningAccountAllocation[];
  currentAccountIndex: number;
  currentSellingAccount: PlanningAccountAllocation;
  currentAccountBuySymbolsList: string[];
  buySymbolInput: string;
  showBuyAutocomplete: boolean;
  filteredBuySymbols: string[];
  totals: Record<string, number>;
  priceMap: Record<string, number>;
  error: string | null;
  buySymbolInputRef: React.RefObject<HTMLInputElement | null>;
  onBuySymbolChange: (value: string) => void;
  onBuySymbolSelect: (symbol?: string) => void;
  onBuySymbolKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveBuySymbol: (symbol: string) => void;
  onFocus: () => void;
  onCancel: () => void;
  formatShares: (shares: number, symbol: string) => string;
}

interface BuyAllocatorPercentagesProps {
  mode: "percentages";
  selectedSymbol: string;
  selectedPlainSymbol: string | null;
  percentageInput: string;
  sellingAccounts: PlanningAccountAllocation[];
  currentAccountIndex: number;
  currentSellingAccount: PlanningAccountAllocation;
  currentAccountBuySymbolsList: string[];
  currentAccountBuyPercentagesMap: Record<string, string>;
  currentAccountTotalBuyPercentage: number;
  priceMap: Record<string, number>;
  error: string | null;
  onBuyPercentageChange: (symbol: string, value: string) => void;
  onBuyPercentageKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, symbol: string) => void;
  onBuyAllocationConfirm: () => void;
  onCancel: () => void;
}

type BuyAllocatorProps = BuyAllocatorSymbolsProps | BuyAllocatorPercentagesProps;

export function BuyAllocator(props: BuyAllocatorProps) {
  const {
    mode,
    selectedSymbol,
    selectedPlainSymbol,
    percentageInput,
    sellingAccounts,
    currentAccountIndex,
    currentSellingAccount,
    currentAccountBuySymbolsList,
    priceMap,
    error,
    onCancel,
  } = props;

  const currentPrice = priceMap[selectedPlainSymbol || ""] || 0;

  // Common breadcrumb for both modes
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
        <Check className="h-3 w-3" />
      </span>
      <span className="font-medium">{selectedSymbol}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
        <Check className="h-3 w-3" />
      </span>
      <span>{percentageInput}%</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
        <Check className="h-3 w-3" />
      </span>
      <span>
        {sellingAccounts.length} account{sellingAccounts.length !== 1 ? "s" : ""}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      {mode === "percentages" && (
        <>
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            <Check className="h-3 w-3" />
          </span>
          <span>
            {currentAccountBuySymbolsList.length} symbol
            {currentAccountBuySymbolsList.length !== 1 ? "s" : ""}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
        {mode === "symbols" ? "4" : "5"}
      </span>
      {mode === "symbols" ? (
        <>
          Buy symbols for <span className="font-bold">{currentSellingAccount.accountName}</span>
        </>
      ) : (
        <>
          Allocations for <span className="font-bold">{currentSellingAccount.accountName}</span>
        </>
      )}
    </div>
  );

  // Account progress indicator (common to both modes)
  const AccountProgress = () => (
    <div className="bg-blue-500/10 rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">
        Account {currentAccountIndex + 1} of {sellingAccounts.length}
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium">{currentSellingAccount.accountName}</span>
        <span className="text-sm text-muted-foreground">
          {mode === "symbols" ? (
            <>
              Selling {props.formatShares(currentSellingAccount.toSell, selectedSymbol)} shares (
              {formatCurrency(currentSellingAccount.toSell * currentPrice)})
            </>
          ) : (
            <>Proceeds: {formatCurrency(currentSellingAccount.toSell * currentPrice)}</>
          )}
        </span>
      </div>
    </div>
  );

  if (mode === "symbols") {
    const {
      buySymbolInput,
      showBuyAutocomplete,
      filteredBuySymbols,
      totals,
      buySymbolInputRef,
      onBuySymbolChange,
      onBuySymbolSelect,
      onBuySymbolKeyDown,
      onRemoveBuySymbol,
      onFocus,
      formatShares,
    } = props as BuyAllocatorSymbolsProps;

    return (
      <div className="space-y-4">
        <Breadcrumb />
        <AccountProgress />

        {/* Collected buy symbols for this account */}
        {currentAccountBuySymbolsList.length > 0 && (
          <div className="bg-emerald-500/10 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-2">
              Symbols to buy for {currentSellingAccount.accountName}:
            </div>
            <div className="flex flex-wrap gap-2">
              {currentAccountBuySymbolsList.map((symbol) => (
                <div
                  key={symbol}
                  className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-600 rounded-md text-sm font-medium"
                >
                  {symbol}
                  <button
                    onClick={() => onRemoveBuySymbol(symbol)}
                    className="hover:text-emerald-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-lg shrink-0">
            <TrendingUp className="h-5 w-5" />
            Buy
          </div>

          <div className="relative flex-1">
            <Input
              ref={buySymbolInputRef}
              value={buySymbolInput}
              onChange={(e) => onBuySymbolChange(e.target.value)}
              onKeyDown={onBuySymbolKeyDown}
              onFocus={onFocus}
              placeholder={`Enter symbols to buy for ${currentSellingAccount.accountName}`}
              className="text-lg h-12 uppercase"
              autoComplete="off"
            />

            {showBuyAutocomplete && filteredBuySymbols.length > 0 && buySymbolInput && (
              <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                {filteredBuySymbols.map((symbol, index) => (
                  <button
                    key={symbol}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                      index === 0 && "bg-muted/50"
                    )}
                    onClick={() => onBuySymbolSelect(symbol)}
                  >
                    <span className="font-medium">{symbol}</span>
                    <span className="text-muted-foreground ml-2">
                      (You own {totals[symbol]} shares)
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Separate multiple symbols with commas or spaces. Press Enter to continue.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // mode === "percentages"
  const {
    currentAccountBuyPercentagesMap,
    currentAccountTotalBuyPercentage,
    onBuyPercentageChange,
    onBuyPercentageKeyDown,
    onBuyAllocationConfirm,
  } = props as BuyAllocatorPercentagesProps;

  const accountProceeds = currentSellingAccount.toSell * currentPrice;

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <AccountProgress />

      <div className="text-xs text-muted-foreground">
        Allocate how much of {currentSellingAccount.accountName}&apos;s proceeds goes to each buy
        (must total 100%)
      </div>

      <div className="space-y-3">
        {currentAccountBuySymbolsList.map((symbol) => {
          const pct = parseFloat(currentAccountBuyPercentagesMap[symbol]) || 0;
          const dollarAmount = accountProceeds * (pct / 100);
          return (
            <div key={symbol} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{symbol}</div>
                <div className="text-sm text-muted-foreground">
                  {pct > 0 ? formatCurrency(dollarAmount) : "$0.00"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={currentAccountBuyPercentagesMap[symbol] || ""}
                  onChange={(e) => onBuyPercentageChange(symbol, e.target.value)}
                  onKeyDown={(e) => onBuyPercentageKeyDown(e, symbol)}
                  className="w-20 text-right"
                  placeholder="0"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "bg-muted/50 rounded-lg p-3 flex justify-between items-center",
          Math.abs(currentAccountTotalBuyPercentage - 100) > 0.01 &&
            "border border-amber-500/50 bg-amber-500/10"
        )}
      >
        <span className="text-sm text-muted-foreground">Total</span>
        <span
          className={cn(
            "font-bold",
            Math.abs(currentAccountTotalBuyPercentage - 100) > 0.01
              ? "text-amber-500"
              : "text-emerald-500"
          )}
        >
          {currentAccountTotalBuyPercentage.toFixed(0)}%
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onBuyAllocationConfirm}
          disabled={Math.abs(currentAccountTotalBuyPercentage - 100) > 0.01}
        >
          {currentAccountIndex + 1 < sellingAccounts.length ? "Next Account" : "Create Plan"}
        </Button>
      </div>
    </div>
  );
}
