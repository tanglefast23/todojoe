"use client";

import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import { X, Trash2, ArrowDownAZ, ArrowUpZA, Tag } from "lucide-react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useQuickOverviewGrid } from "@/hooks/useQuickOverviewGrid";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { usePrivacyBlur } from "@/hooks/usePrivacyMode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TagInputPopover } from "@/components/portfolio/TagInputPopover";
import { TagBadge } from "@/components/ui/tag-badge";
import { BulkTagEditorDialog } from "@/components/portfolio/BulkTagEditorDialog";
import { useAssetDetailModal } from "@/hooks/useAssetDetailModal";
import { AssetDetailModal } from "@/components/portfolio/AssetDetailModal";
import {
  ConfirmSellSymbolDialog,
  ConfirmSellAccountDialog,
} from "./dialogs";
import {
  AddAccountPopover,
  AddSymbolsPopover,
  TagFilterDropdown,
} from "./popovers";
import type { AssetType } from "@/types/portfolio";

/** Editable cell for quantity input with optimistic updates */
const QuantityCell = memo(function QuantityCell({
  value,
  onChange,
  disabled,
  cellId,
  onNavigate,
  blurClass = "",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  cellId: string;
  onNavigate?: (direction: "up" | "down" | "left" | "right", fromCellId: string) => void;
  blurClass?: string;
}) {
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  // Optimistic value shown until store confirms
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);
  // Flash green when save is confirmed
  const [showSaved, setShowSaved] = useState(false);

  // Track previous value to detect external changes (undo/redo)
  const prevValueRef = useRef(value);

  // When prop value matches optimistic value, the save is confirmed
  useEffect(() => {
    if (optimisticValue !== null && value === optimisticValue) {
      // Save confirmed - flash green, then clear both after delay
      setShowSaved(true);
      const timer = setTimeout(() => {
        setShowSaved(false);
        setOptimisticValue(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [value, optimisticValue]);

  // Detect external value changes (e.g., undo/redo) and clear optimistic state
  useEffect(() => {
    if (prevValueRef.current !== value) {
      // Value changed externally
      if (optimisticValue !== null && value !== optimisticValue) {
        // External change to something OTHER than our optimistic value
        // This means undo/redo happened - clear optimistic state
        setOptimisticValue(null);
        setShowSaved(false);
        setLocalValue(value === 0 ? "" : value.toString());
      }
      prevValueRef.current = value;
    }
  }, [value, optimisticValue]);

  const saveValue = useCallback(() => {
    const num = parseFloat(localValue) || 0;
    const rounded = Math.round(num * 100) / 100;
    setLocalValue(rounded.toString());
    // Only update if value actually changed
    if (rounded !== value) {
      setOptimisticValue(rounded);
      onChange(rounded);
    }
  }, [localValue, onChange, value]);

  const handleBlur = () => {
    setIsFocused(false);
    saveValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveValue();
      onNavigate?.("down", cellId);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      saveValue();
      onNavigate?.("right", cellId);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      saveValue();
      onNavigate?.("down", cellId);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      saveValue();
      onNavigate?.("up", cellId);
    } else if (e.key === "ArrowRight") {
      // Only navigate if cursor is at end of input
      const input = e.currentTarget;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        saveValue();
        onNavigate?.("right", cellId);
      }
    } else if (e.key === "ArrowLeft") {
      // Only navigate if cursor is at start of input
      const input = e.currentTarget;
      if (input.selectionStart === 0) {
        e.preventDefault();
        saveValue();
        onNavigate?.("left", cellId);
      }
    }
  };

  // Display priority: focused → optimistic → prop value
  const displayValue = isFocused
    ? localValue
    : optimisticValue !== null
    ? (optimisticValue === 0 ? "" : optimisticValue.toString())
    : (value === 0 ? "" : value.toString());

  return (
    <input
      type="text"
      data-cell-id={cellId}
      value={displayValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        setIsFocused(true);
        // Use current displayed value (optimistic or prop)
        const currentValue = optimisticValue !== null ? optimisticValue : value;
        setLocalValue(currentValue === 0 ? "" : currentValue.toString());
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn(
        "w-full h-8 px-2 text-right text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary/50 rounded",
        "tabular-nums transition-colors duration-300",
        disabled && "cursor-not-allowed opacity-50",
        showSaved && "bg-emerald-500/30",
        !isFocused && blurClass // Only blur when not focused
      )}
      placeholder="0"
    />
  );
});

/** Symbol header cell with asset type badge (S/C) and context menu */
const SymbolHeaderCell = memo(function SymbolHeaderCell({
  symbolKey,
  assetType,
  onRemove,
  tags,
  onAddTags,
  onRemoveTag,
  onClick,
}: {
  symbolKey: string; // Composite key like "BTC-stock" or just "AAPL-stock"
  assetType: "stock" | "crypto" | "both";
  onRemove: () => void;
  tags: string[];
  onAddTags: (tags: string[]) => void;
  onRemoveTag: (tag: string) => void;
  onClick?: () => void;
}) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Extract display symbol from composite key (e.g., "BTC" from "BTC-stock")
  const displaySymbol = symbolKey.includes("-")
    ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
    : symbolKey;

  return (
    <th className="relative group px-2 py-2 text-center font-semibold text-xs bg-emerald-600 dark:bg-emerald-700 text-white min-w-[70px] border-l border-emerald-500/50">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="cursor-pointer" onClick={onClick}>
            <div className="flex items-center justify-center gap-1">
              <span>{displaySymbol}</span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium",
                  assetType === "stock"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                )}
                aria-label={assetType === "stock" ? "Stock" : "Cryptocurrency"}
              >
                {assetType === "stock" ? "S" : "C"}
              </span>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => {
            // Delay opening popover to avoid conflict with context menu closing
            setTimeout(() => setTagPopoverOpen(true), 150);
          }}>
            <Tag className="w-4 h-4 mr-2" />
            Add Tags
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 className="w-4 h-4 mr-2" />
            Remove Symbol
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label={`Remove ${displaySymbol}`}
      >
        <X className="w-3 h-3" />
      </button>
      {/* Tag input popover - opens when "Add Tags" is selected from context menu */}
      <TagInputPopover
        existingTags={tags}
        onAddTags={onAddTags}
        onRemoveTag={onRemoveTag}
        open={tagPopoverOpen}
        onOpenChange={setTagPopoverOpen}
        trigger={<span />}
      />
    </th>
  );
});

/** Tags row cell - displays tags for a symbol in a dedicated row */
const TagsRowCell = memo(function TagsRowCell({
  tags,
}: {
  tags: string[];
}) {
  if (tags.length === 0) {
    return (
      <td className="px-1 py-1 text-center bg-muted/30 border-l border-border/30">
        <span className="text-[10px] text-muted-foreground/50">—</span>
      </td>
    );
  }

  return (
    <td className="px-1 py-1.5 bg-muted/30 border-l border-border/30">
      <div className="flex flex-wrap gap-1 justify-center">
        {tags.map((tag) => (
          <TagBadge key={tag} tag={tag} size="md" />
        ))}
      </div>
    </td>
  );
});

/** Editable account name cell */
const AccountNameCell = memo(function AccountNameCell({
  name,
  onUpdate,
  onRemove,
  canRemove,
}: {
  name: string;
  onUpdate: (newName: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(name);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue.trim()) {
      onUpdate(localValue.trim());
    } else {
      setLocalValue(name);
    }
  };

  return (
    <td className="relative group px-3 py-2 font-medium text-sm bg-muted/50 w-[140px]">
      {isEditing ? (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && handleBlur()}
          autoFocus
          className="w-full h-6 px-1 text-sm bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary rounded"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:underline"
        >
          {name}
        </span>
      )}
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Remove ${name} account`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </td>
  );
});

export const HoldingsGridWidget = memo(function HoldingsGridWidget() {
  // Use memoized hook for grid data (avoids recalculation on every render)
  const { gridData, activePortfolioId } = useQuickOverviewGrid();

  // Privacy mode blur
  const blurClass = usePrivacyBlur();
  const addAccount = usePortfolioStore((state) => state.addAccount);
  const removeAccount = usePortfolioStore((state) => state.removeAccount);
  const renameAccount = usePortfolioStore((state) => state.renameAccount);
  const updateQuickOverviewQuantity = usePortfolioStore((state) => state.updateQuickOverviewQuantity);
  const addSymbolToQuickOverview = usePortfolioStore((state) => state.addSymbolToQuickOverview);
  const removeSymbolFromQuickOverview = usePortfolioStore((state) => state.removeSymbolFromQuickOverview);
  const addTransaction = usePortfolioStore((state) => state.addTransaction);
  const getSymbolTags = usePortfolioStore((state) => state.getSymbolTags);
  const addSymbolTags = usePortfolioStore((state) => state.addSymbolTags);
  const removeSymbolTag = usePortfolioStore((state) => state.removeSymbolTag);
  // Subscribe to symbolTags to trigger re-render when tags change
  const _symbolTags = usePortfolioStore((state) => state.symbolTags);

  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [mounted, setMounted] = useState(false);

  // Confirmation dialog state for selling shares before symbol deletion
  const [confirmDeleteSymbol, setConfirmDeleteSymbol] = useState<string | null>(null);

  // Confirmation dialog state for selling shares before account deletion
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<{ id: string; name: string } | null>(null);

  // Flash animation state for deleted rows
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Bulk tag editor dialog state
  const [isBulkTagEditorOpen, setIsBulkTagEditorOpen] = useState(false);

  // Tag filter state
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);

  // Asset detail modal state
  const assetDetailModal = useAssetDetailModal();

  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Responsive column wrapping - measure container and chunk symbols
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxColumnsPerSection, setMaxColumnsPerSection] = useState<number>(Infinity);

  // Observe container width and calculate how many columns fit
  // Debounced to prevent layout thrashing during resize
  useEffect(() => {
    if (!containerRef.current) return;

    const ACCOUNT_COL_WIDTH = 140; // w-[140px]
    const MIN_SYMBOL_COL_WIDTH = 80; // min-w-[70px] + padding
    const BUFFER = 40; // scrollbar + border buffer

    const calculateColumns = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const availableWidth = containerWidth - ACCOUNT_COL_WIDTH - BUFFER;
      const maxCols = Math.max(1, Math.floor(availableWidth / MIN_SYMBOL_COL_WIDTH));
      setMaxColumnsPerSection(maxCols);
    };

    // Initial calculation
    calculateColumns();

    // Debounced resize handler to prevent excessive recalculations
    let resizeTimeout: NodeJS.Timeout | null = null;
    const debouncedCalculate = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateColumns, 100);
    };

    // Watch for resize with debouncing
    const resizeObserver = new ResizeObserver(debouncedCalculate);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [mounted]);

  // Memoized map of symbol -> tags to avoid repeated lookups (O(n) vs O(n²))
  // This is referenced by multiple places: filter dropdown, tag filtering, header cells, tags row
  const symbolTagsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const symbolKey of gridData.symbols) {
      const displaySymbol = symbolKey.includes("-")
        ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
        : symbolKey;
      const assetType = gridData.symbolTypes[symbolKey] || "stock";
      const effectiveType = assetType === "both" ? "stock" : assetType;
      map.set(symbolKey, getSymbolTags(displaySymbol, effectiveType as AssetType));
    }
    return map;
  }, [gridData.symbols, gridData.symbolTypes, getSymbolTags, _symbolTags]);

  // Get all unique tags across all symbols for the filter dropdown
  const allUniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    for (const tags of symbolTagsMap.values()) {
      tags.forEach((tag) => tagsSet.add(tag));
    }
    return Array.from(tagsSet).toSorted();
  }, [symbolTagsMap]);

  // Toggle a tag filter
  const toggleTagFilter = useCallback((tag: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Clear all tag filters
  const clearTagFilters = useCallback(() => {
    setActiveTagFilters([]);
  }, []);

  // Sort and filter symbols based on sort direction and active tag filters
  const visibleSymbols = useMemo(() => {
    let symbols = gridData.symbols;

    // Apply tag filter (show symbols that have ALL selected tags)
    // Uses memoized symbolTagsMap for O(1) lookup instead of O(n) per symbol
    if (activeTagFilters.length > 0) {
      symbols = symbols.filter((symbolKey) => {
        const symbolTags = symbolTagsMap.get(symbolKey) || [];
        // Convert to Set for O(1) lookup per filter tag instead of O(n)
        const symbolTagSet = new Set(symbolTags);
        // Check if symbol has ALL active filter tags
        return activeTagFilters.every((filterTag) => symbolTagSet.has(filterTag));
      });
    }

    // Apply sorting
    if (sortDirection) {
      symbols = [...symbols].sort((a, b) => {
        const comparison = a.localeCompare(b);
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return symbols;
  }, [gridData.symbols, sortDirection, activeTagFilters, symbolTagsMap]);

  // Chunk symbols into sections based on available width
  const symbolSections = useMemo(() => {
    if (maxColumnsPerSection === Infinity || visibleSymbols.length <= maxColumnsPerSection) {
      return [visibleSymbols];
    }

    const sections: string[][] = [];
    for (let i = 0; i < visibleSymbols.length; i += maxColumnsPerSection) {
      sections.push(visibleSymbols.slice(i, i + maxColumnsPerSection));
    }
    return sections;
  }, [visibleSymbols, maxColumnsPerSection]);

  const toggleSort = useCallback(() => {
    setSortDirection((prev) => {
      // First click: sort Z→A (reverse), then toggle between asc/desc
      // This ensures a visible change on first click since data often starts roughly alphabetical
      if (prev === null) return "desc";
      if (prev === "desc") return "asc";
      return "desc";
    });
  }, []);

  // Extract plain symbols and separate by asset type for price fetching
  const { stockSymbols, cryptoSymbols } = useMemo(() => {
    const stocks: string[] = [];
    const crypto: string[] = [];

    for (const key of visibleSymbols) {
      const lastDashIndex = key.lastIndexOf("-");
      if (lastDashIndex > 0) {
        const symbol = key.substring(0, lastDashIndex);
        const assetType = key.substring(lastDashIndex + 1);
        if (assetType === "crypto") {
          crypto.push(symbol);
        } else {
          stocks.push(symbol);
        }
      }
    }

    return { stockSymbols: stocks, cryptoSymbols: crypto };
  }, [visibleSymbols]);

  // Fetch current prices for stocks and crypto separately
  const { data: stockQuotes } = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const { data: cryptoQuotes } = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  // Build price map for quick lookup (keyed by plain symbol)
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (stockQuotes) {
      for (const quote of stockQuotes) {
        map[quote.symbol] = quote.price;
      }
    }
    if (cryptoQuotes) {
      for (const quote of cryptoQuotes) {
        map[quote.symbol] = quote.price;
      }
    }
    return map;
  }, [stockQuotes, cryptoQuotes]);

  // Calculate total portfolio value for position concentration in asset detail modal
  const totalPortfolioValue = useMemo(() => {
    let total = 0;
    for (const symbolKey of visibleSymbols) {
      const symbol = symbolKey.includes("-")
        ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
        : symbolKey;
      const price = priceMap[symbol] || 0;
      const quantity = gridData.totals[symbolKey] || 0;
      total += price * quantity;
    }
    return total;
  }, [visibleSymbols, priceMap, gridData.totals]);

  // Handle adding a symbol from the popover
  const handleAddSymbol = useCallback((symbol: string, assetType: AssetType) => {
    addSymbolToQuickOverview(activePortfolioId, symbol, assetType);
  }, [activePortfolioId, addSymbolToQuickOverview]);

  const handleRemoveSymbol = useCallback((symbolKey: string) => {
    // Check if symbol has holdings before removing
    const totalHoldings = gridData.totals[symbolKey] || 0;

    if (totalHoldings > 0) {
      // Show confirmation dialog to sell shares
      setConfirmDeleteSymbol(symbolKey);
      return;
    }

    // Extract just the symbol for removal (e.g., "BTC" from "BTC-stock")
    const symbol = symbolKey.includes("-")
      ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
      : symbolKey;

    // Remove symbol from Quick Overview (no holdings)
    removeSymbolFromQuickOverview(activePortfolioId, symbol);
  }, [activePortfolioId, removeSymbolFromQuickOverview, gridData.totals]);

  // Handle confirmed sell and delete
  const handleConfirmSellAndDelete = useCallback(() => {
    if (!confirmDeleteSymbol) return;

    const symbolKey = confirmDeleteSymbol;
    // Extract symbol and assetType from composite key (e.g., "BTC-stock")
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const symbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
    const assetType = lastDashIndex > 0 ? symbolKey.substring(lastDashIndex + 1) as "stock" | "crypto" : "stock";

    const currentPrice = priceMap[symbol] || 0;

    // Create sell transactions for each account that holds this symbol+assetType
    gridData.accounts.forEach((account) => {
      const quantity = account.holdings[symbolKey] || 0;
      if (quantity > 0) {
        addTransaction(
          {
            symbol,
            type: "sell",
            assetType,
            quantity,
            price: currentPrice,
            date: new Date().toISOString(),
            notes: `Auto-sold when removing ${symbol} (${assetType}) from Quick Overview`,
          },
          activePortfolioId,
          account.id
        );
      }
    });

    // Remove symbol from Quick Overview
    removeSymbolFromQuickOverview(activePortfolioId, symbol);

    // Close dialog
    setConfirmDeleteSymbol(null);
  }, [confirmDeleteSymbol, priceMap, gridData.accounts, activePortfolioId, addTransaction, removeSymbolFromQuickOverview]);

  // Handle adding an account from the popover
  const handleAddAccount = useCallback((name: string) => {
    addAccount(activePortfolioId, name);
  }, [activePortfolioId, addAccount]);

  // Handle removing an account - check for holdings first
  const handleRemoveAccount = useCallback((accountId: string) => {
    const account = gridData.accounts.find((a) => a.id === accountId);
    if (!account) return;

    // Check if account has any holdings
    const hasHoldings = Object.values(account.holdings).some((qty) => qty > 0);

    if (hasHoldings) {
      // Show confirmation dialog
      setConfirmDeleteAccount({ id: accountId, name: account.name });
      return;
    }

    // No holdings - just delete with flash animation
    setDeletingAccountId(accountId);
    setTimeout(() => {
      removeAccount(activePortfolioId, accountId);
      setDeletingAccountId(null);
    }, 400);
  }, [gridData.accounts, activePortfolioId, removeAccount]);

  // Handle confirmed sell and delete for account
  const handleConfirmSellAccountAndDelete = useCallback(() => {
    if (!confirmDeleteAccount) return;

    // Capture ALL data needed upfront to avoid stale closure issues
    // This prevents bugs if user rapidly interacts during the 400ms animation
    const accountIdToDelete = confirmDeleteAccount.id;
    const accountName = confirmDeleteAccount.name;
    const portfolioIdAtDelete = activePortfolioId; // Capture current portfolio ID
    const account = gridData.accounts.find((a) => a.id === accountIdToDelete);

    // Capture current prices for all holdings we'll sell
    const holdingsToSell: Array<{
      symbol: string;
      assetType: "stock" | "crypto";
      quantity: number;
      price: number;
    }> = [];

    if (account) {
      for (const [symbolKey, quantity] of Object.entries(account.holdings)) {
        if (quantity > 0) {
          const lastDashIndex = symbolKey.lastIndexOf("-");
          const symbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
          const assetType = lastDashIndex > 0 ? symbolKey.substring(lastDashIndex + 1) as "stock" | "crypto" : "stock";
          const currentPrice = priceMap[symbol] || 0;

          holdingsToSell.push({ symbol, assetType, quantity, price: currentPrice });
        }
      }
    }

    // Create sell transactions using captured data
    for (const holding of holdingsToSell) {
      addTransaction(
        {
          symbol: holding.symbol,
          type: "sell",
          assetType: holding.assetType,
          quantity: holding.quantity,
          price: holding.price,
          date: new Date().toISOString(),
          notes: `Auto-sold when deleting ${accountName} account`,
        },
        portfolioIdAtDelete,
        accountIdToDelete
      );
    }

    // Flash red then delete (forceRemove=true removes account AND cleans up original buy transactions)
    setDeletingAccountId(accountIdToDelete);
    setConfirmDeleteAccount(null);

    // Use captured values in setTimeout to avoid stale closure
    setTimeout(() => {
      removeAccount(portfolioIdAtDelete, accountIdToDelete, true);
      setDeletingAccountId(null);
    }, 400);
  }, [confirmDeleteAccount, activePortfolioId, removeAccount, gridData.accounts, priceMap, addTransaction]);

  const handleUpdateQuantity = useCallback((
    accountId: string,
    symbolKey: string, // Composite key like "BTC-stock" or "BTC-crypto"
    newQuantity: number
  ) => {
    // Extract symbol and assetType from composite key
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const symbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
    const assetType = lastDashIndex > 0 ? symbolKey.substring(lastDashIndex + 1) as "stock" | "crypto" : "stock";

    const currentPrice = priceMap[symbol] || 0;

    // Don't create transactions with price=0 as it corrupts cost basis data
    if (currentPrice === 0) {
      console.warn(
        `[HoldingsGridWidget] Cannot save quantity for ${symbol}: price not yet loaded. Please wait for prices to load.`
      );
      return;
    }

    updateQuickOverviewQuantity(
      activePortfolioId,
      accountId,
      symbol,
      newQuantity,
      currentPrice,
      assetType
    );
  }, [activePortfolioId, priceMap, updateQuickOverviewQuantity]);

  // Handle keyboard navigation between cells
  const handleCellNavigate = useCallback((direction: "up" | "down" | "left" | "right", fromCellId: string) => {
    const [rowIndexStr, colIndexStr] = fromCellId.split("-");
    const rowIndex = parseInt(rowIndexStr, 10);
    const colIndex = parseInt(colIndexStr, 10);

    let nextRowIndex = rowIndex;
    let nextColIndex = colIndex;

    if (direction === "down") {
      // Move to next row, same column
      nextRowIndex = rowIndex + 1;
      if (nextRowIndex >= gridData.accounts.length) {
        // Wrap to first row, next column
        nextRowIndex = 0;
        nextColIndex = colIndex + 1;
      }
    } else if (direction === "up") {
      // Move to previous row, same column
      nextRowIndex = rowIndex - 1;
      if (nextRowIndex < 0) {
        // Wrap to last row, previous column
        nextRowIndex = gridData.accounts.length - 1;
        nextColIndex = colIndex - 1;
      }
    } else if (direction === "right") {
      // Move to next column, same row
      nextColIndex = colIndex + 1;
      if (nextColIndex >= visibleSymbols.length) {
        // Wrap to first column, next row
        nextColIndex = 0;
        nextRowIndex = rowIndex + 1;
      }
    } else if (direction === "left") {
      // Move to previous column, same row
      nextColIndex = colIndex - 1;
      if (nextColIndex < 0) {
        // Wrap to last column, previous row
        nextColIndex = visibleSymbols.length - 1;
        nextRowIndex = rowIndex - 1;
      }
    }

    // Check if target cell exists
    if (nextRowIndex >= 0 && nextRowIndex < gridData.accounts.length &&
        nextColIndex >= 0 && nextColIndex < visibleSymbols.length) {
      const nextCellId = `${nextRowIndex}-${nextColIndex}`;
      const nextInput = document.querySelector(`[data-cell-id="${nextCellId}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
  }, [gridData.accounts.length, visibleSymbols.length]);

  // Calculate dialog info for account deletion (must be before conditional returns - React hooks rule)
  const confirmAccountInfo = useMemo(() => {
    if (!confirmDeleteAccount) return null;
    const account = gridData.accounts.find((a) => a.id === confirmDeleteAccount.id);
    if (!account) return null;

    const holdings = Object.entries(account.holdings)
      .filter(([, qty]) => qty > 0)
      .map(([symbolKey, qty]) => {
        // Extract symbol and assetType from composite key (e.g., "AAPL-stock")
        const lastDashIndex = symbolKey.lastIndexOf("-");
        const symbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
        const assetType = lastDashIndex > 0 ? symbolKey.substring(lastDashIndex + 1) : "stock";
        const price = priceMap[symbol] || 0;
        return {
          symbolKey,
          symbol,
          assetType,
          quantity: qty,
          price,
          value: qty * price,
        };
      });

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

    return {
      name: account.name,
      holdings,
      totalValue,
    };
  }, [confirmDeleteAccount, gridData.accounts, priceMap]);

  // Show skeleton during SSR/hydration to prevent mismatch
  if (!mounted) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate dialog info for symbol deletion
  const confirmSymbolInfo = confirmDeleteSymbol ? (() => {
    // Extract display symbol from composite key (e.g., "BTC" from "BTC-stock")
    const symbolKey = confirmDeleteSymbol;
    const lastDashIndex = symbolKey.lastIndexOf("-");
    const displaySymbol = lastDashIndex > 0 ? symbolKey.substring(0, lastDashIndex) : symbolKey;
    const assetType = lastDashIndex > 0 ? symbolKey.substring(lastDashIndex + 1) : "stock";
    const currentPrice = priceMap[displaySymbol] || 0;

    return {
      symbol: displaySymbol,
      assetType,
      totalShares: gridData.totals[symbolKey] || 0,
      currentPrice,
      totalValue: (gridData.totals[symbolKey] || 0) * currentPrice,
    };
  })() : null;

  return (
    <>
      {/* Confirmation dialog for selling shares before deletion */}
      <ConfirmSellSymbolDialog
        open={!!confirmDeleteSymbol}
        onOpenChange={(open) => !open && setConfirmDeleteSymbol(null)}
        symbolInfo={confirmSymbolInfo}
        onConfirm={handleConfirmSellAndDelete}
      />

      {/* Confirmation dialog for selling shares before account deletion */}
      <ConfirmSellAccountDialog
        open={!!confirmDeleteAccount}
        onOpenChange={(open) => !open && setConfirmDeleteAccount(null)}
        accountInfo={confirmAccountInfo}
        onConfirm={handleConfirmSellAccountAndDelete}
      />

      {/* Bulk Tag Editor Dialog */}
      <BulkTagEditorDialog
        open={isBulkTagEditorOpen}
        onOpenChange={setIsBulkTagEditorOpen}
      />

      {/* Asset Detail Modal - opens on double-click of symbol header */}
      <AssetDetailModal
        open={assetDetailModal.open}
        onOpenChange={assetDetailModal.setOpen}
        symbol={assetDetailModal.symbol}
        assetType={assetDetailModal.assetType}
        currentPrice={assetDetailModal.currentPrice}
        assetName={assetDetailModal.assetName}
        totalPortfolioValue={totalPortfolioValue}
      />

      <div ref={containerRef} className="space-y-[17px]">
        {/* Header */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <TagFilterDropdown
              allTags={allUniqueTags}
              activeFilters={activeTagFilters}
              onToggleFilter={toggleTagFilter}
              onClearFilters={clearTagFilters}
            />
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-xs transition-colors",
                isBulkTagEditorOpen && "bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400"
              )}
              onClick={() => setIsBulkTagEditorOpen(true)}
            >
              <Tag className="w-3 h-3 mr-1" />
              Add Tags
            </Button>
            <AddAccountPopover
              onAddAccount={handleAddAccount}
              defaultAccountNumber={gridData.accounts.length + 1}
            />
            <AddSymbolsPopover
              existingSymbolKeys={visibleSymbols}
              onAddSymbol={handleAddSymbol}
            />
          </div>
        </div>

        {/* Table Sections - wraps columns into multiple tables when they don't fit */}
        {symbolSections.map((sectionSymbols, sectionIndex) => (
          <div key={sectionIndex} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-xs bg-muted/50 w-[140px]">
                    <div className="flex items-center gap-1">
                      <span>Account</span>
                      {sectionIndex === 0 && (
                        <button
                          onClick={toggleSort}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={sortDirection === "desc" ? "Sort A to Z" : "Sort Z to A"}
                        >
                          {sortDirection === "desc" ? (
                            <ArrowUpZA className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownAZ className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                  {sectionSymbols.map((symbolKey) => {
                    // Extract symbol and asset type from composite key
                    const displaySymbol = symbolKey.includes("-")
                      ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
                      : symbolKey;
                    const symbolAssetType = gridData.symbolTypes[symbolKey] || "stock";
                    const effectiveAssetType = symbolAssetType === "both" ? "stock" : symbolAssetType;

                    const currentPrice = priceMap[displaySymbol] || 0;
                    // Use memoized tags map for O(1) lookup
                    const symbolTags = symbolTagsMap.get(symbolKey) || [];
                    return (
                      <SymbolHeaderCell
                        key={symbolKey}
                        symbolKey={symbolKey}
                        assetType={symbolAssetType}
                        onRemove={() => handleRemoveSymbol(symbolKey)}
                        tags={symbolTags}
                        onAddTags={(tags) => addSymbolTags(displaySymbol, effectiveAssetType, tags)}
                        onRemoveTag={(tag) => removeSymbolTag(displaySymbol, effectiveAssetType, tag)}
                        onClick={() =>
                          assetDetailModal.openModal(
                            displaySymbol,
                            effectiveAssetType,
                            currentPrice
                          )
                        }
                      />
                    );
                  })}
                </tr>
                {/* Tags Row - dedicated row for symbol tags with larger text */}
                <tr>
                  <td className="px-3 py-1 bg-muted/30 w-[140px]" />

                  {sectionSymbols.map((symbolKey) => (
                    <TagsRowCell
                      key={symbolKey}
                      tags={symbolTagsMap.get(symbolKey) || []}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridData.accounts.map((account, rowIndex) => (
                  <tr
                    key={account.id}
                    className={cn(
                      "border-b border-border/50 transition-colors duration-300",
                      rowIndex % 2 === 0 ? "bg-transparent" : "bg-muted/20",
                      deletingAccountId === account.id && "bg-red-500/30 dark:bg-red-600/30"
                    )}
                  >
                    {sectionIndex === 0 ? (
                      <AccountNameCell
                        name={account.name}
                        onUpdate={(name) => renameAccount(activePortfolioId, account.id, name)}
                        onRemove={() => handleRemoveAccount(account.id)}
                        canRemove={gridData.accounts.length > 1}
                      />
                    ) : (
                      <td className="px-3 py-2 font-medium text-sm bg-muted/50 w-[140px]">
                        <span className="text-muted-foreground">{account.name}</span>
                      </td>
                    )}
                    {sectionSymbols.map((symbolKey, colIndex) => {
                      // Extract just the symbol for price lookup (e.g., "BTC" from "BTC-stock")
                      const symbol = symbolKey.includes("-")
                        ? symbolKey.substring(0, symbolKey.lastIndexOf("-"))
                        : symbolKey;
                      // Calculate global column index for cell navigation
                      const globalColIndex = sectionIndex * maxColumnsPerSection + colIndex;
                      return (
                        <td key={symbolKey} className="px-1 py-1 border-l border-border/30">
                          <QuantityCell
                            value={account.holdings[symbolKey] || 0}
                            onChange={(qty) => handleUpdateQuantity(account.id, symbolKey, qty)}
                            disabled={!priceMap[symbol] && (account.holdings[symbolKey] || 0) > 0}
                            cellId={`${rowIndex}-${globalColIndex}`}
                            onNavigate={handleCellNavigate}
                            blurClass={blurClass}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2 text-sm w-[140px]">TOTAL</td>
                  {sectionSymbols.map((symbolKey) => (
                    <td
                      key={symbolKey}
                      className={cn(
                        "px-2 py-2 text-right text-sm tabular-nums border-l border-border/30",
                        blurClass
                      )}
                    >
                      {gridData.totals[symbolKey] > 0
                        ? gridData.totals[symbolKey].toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Empty state */}
        {visibleSymbols.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">No symbols tracked yet</p>
            <p className="text-xs text-muted-foreground">
              Add symbols using the &quot;Add Investments&quot; button above, or add transactions in the Portfolio page.
            </p>
          </div>
        )}
      </div>
    </>
  );
});
