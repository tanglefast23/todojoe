"use client";

import { cn } from "@/lib/utils";

interface SymbolBadgeProps {
  /** The symbol key - can be composite like "COPX-stock" or plain like "COPX" */
  symbolKey: string;
  /** Asset type - if not provided, will be extracted from composite key */
  assetType?: "stock" | "crypto";
  /** Additional class names for the container */
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * Displays a symbol with an asset type badge (S for stock, C for crypto)
 * Handles both composite keys ("COPX-stock") and plain symbols with explicit assetType
 */
export function SymbolBadge({ symbolKey, assetType, className, size = "md" }: SymbolBadgeProps) {
  // Extract symbol and type from composite key if needed
  let displaySymbol = symbolKey;
  let type = assetType;

  if (symbolKey.includes("-")) {
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const possibleType = symbolKey.substring(lastDashIndex + 1).toLowerCase();
    if (possibleType === "stock" || possibleType === "crypto") {
      displaySymbol = symbolKey.substring(0, lastDashIndex);
      type = type || possibleType;
    }
  }

  // Default to stock if no type specified
  type = type || "stock";
  const isStock = type === "stock";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn(size === "sm" ? "text-xs" : "text-sm")}>{displaySymbol}</span>
      <span
        className={cn(
          "rounded px-1 py-0.5 font-medium",
          size === "sm" ? "text-[8px]" : "text-[9px]",
          isStock
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
        )}
      >
        {isStock ? "S" : "C"}
      </span>
    </span>
  );
}

/**
 * Helper function to extract display symbol from composite key
 */
export function getDisplaySymbol(symbolKey: string): string {
  if (symbolKey.includes("-")) {
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const possibleType = symbolKey.substring(lastDashIndex + 1).toLowerCase();
    if (possibleType === "stock" || possibleType === "crypto") {
      return symbolKey.substring(0, lastDashIndex);
    }
  }
  return symbolKey;
}

/**
 * Helper function to extract asset type from composite key
 */
export function getAssetType(symbolKey: string): "stock" | "crypto" {
  if (symbolKey.includes("-")) {
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const possibleType = symbolKey.substring(lastDashIndex + 1).toLowerCase();
    if (possibleType === "stock" || possibleType === "crypto") {
      return possibleType;
    }
  }
  return "stock";
}
