"use client";

import { useState, useMemo, useCallback, useRef, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import Image from "next/image";
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, StickyNote, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TagBadge } from "@/components/ui/tag-badge";
import { usePrivacyBlur } from "@/hooks/usePrivacyMode";
import { shouldUseVirtualization, VIRTUALIZATION_THRESHOLD } from "@/hooks/useVirtualScroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { formatCurrency, formatPercent, formatCryptoPrice } from "@/lib/formatters";
import { useAssetDetailModal } from "@/hooks/useAssetDetailModal";
import { AssetDetailModal } from "@/components/portfolio/AssetDetailModal";
import type { HoldingWithValue } from "@/types/portfolio";
import type { SortField, SortDirection } from "@/types/dashboard";

/** Accessible change indicator with glow effect - WCAG 1.4.1 */
function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 transition-all duration-200",
      isPositive
        ? "text-gain glow-gain"
        : "text-loss glow-loss"
    )}>
      <span aria-label={`${isPositive ? "up" : "down"} ${Math.abs(value).toFixed(2)} percent`}>
        {formatPercent(value)}
      </span>
    </span>
  );
}

/** Get logo URL for an asset with fallback to external services */
function getLogoUrl(symbol: string, assetType: "stock" | "crypto"): string {
  if (assetType === "crypto") {
    return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
  }
  return `https://assets.parqet.com/logos/symbol/${symbol}?format=png`;
}

/** Asset logo with reserved dimensions to prevent CLS */
const AssetLogo = memo(function AssetLogo({
  symbol,
  assetType,
  name,
  size = 24
}: {
  symbol: string;
  assetType: "stock" | "crypto";
  name?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getLogoUrl(symbol, assetType);

  return (
    <div
      className="relative flex-shrink-0 rounded-full bg-muted overflow-hidden"
      style={{ width: size, height: size }}
    >
      {imgError ? (
        <div
          className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground"
          aria-hidden="true"
        >
          {symbol.slice(0, 2)}
        </div>
      ) : (
        <Image
          src={logoUrl}
          alt={name ? `${name} logo` : `${symbol} logo`}
          width={size}
          height={size}
          className="rounded-full object-contain"
          onError={() => setImgError(true)}
          unoptimized
        />
      )}
    </div>
  );
});

interface HoldingsTableProps {
  holdings: HoldingWithValue[];
  isLoading?: boolean;
}

export function HoldingsTable({ holdings, isLoading }: HoldingsTableProps) {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; symbol: string | null }>({
    open: false,
    symbol: null,
  });

  // Privacy mode blur
  const blurClass = usePrivacyBlur();

  // Asset detail modal state
  const assetDetailModal = useAssetDetailModal();

  // Combine store subscriptions into single selector to reduce re-renders
  const { getActiveTransactions, removeTransaction, getSymbolNote, setSymbolNote } = usePortfolioStore(
    useShallow((state) => ({
      getActiveTransactions: state.getActiveTransactions,
      removeTransaction: state.removeTransaction,
      getSymbolNote: state.getSymbolNote,
      setSymbolNote: state.setSymbolNote,
    }))
  );
  const transactions = getActiveTransactions();

  // Debounced note update to avoid too many store writes
  const handleNoteChange = useCallback((symbol: string, assetType: "stock" | "crypto", note: string) => {
    setSymbolNote(symbol, assetType, note);
  }, [setSymbolNote]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "name":
          aValue = a.name || a.symbol;
          bValue = b.name || b.symbol;
          break;
        case "price":
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case "hourChangePercent":
          // Treat null (stocks) as 0 for sorting purposes
          aValue = a.hourChangePercent ?? 0;
          bValue = b.hourChangePercent ?? 0;
          break;
        case "change":
          // Sort by total daily dollar change (value * percentage)
          aValue = a.currentValue * (a.dayChangePercent / 100);
          bValue = b.currentValue * (b.dayChangePercent / 100);
          break;
        case "changePercent":
          aValue = a.dayChangePercent;
          bValue = b.dayChangePercent;
          break;
        case "value":
          aValue = a.currentValue;
          bValue = b.currentValue;
          break;
        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case "allocation":
          aValue = a.allocation;
          bValue = b.allocation;
          break;
        case "gain":
          aValue = a.gain;
          bValue = b.gain;
          break;
        case "gainPercent":
          aValue = a.gainPercent;
          bValue = b.gainPercent;
          break;
        default:
          aValue = a.currentValue;
          bValue = b.currentValue;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [holdings, sortField, sortDirection]);

  const handleDeleteHolding = (symbol: string) => {
    setDeleteConfirm({ open: true, symbol });
  };

  const confirmDeleteHolding = () => {
    if (deleteConfirm.symbol) {
      const symbolTransactions = transactions.filter((t) => t.symbol === deleteConfirm.symbol);
      symbolTransactions.forEach((t) => removeTransaction(t.id));
    }
    setDeleteConfirm({ open: false, symbol: null });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50 transition-opacity" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 transition-transform duration-200" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 transition-transform duration-200" />
    );
  };

  const formatPrice = (holding: HoldingWithValue) => {
    if (holding.assetType === "crypto") {
      return formatCryptoPrice(holding.currentPrice);
    }
    return formatCurrency(holding.currentPrice);
  };

  // Calculate total portfolio value for position concentration
  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  // Check if we should use virtualization for large lists
  const useVirtualization = shouldUseVirtualization(sortedHoldings.length);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Row height for virtualization calculations (approximate)
  const ROW_HEIGHT = 56; // px
  const MAX_VISIBLE_ROWS = 15;
  const virtualizedHeight = useVirtualization
    ? Math.min(sortedHoldings.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT
    : "auto";

  if (holdings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Horizontal scroll container for mobile - WCAG responsive */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Virtualization notice for large lists */}
        {useVirtualization && (
          <div className="px-3 py-1.5 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground">
            Showing {sortedHoldings.length} holdings (virtualized for performance)
          </div>
        )}
        <div
          ref={tableContainerRef}
          className={cn(
            "overflow-x-auto",
            useVirtualization && "overflow-y-auto"
          )}
          style={useMemo(() => ({
            WebkitOverflowScrolling: "touch" as const,
            maxHeight: useVirtualization ? `${virtualizedHeight}px` : undefined,
          }), [useVirtualization, virtualizedHeight])}
        >
          <Table className="min-w-[600px] md:min-w-[1050px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort("symbol")}
                >
                  Asset
                  <SortIcon field="symbol" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  Tags
                </div>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("price")}
                >
                  Price
                  <SortIcon field="price" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("hourChangePercent")}
                >
                  Hour %
                  <SortIcon field="hourChangePercent" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("changePercent")}
                >
                  Today %
                  <SortIcon field="changePercent" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("change")}
                >
                  Today $
                  <SortIcon field="change" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("value")}
                >
                  Value
                  <SortIcon field="value" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("quantity")}
                >
                  Qty
                  <SortIcon field="quantity" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => handleSort("allocation")}
                >
                  Allocation
                  <SortIcon field="allocation" />
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-[150px]">
                <div className="flex items-center gap-1">
                  <StickyNote className="h-3 w-3" aria-hidden="true" />
                  Notes
                </div>
              </TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding) => (
              <TableRow
                key={holding.id}
                className="group cursor-pointer"
                onDoubleClick={() =>
                  assetDetailModal.openModal(
                    holding.symbol,
                    holding.assetType,
                    holding.currentPrice,
                    holding.name
                  )
                }
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AssetLogo
                      symbol={holding.symbol}
                      assetType={holding.assetType}
                      name={holding.name}
                      size={28}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{holding.symbol}</span>
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 text-[9px] font-medium",
                            holding.assetType === "stock"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                          )}
                          aria-label={holding.assetType === "stock" ? "Stock" : "Cryptocurrency"}
                        >
                          {holding.assetType === "stock" ? "S" : "C"}
                        </span>
                      </div>
                      {holding.name && (
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {holding.name}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {holding.tags && holding.tags.length > 0 ? (
                      holding.tags.map((tag) => (
                        <TagBadge key={tag} tag={tag} size="sm" />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn("text-right font-mono", blurClass)}>
                  {isLoading ? (
                    <span className="text-muted-foreground" aria-label="Loading price">...</span>
                  ) : (
                    formatPrice(holding)
                  )}
                </TableCell>
                <TableCell className={cn("hidden md:table-cell text-right", blurClass)}>
                  {isLoading ? (
                    <span className="text-muted-foreground" aria-label="Loading hour change">--</span>
                  ) : holding.hourChangePercent !== null ? (
                    <ChangeIndicator value={holding.hourChangePercent} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn("text-right", blurClass)}>
                  {isLoading ? (
                    <span className="text-muted-foreground" aria-label="Loading change">--</span>
                  ) : (
                    <ChangeIndicator value={holding.dayChangePercent} />
                  )}
                </TableCell>
                <TableCell className={cn("hidden lg:table-cell text-right font-mono", blurClass)}>
                  {isLoading ? (
                    <span className="text-muted-foreground" aria-label="Loading daily gain">--</span>
                  ) : (
                    (() => {
                      // Calculate daily $ change from value and percentage
                      const dailyDollarChange = holding.currentValue * (holding.dayChangePercent / 100);
                      return (
                        <span className={cn(
                          dailyDollarChange >= 0
                            ? "text-gain glow-gain"
                            : "text-loss glow-loss"
                        )}>
                          {dailyDollarChange >= 0 ? "+" : ""}
                          {formatCurrency(dailyDollarChange)}
                        </span>
                      );
                    })()
                  )}
                </TableCell>
                <TableCell className={cn("text-right font-mono", blurClass)}>
                  {isLoading ? (
                    <span className="text-muted-foreground" aria-label="Loading value">--</span>
                  ) : (
                    formatCurrency(holding.currentValue)
                  )}
                </TableCell>
                <TableCell className={cn("text-right font-mono", blurClass)}>
                  {holding.quantity.toLocaleString(undefined, {
                    maximumFractionDigits: 8,
                  })}
                </TableCell>
                <TableCell className={cn("hidden md:table-cell text-right font-mono text-muted-foreground", blurClass)}>
                  {holding.allocation.toFixed(1)}%
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Input
                    type="text"
                    placeholder="Add note..."
                    defaultValue={getSymbolNote(holding.symbol, holding.assetType)}
                    onBlur={(e) => handleNoteChange(holding.symbol, holding.assetType, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="h-8 text-xs !bg-transparent border-none shadow-none focus:border focus:border-border focus-visible:ring-0 focus-visible:!bg-transparent transition-colors"
                    aria-label={`Note for ${holding.symbol}`}
                  />
                </TableCell>
                <TableCell>
                  {/* Use native title instead of Radix Tooltip for performance */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 touch-target text-muted-foreground hover:text-destructive focus-ring opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    onClick={() => handleDeleteHolding(holding.symbol)}
                    aria-label={`Delete ${holding.symbol} holding`}
                    title="Delete holding"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </div>

    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm({ open, symbol: open ? deleteConfirm.symbol : null })}
      title="Delete Holding"
      description={`Are you sure you want to delete all transactions for ${deleteConfirm.symbol}? This action cannot be undone.`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={confirmDeleteHolding}
      variant="destructive"
    />

    {/* Asset Detail Modal - opens on double-click */}
    <AssetDetailModal
      open={assetDetailModal.open}
      onOpenChange={assetDetailModal.setOpen}
      symbol={assetDetailModal.symbol}
      assetType={assetDetailModal.assetType}
      currentPrice={assetDetailModal.currentPrice}
      assetName={assetDetailModal.assetName}
      totalPortfolioValue={totalPortfolioValue}
    />
    </>
  );
}
