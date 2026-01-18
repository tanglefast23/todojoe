"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SymbolBadge } from "@/components/ui/symbol-badge";
import { formatCurrency } from "@/lib/formatters";

interface SymbolSelectorProps {
  symbolInput: string;
  showAutocomplete: boolean;
  filteredSymbols: string[];
  totals: Record<string, number>;
  priceMap: Record<string, number>;
  error: string | null;
  symbolInputRef: React.RefObject<HTMLInputElement | null>;
  onSymbolChange: (value: string) => void;
  onSymbolSelect: (symbol?: string) => void;
  onSymbolKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  getPlainSymbol: (compositeKey: string) => string;
}

export function SymbolSelector({
  symbolInput,
  showAutocomplete,
  filteredSymbols,
  totals,
  priceMap,
  error,
  symbolInputRef,
  onSymbolChange,
  onSymbolSelect,
  onSymbolKeyDown,
  onFocus,
  getPlainSymbol,
}: SymbolSelectorProps) {
  // Auto-focus the input when this component mounts
  useEffect(() => {
    // Small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
      symbolInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [symbolInputRef]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          1
        </span>
        Enter symbol to sell
      </div>

      <div className="relative">
        <Input
          ref={symbolInputRef}
          value={symbolInput}
          onChange={(e) => onSymbolChange(e.target.value)}
          onKeyDown={onSymbolKeyDown}
          onFocus={onFocus}
          placeholder="Enter symbol (e.g., AAPL, BTC)"
          className="text-lg h-12 uppercase"
          autoComplete="off"
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredSymbols.length > 0 && symbolInput && (
          <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
            {filteredSymbols.map((symbol, index) => (
              <button
                key={symbol}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                  index === 0 && "bg-muted/50"
                )}
                onClick={() => onSymbolSelect(symbol)}
              >
                <SymbolBadge symbolKey={symbol} size="sm" className="font-medium" />
                <span className="text-muted-foreground ml-2">
                  {totals[symbol]} shares @ {formatCurrency(priceMap[getPlainSymbol(symbol)] || 0)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Press Tab or Enter to continue. Type to filter your holdings.
      </p>
    </div>
  );
}
