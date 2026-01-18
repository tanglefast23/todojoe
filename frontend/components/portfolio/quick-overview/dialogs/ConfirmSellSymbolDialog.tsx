"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmSymbolInfo {
  symbol: string;
  assetType: string;
  totalShares: number;
  currentPrice: number;
  totalValue: number;
}

interface ConfirmSellSymbolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbolInfo: ConfirmSymbolInfo | null;
  onConfirm: () => void;
}

export function ConfirmSellSymbolDialog({
  open,
  onOpenChange,
  symbolInfo,
  onConfirm,
}: ConfirmSellSymbolDialogProps) {
  // Check if price is available (not 0)
  const isPriceAvailable = symbolInfo && symbolInfo.currentPrice > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Sell {symbolInfo?.symbol} ({symbolInfo?.assetType}) shares?
          </DialogTitle>
          <DialogDescription>
            This will automatically sell all your shares at the current market price.
          </DialogDescription>
        </DialogHeader>

        {symbolInfo && (
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total shares:</span>
              <span className="font-medium">
                {symbolInfo.totalShares.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current price:</span>
              <span className={isPriceAvailable ? "font-medium" : "font-medium text-amber-500"}>
                {isPriceAvailable ? `$${symbolInfo.currentPrice.toFixed(2)}` : "Loading..."}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Total value:</span>
              <span className={isPriceAvailable ? "font-semibold text-emerald-500" : "font-semibold text-muted-foreground"}>
                {isPriceAvailable
                  ? `$${symbolInfo.totalValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
              </span>
            </div>

            {/* Warning when price not available */}
            {!isPriceAvailable && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Price is still loading. Please wait before selling.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            No, keep shares
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!isPriceAvailable}
          >
            Yes, sell all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
