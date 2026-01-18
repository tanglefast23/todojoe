"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Sheet content */
  children: ReactNode;
  /** Show success overlay with message */
  successMessage?: string | null;
  /** Additional class names for the sheet container */
  className?: string;
}

/**
 * Reusable mobile bottom sheet component with iOS-style design
 *
 * Features:
 * - Backdrop with blur effect
 * - Rounded top corners with drag handle
 * - Close button
 * - Success overlay animation
 * - Slide-up animation
 * - Safe area padding for iPhone home indicator
 */
export function MobileBottomSheet({
  isOpen,
  onClose,
  children,
  successMessage,
  className,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full bg-background rounded-t-3xl p-6 pb-10",
          "animate-in slide-in-from-bottom duration-200",
          "safe-area-pb",
          className
        )}
      >
        {/* Drag Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/30" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Success Overlay */}
        {successMessage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 rounded-t-3xl">
            <div className="flex flex-col items-center gap-3 animate-in zoom-in-50 duration-200">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-lg font-semibold">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * Header component for use inside MobileBottomSheet
 */
interface SheetHeaderProps {
  icon: ReactNode;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
}

export function MobileSheetHeader({
  icon,
  iconClassName,
  title,
  subtitle,
  rightContent,
}: SheetHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div
        className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center",
          iconClassName
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {rightContent}
    </div>
  );
}

/**
 * Asset type selector component for stock/crypto selection
 */
interface AssetTypeSelectorProps {
  value: "auto" | "stock" | "crypto";
  onChange: (value: "auto" | "stock" | "crypto") => void;
  label?: string;
}

export function AssetTypeSelector({
  value,
  onChange,
  label = "Asset Type",
}: AssetTypeSelectorProps) {
  const options: Array<"auto" | "stock" | "crypto"> = ["auto", "stock", "crypto"];

  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-muted-foreground mb-2 block">
        {label}
      </label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "h-11 rounded-xl font-medium text-sm transition-all capitalize",
              value === option
                ? option === "auto"
                  ? "bg-primary text-primary-foreground"
                  : option === "stock"
                  ? "bg-blue-500 text-white"
                  : "bg-orange-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {option === "auto" ? "Auto" : option === "stock" ? "Stock" : "Crypto"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Total preview component for displaying transaction totals
 */
interface TotalPreviewProps {
  total: number;
  formatCurrency: (value: number) => string;
  label?: string;
}

export function TotalPreview({
  total,
  formatCurrency,
  label = "Total",
}: TotalPreviewProps) {
  if (total <= 0) return null;

  return (
    <div className="rounded-xl bg-muted/50 p-4 mb-5 border border-border/50">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
