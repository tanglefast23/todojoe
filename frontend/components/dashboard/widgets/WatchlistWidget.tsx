"use client";

import { useMemo, useState, memo, useCallback, useRef } from "react";
import Image from "next/image";
import { Moon, Sun, X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useBatchStockQuotes } from "@/hooks/useStockData";
import { useBatchCryptoQuotes } from "@/hooks/useCryptoData";
import { useFormatters } from "@/hooks/useFormatters";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Button } from "@/components/ui/button";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle
import { isCryptoSymbol } from "@/lib/assetUtils";
import type { StockQuote, CryptoQuote } from "@/types/market";

interface WatchlistWidgetProps {
  symbols: string[];
  title?: string;
  isCompact?: boolean;
  onSymbolsChange?: (symbols: string[]) => void;
  onOpenChart?: (symbol: string, assetType: "stock" | "crypto") => void;
}

interface WatchlistItem {
  symbol: string;
  originalKey: string; // The original key including type suffix (e.g., "AERO-crypto")
  name: string;
  logoUrl: string | null;
  price: number;
  type: "stock" | "crypto";
  changePercentDay: number;
  changePercentWeek: number | null;
  changePercentMonth: number | null;
  changePercentYear: number | null;
  preMarketChangePercent: number | null;
  postMarketChangePercent: number | null;
  marketState: string | null;
  futuresSymbol: string | null;
}

// Sortable column definitions
type SortField = "symbol" | "price" | "changePercentDay" | "changePercentWeek" | "changePercentMonth" | "changePercentYear";
type SortDirection = "asc" | "desc";

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/** Accessible change cell with +/- prefix and glow effect - WCAG 1.4.1 */
function ChangeCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground transition-opacity duration-200" aria-label="No data">—</span>;
  }

  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "font-mono text-xs transition-all duration-200",
        isPositive
          ? "text-gain glow-gain"
          : "text-loss glow-loss"
      )}
      aria-label={`${isPositive ? "up" : "down"} ${Math.abs(value).toFixed(2)} percent`}
    >
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

/** Asset logo with reserved dimensions to prevent CLS */
const AssetLogo = memo(function AssetLogo({ url, symbol, name, size = 20 }: { url: string | null; symbol: string; name?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);

  // Always render a fixed-size container to prevent layout shift
  return (
    <div
      className="relative flex-shrink-0 rounded-full bg-muted"
      style={{ width: size, height: size }}
    >
      {(!url || imgError) ? (
        // Fallback to initials - decorative, hidden from AT
        <div
          className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
          aria-hidden="true"
        >
          {symbol.slice(0, 2)}
        </div>
      ) : (
        <Image
          src={url}
          alt={name ? `${name} logo` : ""}
          width={size}
          height={size}
          className="rounded-full"
          onError={() => setImgError(true)}
          unoptimized // External images
        />
      )}
    </div>
  );
});

/** Sortable column header with visual indicator */
function SortableHeader({
  field,
  label,
  sortConfig,
  onSort,
  align = "right",
}: {
  field: SortField;
  label: string;
  sortConfig: SortConfig | null;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = sortConfig?.field === field;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <th
      className={cn(
        "py-1.5 px-1 font-medium cursor-pointer select-none transition-colors hover:bg-muted/50",
        align === "left" ? "text-left" : "text-right",
        isActive && "text-foreground"
      )}
      onClick={() => onSort(field)}
      title={`Click to sort by ${label}`}
    >
      <span className={cn("inline-flex items-center gap-0.5", align === "right" && "flex-row-reverse")}>
        {label}
        <span className="w-3 h-3 flex items-center justify-center">
          {direction === "desc" && <ChevronDown className="h-3 w-3" />}
          {direction === "asc" && <ChevronUp className="h-3 w-3" />}
        </span>
      </span>
    </th>
  );
}

/** Memoized table row component to prevent re-renders when other rows update */
const WatchlistRow = memo(function WatchlistRow({
  item,
  index,
  isCompact,
  hasExtendedHours,
  onSymbolsChange,
  onOpenChart,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  draggedIndex,
  dragOverIndex,
  formatCurrency,
}: {
  item: WatchlistItem;
  index: number;
  isCompact: boolean;
  hasExtendedHours: boolean;
  onSymbolsChange?: (symbols: string[]) => void;
  onOpenChart?: (symbol: string, assetType: "stock" | "crypto") => void;
  onDragStart: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onDrop: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onRemove: (originalKey: string) => void;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  formatCurrency: (value: number) => string;
}) {
  const isEven = index % 2 === 0;

  return (
    <tr
      draggable={!!onSymbolsChange}
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className={cn(
        "border-b border-border/30 transition-all duration-150 group",
        isEven ? "bg-transparent" : "bg-muted/20",
        "hover:bg-accent/50 hover:border-border",
        "hover:shadow-[inset_2px_0_0_hsl(var(--primary))]",
        onOpenChart && "cursor-pointer",
        dragOverIndex === index && draggedIndex !== index && "bg-primary/10 border-primary/50"
      )}
      onDoubleClick={() => onOpenChart?.(item.symbol, item.type)}
      title={onOpenChart ? "Double-click to open chart" : undefined}
    >
      {/* Drag handle */}
      {onSymbolsChange && (
        <td className="py-1.5 px-1 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
        </td>
      )}
      {/* Symbol with Logo */}
      <td className="py-1.5 px-1">
        <div className="flex items-center gap-2">
          <AssetLogo url={item.logoUrl} symbol={item.symbol} name={item.name} size={24} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium">{item.symbol}</span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium",
                  item.type === "stock"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                )}
                aria-label={item.type === "stock" ? "Stock" : "Cryptocurrency"}
              >
                {item.type === "stock" ? "S" : "C"}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">
              {item.name}
            </div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="text-right py-1.5 px-1 font-mono">
        {formatCurrency(item.price)}
      </td>

      {/* Day Change */}
      <td className="text-right py-1.5 px-1">
        <ChangeCell value={item.changePercentDay} />
      </td>

      {/* Week/Month/Year Change - hidden in compact mode */}
      {!isCompact && (
        <>
          <td className="text-right py-1.5 px-1">
            <ChangeCell value={item.changePercentWeek} />
          </td>
          <td className="text-right py-1.5 px-1">
            <ChangeCell value={item.changePercentMonth} />
          </td>
          <td className="text-right py-1.5 px-1">
            <ChangeCell value={item.changePercentYear} />
          </td>
        </>
      )}

      {/* Pre/Post Market - hidden in compact mode */}
      {hasExtendedHours && !isCompact && (
        <>
          <td className="text-right py-1.5 px-1">
            <ChangeCell value={item.preMarketChangePercent} />
          </td>
          <td className="text-right py-1.5 px-1">
            <ChangeCell value={item.postMarketChangePercent} />
          </td>
        </>
      )}

      {/* Remove button - larger touch target */}
      <td className="py-1.5 px-1">
        {onSymbolsChange && (
          <Button
            variant="ghost"
            size="icon"
            className="widget-close-btn h-8 w-8 touch-target opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus-ring"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(item.originalKey);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(item.originalKey);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Remove ${item.symbol} from watchlist`}
            title="Remove from watchlist"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
      </td>
    </tr>
  );
});

/** Memoized watchlist widget - prevents unnecessary re-renders */
export const WatchlistWidget = memo(function WatchlistWidget({ symbols: rawSymbols, title, isCompact = false, onSymbolsChange, onOpenChart }: WatchlistWidgetProps) {
  // Ensure symbols is always an array and deduplicate (handle corrupted widget config)
  const symbols = useMemo(() => {
    const arr = Array.isArray(rawSymbols) ? rawSymbols : [];
    // Deduplicate while preserving order
    return [...new Set(arr)];
  }, [rawSymbols]);

  // Currency-aware formatters
  const { formatCurrency } = useFormatters();

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLTableRowElement | null>(null);

  // Sorting state - null means use original user order
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => {
      if (!prev || prev.field !== field) {
        // First click on a new field: sort descending (highest to lowest)
        return { field, direction: "desc" };
      }
      if (prev.direction === "desc") {
        // Second click: sort ascending (lowest to highest)
        return { field, direction: "asc" };
      }
      // Third click: clear sort, return to user order
      return null;
    });
  }, []);

  // Parse symbol key to extract symbol and forced type
  // e.g., "AERO-crypto" → { symbol: "AERO", type: "crypto" }
  // e.g., "BTC" → { symbol: "BTC", type: auto-detect }
  const parseSymbolKey = useCallback((key: string): { symbol: string; type: "stock" | "crypto" } => {
    const upper = key.toUpperCase();
    // Check for explicit type suffix
    if (upper.endsWith("-STOCK")) {
      return { symbol: upper.slice(0, -6), type: "stock" };
    }
    if (upper.endsWith("-CRYPTO")) {
      return { symbol: upper.slice(0, -7), type: "crypto" };
    }
    // Auto-detect
    return { symbol: upper, type: isCryptoSymbol(upper) ? "crypto" : "stock" };
  }, []);

  // Separate symbols into stocks and crypto, tracking original keys
  const { stockSymbols, cryptoSymbols, symbolKeyMap } = useMemo(() => {
    const stocks: string[] = [];
    const crypto: string[] = [];
    const keyMap: Record<string, { originalKey: string; type: "stock" | "crypto" }> = {};

    symbols.forEach((key) => {
      const { symbol, type } = parseSymbolKey(key);
      keyMap[symbol] = { originalKey: key, type };

      if (type === "crypto") {
        crypto.push(symbol);
      } else {
        stocks.push(symbol);
      }
    });

    return { stockSymbols: stocks, cryptoSymbols: crypto, symbolKeyMap: keyMap };
  }, [symbols, parseSymbolKey]);

  const stocksQuery = useBatchStockQuotes(stockSymbols, stockSymbols.length > 0);
  const cryptoQuery = useBatchCryptoQuotes(cryptoSymbols, cryptoSymbols.length > 0);

  const isLoading = stocksQuery.isLoading || cryptoQuery.isLoading;
  const hasError = stocksQuery.error || cryptoQuery.error;

  const handleRetry = () => {
    if (stocksQuery.error) stocksQuery.refetch();
    if (cryptoQuery.error) cryptoQuery.refetch();
  };

  const handleRemoveSymbol = (originalKey: string) => {
    if (onSymbolsChange) {
      onSymbolsChange(symbols.filter((s) => s !== originalKey));
    }
  };

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    // Add drag styling after a brief delay to prevent flash
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.5";
      }
    }, 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
      dragNodeRef.current = null;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !onSymbolsChange) {
      return;
    }

    // Reorder symbols array
    const newSymbols = [...symbols];
    const [draggedSymbol] = newSymbols.splice(draggedIndex, 1);
    newSymbols.splice(dropIndex, 0, draggedSymbol);

    onSymbolsChange(newSymbols);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, symbols, onSymbolsChange]);

  // Combine results into unified items, preserving user's symbol order
  const items: WatchlistItem[] = useMemo(() => {
    // Build a map of all quotes by symbol for fast lookup
    const stockQuoteMap = new Map<string, StockQuote>();
    const cryptoQuoteMap = new Map<string, CryptoQuote>();

    if (stocksQuery.data) {
      stocksQuery.data.forEach((quote: StockQuote) => {
        stockQuoteMap.set(quote.symbol.toUpperCase(), quote);
      });
    }

    if (cryptoQuery.data) {
      cryptoQuery.data.forEach((quote: CryptoQuote) => {
        cryptoQuoteMap.set(quote.symbol.toUpperCase(), quote);
      });
    }

    // Build items array in the same order as user's symbols array
    const result: WatchlistItem[] = [];
    symbols.forEach((originalKey) => {
      const { symbol, type } = parseSymbolKey(originalKey);
      const upperSymbol = symbol.toUpperCase();

      if (type === "crypto") {
        const quote = cryptoQuoteMap.get(upperSymbol);
        if (quote) {
          result.push({
            symbol: quote.symbol,
            originalKey,
            name: quote.name || quote.symbol,
            logoUrl: quote.logoUrl || `https://assets.coincap.io/assets/icons/${quote.symbol.toLowerCase()}@2x.png`,
            price: quote.price,
            type: "crypto",
            changePercentDay: quote.changePercent24h,
            changePercentWeek: quote.changePercent7d,
            changePercentMonth: quote.changePercent30d,
            changePercentYear: quote.changePercent1y,
            preMarketChangePercent: null,
            postMarketChangePercent: null,
            marketState: null,
            futuresSymbol: null,
          });
        }
      } else {
        const quote = stockQuoteMap.get(upperSymbol);
        if (quote) {
          result.push({
            symbol: quote.symbol,
            originalKey,
            name: quote.name || quote.symbol,
            logoUrl: quote.logoUrl || `https://assets.parqet.com/logos/symbol/${quote.symbol}?format=png`,
            price: quote.price,
            type: "stock",
            changePercentDay: quote.changePercent,
            changePercentWeek: quote.changePercentWeek,
            changePercentMonth: quote.changePercentMonth,
            changePercentYear: quote.changePercentYear,
            preMarketChangePercent: quote.preMarketChangePercent,
            postMarketChangePercent: quote.postMarketChangePercent,
            marketState: quote.marketState,
            futuresSymbol: quote.futuresSymbol,
          });
        }
      }
    });

    return result;
  }, [stocksQuery.data, cryptoQuery.data, symbols, parseSymbolKey]);

  // Apply sorting to items
  const sortedItems = useMemo(() => {
    if (!sortConfig) {
      return items; // No sort, return in original user order
    }

    const { field, direction } = sortConfig;
    const sorted = [...items].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (field === "symbol") {
        aVal = a.symbol;
        bVal = b.symbol;
      } else {
        aVal = a[field];
        bVal = b[field];
      }

      // Handle nulls - always push nulls to the bottom
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // String comparison for symbol
      if (field === "symbol") {
        const comparison = (aVal as string).localeCompare(bVal as string);
        return direction === "desc" ? -comparison : comparison;
      }

      // Numeric comparison for all other fields
      const comparison = (aVal as number) - (bVal as number);
      return direction === "desc" ? -comparison : comparison;
    });

    return sorted;
  }, [items, sortConfig]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Show empty state if no symbols configured (not an error)
  if (symbols.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <span className="text-2xl">📈</span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No tickers yet</p>
        <p className="text-xs text-muted-foreground">
          Click <span className="font-medium">+ Add</span> above to start tracking
        </p>
      </div>
    );
  }

  if (hasError && items.length === 0) {
    return (
      <ErrorDisplay
        error={stocksQuery.error || cryptoQuery.error}
        message="Unable to load watchlist data"
        onRetry={handleRetry}
        className="h-full"
        compact
      />
    );
  }

  const hasExtendedHours = items.some(
    (item) => item.preMarketChangePercent !== null || item.postMarketChangePercent !== null
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <span className="text-2xl">📈</span>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No tickers yet</p>
            <p className="text-xs text-muted-foreground">
              Click <span className="font-medium">+ Add</span> above to start tracking
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <table className="w-full text-xs min-w-[400px]">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-muted-foreground">
                  {onSymbolsChange && <th className="w-6"></th>}
                  <SortableHeader
                    field="symbol"
                    label="Symbol"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="left"
                  />
                  <SortableHeader
                    field="price"
                    label="Price"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    field="changePercentDay"
                    label="Day"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  {!isCompact && (
                    <>
                      <SortableHeader
                        field="changePercentWeek"
                        label="Week"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="changePercentMonth"
                        label="Month"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        field="changePercentYear"
                        label="Year"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </>
                  )}
                  {hasExtendedHours && !isCompact && (
                    <>
                      <th className="text-right py-1.5 px-1 font-medium">
                        <span className="flex items-center justify-end gap-0.5 cursor-help" title="Pre-market">
                          <Sun className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-right py-1.5 px-1 font-medium">
                        <span className="flex items-center justify-end gap-0.5 cursor-help" title="After-hours">
                          <Moon className="h-3 w-3" />
                        </span>
                      </th>
                    </>
                  )}
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => (
                  <WatchlistRow
                    key={item.originalKey}
                    item={item}
                    index={index}
                    isCompact={isCompact}
                    hasExtendedHours={hasExtendedHours}
                    onSymbolsChange={onSymbolsChange}
                    onOpenChart={onOpenChart}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onRemove={handleRemoveSymbol}
                    draggedIndex={draggedIndex}
                    dragOverIndex={dragOverIndex}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
});
