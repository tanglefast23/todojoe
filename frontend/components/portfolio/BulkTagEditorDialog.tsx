"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { TagBadge } from "@/components/ui/tag-badge";
import { parseTagInput } from "@/lib/tagUtils";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";

interface BulkTagEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SymbolEntry {
  symbol: string;
  assetType: AssetType;
  displayKey: string;
}

export function BulkTagEditorDialog({
  open,
  onOpenChange,
}: BulkTagEditorDialogProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const getQuickOverviewGrid = usePortfolioStore((state) => state.getQuickOverviewGrid);
  const getSymbolTags = usePortfolioStore((state) => state.getSymbolTags);
  const addSymbolTags = usePortfolioStore((state) => state.addSymbolTags);
  const removeSymbolTag = usePortfolioStore((state) => state.removeSymbolTag);
  // Subscribe to changes
  const _symbolTags = usePortfolioStore((state) => state.symbolTags);
  const _transactions = usePortfolioStore((state) => state.transactions);

  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Get all unique symbols from the grid
  const symbols = useMemo((): SymbolEntry[] => {
    const gridData = getQuickOverviewGrid(activePortfolioId);
    return gridData.symbols.map((symbolKey) => {
      const displaySymbol = symbolKey.includes("-")
        ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
        : symbolKey;
      const assetType = gridData.symbolTypes[symbolKey] || "stock";
      const effectiveType = assetType === "both" ? "stock" : assetType;
      return {
        symbol: displaySymbol,
        assetType: effectiveType as AssetType,
        displayKey: symbolKey,
      };
    });
  }, [getQuickOverviewGrid, activePortfolioId, _transactions]);

  const handleInputChange = (key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddTags = (entry: SymbolEntry) => {
    const input = inputValues[entry.displayKey] || "";
    const newTags = parseTagInput(input);
    if (newTags.length > 0) {
      addSymbolTags(entry.symbol, entry.assetType, newTags);
      setInputValues((prev) => ({ ...prev, [entry.displayKey]: "" }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, entry: SymbolEntry, rowIndex: number) => {
    if (e.key === "Enter" || e.key === "Tab") {
      const input = inputValues[entry.displayKey] || "";

      // Add tags if there's input
      if (input.trim()) {
        e.preventDefault();
        handleAddTags(entry);
      }

      // For Enter or Tab with content, move to next/prev input
      if (e.key === "Enter" || (e.key === "Tab" && input.trim())) {
        e.preventDefault();
        const nextIndex = e.key === "Tab" && e.shiftKey ? rowIndex - 1 : rowIndex + 1;
        if (nextIndex >= 0 && nextIndex < symbols.length) {
          // Focus next input after a tick to let React update
          setTimeout(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>(
              '[data-tag-input]'
            );
            inputs[nextIndex]?.focus();
          }, 0);
        }
      }
      // If Tab with empty input, let it work normally to navigate
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="text-left py-2 px-3 font-medium w-24">Symbol</th>
                <th className="text-left py-2 px-3 font-medium w-16">Type</th>
                <th className="text-left py-2 px-3 font-medium">Current Tags</th>
                <th className="text-left py-2 px-3 font-medium w-48">Add Tags</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((entry, rowIndex) => {
                const tags = getSymbolTags(entry.symbol, entry.assetType);
                return (
                  <tr key={entry.displayKey} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{entry.symbol}</td>
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          entry.assetType === "stock"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                        )}
                      >
                        {entry.assetType === "stock" ? "Stock" : "Crypto"}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-muted-foreground text-xs">No tags</span>
                        ) : (
                          tags.map((tag) => (
                            <TagBadge
                              key={tag}
                              tag={tag}
                              size="sm"
                              onRemove={() => removeSymbolTag(entry.symbol, entry.assetType, tag)}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        placeholder="tech growth"
                        value={inputValues[entry.displayKey] || ""}
                        onChange={(e) => handleInputChange(entry.displayKey, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, entry, rowIndex)}
                        onBlur={() => handleAddTags(entry)}
                        className="h-7 text-xs"
                        data-tag-input
                      />
                    </td>
                  </tr>
                );
              })}
              {symbols.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No investments to tag. Add symbols first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
