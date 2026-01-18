"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AssetType } from "@/types/portfolio";

interface SymbolFeedback {
  type: "error" | "warning" | "success";
  message: string;
}

interface AddSymbolsPopoverProps {
  existingSymbolKeys: string[];
  onAddSymbol: (symbol: string, assetType: AssetType) => void;
}

export function AddSymbolsPopover({
  existingSymbolKeys,
  onAddSymbol,
}: AddSymbolsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>("stock");
  const [symbolFeedback, setSymbolFeedback] = useState<SymbolFeedback | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popover opens (desktop)
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure popover is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAddSymbol = useCallback(async () => {
    if (!newSymbol.trim()) return;

    // Parse multiple symbols separated by comma, space, or both
    const symbols = newSymbol
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (symbols.length === 0) return;

    // Check for duplicates against existing symbols (with asset type)
    const existingKeys = new Set(existingSymbolKeys.map((s) => s.toUpperCase()));
    const duplicates: string[] = [];
    const symbolsToValidate: string[] = [];

    symbols.forEach((sym) => {
      const compositeKey = `${sym}-${selectedAssetType}`;
      if (existingKeys.has(compositeKey)) {
        duplicates.push(sym);
      } else {
        symbolsToValidate.push(sym);
      }
    });

    // Deduplicate symbols to validate
    const uniqueSymbolsToValidate = [...new Set(symbolsToValidate)];

    if (uniqueSymbolsToValidate.length === 0) {
      // All symbols are duplicates
      setSymbolFeedback({
        type: "error",
        message:
          duplicates.length === 1
            ? `${duplicates[0]} is already in your list as a ${selectedAssetType}`
            : `${duplicates.join(", ")} are already in your list`,
      });
      return;
    }

    // Validate symbols via API
    setIsValidating(true);
    setSymbolFeedback(null);

    try {
      let validSymbols: string[] = [];
      let invalidSymbols: string[] = [];

      if (selectedAssetType === "stock") {
        // Validate stocks
        const quotes = await api.getBatchStockQuotes(uniqueSymbolsToValidate);
        const returnedSymbols = new Set(quotes.map((q) => q.symbol.toUpperCase()));
        validSymbols = uniqueSymbolsToValidate.filter((s) => returnedSymbols.has(s));
        invalidSymbols = uniqueSymbolsToValidate.filter((s) => !returnedSymbols.has(s));
      } else {
        // Validate crypto
        const quotes = await api.getBatchCryptoQuotes(uniqueSymbolsToValidate);
        const returnedSymbols = new Set(quotes.map((q) => q.symbol.toUpperCase()));
        validSymbols = uniqueSymbolsToValidate.filter((s) => returnedSymbols.has(s));
        invalidSymbols = uniqueSymbolsToValidate.filter((s) => !returnedSymbols.has(s));
      }

      // Add valid symbols
      validSymbols.forEach((symbol) => {
        onAddSymbol(symbol, selectedAssetType);
      });

      // Build feedback message
      if (validSymbols.length === 0 && invalidSymbols.length > 0) {
        // All invalid
        setSymbolFeedback({
          type: "error",
          message:
            invalidSymbols.length === 1
              ? `${invalidSymbols[0]} is not a valid ${selectedAssetType} symbol`
              : `Could not find: ${invalidSymbols.join(", ")}`,
        });
      } else if (invalidSymbols.length > 0) {
        // Some valid, some invalid
        setSymbolFeedback({
          type: "warning",
          message: `Added ${validSymbols.join(", ")}. Could not find: ${invalidSymbols.join(", ")}`,
        });
        setNewSymbol("");
      } else if (duplicates.length > 0) {
        // All valid but some duplicates
        setSymbolFeedback({
          type: "success",
          message: `Added ${validSymbols.join(", ")}. Skipped ${duplicates.join(", ")} (already exists)`,
        });
        setNewSymbol("");
      } else {
        // All valid, no issues
        setSymbolFeedback(null);
        setNewSymbol("");
        setIsOpen(false);
      }
    } catch (error) {
      setSymbolFeedback({
        type: "error",
        message: "Failed to validate symbols. Please try again.",
      });
    } finally {
      setIsValidating(false);
    }
  }, [newSymbol, existingSymbolKeys, selectedAssetType, onAddSymbol]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setSymbolFeedback(null);
          setNewSymbol("");
          setSelectedAssetType("stock");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs transition-colors",
            isOpen &&
              "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
          )}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Investments
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <p className="text-xs font-medium">Add Symbols</p>

          {/* Asset Type Selection */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="assetType"
                value="stock"
                checked={selectedAssetType === "stock"}
                onChange={() => setSelectedAssetType("stock")}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span className="text-xs">Stock</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="assetType"
                value="crypto"
                checked={selectedAssetType === "crypto"}
                onChange={() => setSelectedAssetType("crypto")}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span className="text-xs">Crypto</span>
            </label>
          </div>

          {/* Symbol Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={
                selectedAssetType === "stock"
                  ? "AAPL, MSFT, GOOGL"
                  : "BTC, ETH, SOL"
              }
              value={newSymbol}
              onChange={(e) => {
                setNewSymbol(e.target.value.toUpperCase());
                setSymbolFeedback(null);
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && !isValidating && handleAddSymbol()
              }
              className="h-7 text-xs uppercase"
              disabled={isValidating}
            />
            <Button
              size="sm"
              className="h-7"
              onClick={handleAddSymbol}
              disabled={isValidating || newSymbol.trim().length === 0}
            >
              {isValidating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </div>

          {/* Feedback Messages */}
          {symbolFeedback ? (
            <p
              className={cn(
                "text-[10px]",
                symbolFeedback.type === "error" &&
                  "text-red-600 dark:text-red-400",
                symbolFeedback.type === "warning" &&
                  "text-amber-600 dark:text-amber-400",
                symbolFeedback.type === "success" &&
                  "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {symbolFeedback.message}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Separate multiple with commas or spaces
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
