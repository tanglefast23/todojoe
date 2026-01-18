"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isCryptoSymbol } from "@/lib/assetUtils";
import { cn } from "@/lib/utils";

interface AddSymbolPopoverProps {
  symbols: string[];
  onAddSymbol: (symbols: string[]) => void;
}

type AssetType = "auto" | "stock" | "crypto";

/** Standalone Add Symbol popover for use in widget headers */
export function AddSymbolPopover({ symbols, onAddSymbol }: AddSymbolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("auto");

  const handleAdd = () => {
    // Split by comma, space, or both to support multiple symbols
    const inputSymbols = newSymbol
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (inputSymbols.length === 0) return;

    const newSymbolKeys: string[] = [];

    for (const symbol of inputSymbols) {
      // Determine final type: use selected type, or auto-detect
      let finalType: "stock" | "crypto";
      if (assetType === "auto") {
        finalType = isCryptoSymbol(symbol) ? "crypto" : "stock";
      } else {
        finalType = assetType;
      }

      // Create composite key with type suffix
      const symbolKey = `${symbol}-${finalType}`;

      // Case-insensitive duplicate check against existing and newly added
      const isDuplicate =
        symbols.some(
          (s) => s.toUpperCase() === symbol || s.toUpperCase() === symbolKey.toUpperCase()
        ) ||
        newSymbolKeys.some(
          (s) => s.toUpperCase() === symbolKey.toUpperCase()
        );

      if (!isDuplicate) {
        newSymbolKeys.push(symbolKey);
      }
    }

    if (newSymbolKeys.length > 0) {
      onAddSymbol([...symbols, ...newSymbolKeys]);
    }

    setNewSymbol("");
    setAssetType("auto");
    setIsOpen(false);
  };

  // Auto-detect type when symbol changes (for visual feedback)
  const detectedType = newSymbol.trim()
    ? (isCryptoSymbol(newSymbol.trim()) ? "crypto" : "stock")
    : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <p className="text-sm font-medium">Add Symbols</p>
          <div className="flex gap-2">
            <Input
              placeholder="AAPL, BTC, TSLA..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-8 text-sm"
              autoComplete="off"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleAdd}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Add
            </Button>
          </div>

          {/* Asset Type Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Asset Type</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setAssetType("auto")}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors",
                  assetType === "auto"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 hover:bg-muted border-border"
                )}
              >
                Auto
                {assetType === "auto" && detectedType && (
                  <span className="ml-1 opacity-70">
                    ({detectedType === "crypto" ? "C" : "S"})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAssetType("stock")}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors",
                  assetType === "stock"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-muted/50 hover:bg-muted border-border"
                )}
              >
                Stock
              </button>
              <button
                type="button"
                onClick={() => setAssetType("crypto")}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors",
                  assetType === "crypto"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-muted/50 hover:bg-muted border-border"
                )}
              >
                Crypto
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Separate multiple symbols with commas. Use Stock/Crypto to override auto-detection.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
