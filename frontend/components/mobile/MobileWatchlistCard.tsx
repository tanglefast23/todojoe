"use client";

import { memo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";
import { formatPercent } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { playLongPressSound, playSuccessSound, playCancelSound } from "@/lib/audio";

export interface MobileWatchlistItem {
  symbol: string;
  name: string;
  price: number;
  type: "stock" | "crypto";
  changePercent1h: number | null;
  changePercentDay: number;
  changePercentWeek: number | null;
  changePercentMonth: number | null;
  changePercentYear: number | null;
  preMarketChangePercent: number | null;
  postMarketChangePercent: number | null;
  logoUrl: string | null;
}

interface MobileWatchlistCardProps {
  item: MobileWatchlistItem;
  isCompact?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onMoveStart?: () => void;
  isReordering?: boolean;
}

/** Helper to format percent change with label or icon */
function PercentBadge({
  value,
  label,
  icon
}: {
  value: number | null;
  label?: string;
  icon?: "sun" | "moon";
}) {
  const isPositive = value !== null ? value >= 0 : true;

  return (
    <span className="flex items-center gap-1">
      {value !== null ? (
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {formatPercent(value)}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground/50">—</span>
      )}
      {icon === "sun" && <Sun className="h-3 w-3 text-amber-500" />}
      {icon === "moon" && <Moon className="h-3 w-3 text-indigo-400" />}
      {label && <span className="text-xs text-muted-foreground font-normal">{label}</span>}
    </span>
  );
}

/** Long-press duration in milliseconds */
const LONG_PRESS_DURATION = 500;
/** Maximum movement threshold before canceling long-press */
const MOVE_THRESHOLD = 10;

/** Compact single-row watchlist item for mobile view with long-press delete */
export const MobileWatchlistCard = memo(function MobileWatchlistCard({
  item,
  isCompact = false,
  onClick,
  onDelete,
  onMoveStart,
  isReordering = false,
}: MobileWatchlistCardProps) {
  const { formatCurrency } = useFormatters();
  const [imgError, setImgError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs for long-press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const didTriggerLongPress = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    didTriggerLongPress.current = false;
    setIsLongPressing(true);

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      // Long-press triggered!
      didTriggerLongPress.current = true;
      setIsLongPressing(false);

      // Play sound and haptic feedback
      playLongPressSound();
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Show confirmation dialog
      setShowDeleteConfirm(true);
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;

    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

    // Cancel long-press if finger moved too much
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    touchStartPos.current = null;
  }, [clearLongPressTimer]);

  const handleCardClick = useCallback(() => {
    // Don't trigger click if long-press was triggered
    if (didTriggerLongPress.current) {
      didTriggerLongPress.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    playSuccessSound();

    // Delay delete to allow animation
    setTimeout(() => {
      onDelete?.();
    }, 200);
  }, [onDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    playCancelSound();
  }, []);

  const cardContent = isCompact ? (
    <div className="flex items-center gap-2">
      {/* Symbol + Name combined */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="font-bold text-lg">{item.symbol}</span>
        <span className="text-muted-foreground text-sm truncate">{item.name}</span>
      </div>

      {/* Price - Large */}
      <span className="font-bold text-xl tabular-nums flex-shrink-0">
        {formatCurrency(item.price, 0, 0)}
      </span>

      {/* Available percent changes - only show if has data */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {item.changePercent1h !== null && (
          <span
            className={cn(
              "text-base font-semibold tabular-nums",
              item.changePercent1h >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {formatPercent(item.changePercent1h)}
          </span>
        )}
        {item.changePercentDay !== null && item.changePercent1h === null && (
          <span
            className={cn(
              "text-base font-semibold tabular-nums",
              item.changePercentDay >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {formatPercent(item.changePercentDay)}
          </span>
        )}
        {item.preMarketChangePercent !== null && (
          <span className="flex items-center gap-0.5">
            <Sun className="h-3 w-3 text-amber-500" />
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                item.preMarketChangePercent >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {formatPercent(item.preMarketChangePercent)}
            </span>
          </span>
        )}
        {item.postMarketChangePercent !== null && (
          <span className="flex items-center gap-0.5">
            <Moon className="h-3 w-3 text-indigo-400" />
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                item.postMarketChangePercent >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {formatPercent(item.postMarketChangePercent)}
            </span>
          </span>
        )}
      </div>
    </div>
  ) : (
    <>
      {/* Row 1: Logo, Symbol, Badge, Price */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          {item.logoUrl && !imgError ? (
            <Image
              src={item.logoUrl}
              alt={item.symbol}
              fill
              className="object-contain p-1"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
              {item.symbol.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Symbol + Badge */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-base truncate">{item.symbol}</span>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              item.type === "crypto"
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            )}
          >
            {item.type === "crypto" ? "C" : "S"}
          </span>
        </div>

        {/* Price */}
        <span className="font-bold text-lg tabular-nums">
          {formatCurrency(item.price, 0, 0)}
        </span>
      </div>

      {/* Row 2: All percent changes with icons */}
      <div className="flex items-center gap-4 mt-2 pl-[52px]">
        <PercentBadge value={item.changePercent1h} label="1h" />
        <PercentBadge value={item.changePercentDay} label="1d" />
        <PercentBadge value={item.preMarketChangePercent} icon="sun" />
        <PercentBadge value={item.postMarketChangePercent} icon="moon" />
      </div>
    </>
  );

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg",
          isReordering && "ring-2 ring-primary"
        )}
      >
        {/* Card content */}
        <div
          onClick={handleCardClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={cn(
            "relative bg-background select-none touch-manipulation",
            isCompact
              ? "px-2 py-1 rounded-lg bg-card border border-border/30 hover:bg-muted/50 active:bg-muted text-left"
              : "p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 active:bg-muted text-left",
            isDeleting && "opacity-0 scale-95 transition-all duration-200",
            isLongPressing && "scale-[0.98] transition-transform duration-100"
          )}
        >
          {cardContent}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) handleCancelDelete();
        }}
        title="Delete from Watchlist"
        description={`Remove ${item.symbol} from all your watchlists?`}
        confirmLabel="Yes, Delete"
        cancelLabel="No"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});
