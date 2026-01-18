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
import { cn } from "@/lib/utils";

interface HoldingInfo {
  symbolKey: string;
  symbol: string;
  assetType: string;
  quantity: number;
  price: number;
  value: number;
}

interface ConfirmAccountInfo {
  name: string;
  holdings: HoldingInfo[];
  totalValue: number;
}

interface ConfirmSellAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountInfo: ConfirmAccountInfo | null;
  onConfirm: () => void;
}

export function ConfirmSellAccountDialog({
  open,
  onOpenChange,
  accountInfo,
  onConfirm,
}: ConfirmSellAccountDialogProps) {
  // Check if all holdings have prices loaded (no 0 prices)
  const holdingsWithMissingPrices = accountInfo?.holdings.filter((h) => h.price === 0) || [];
  const allPricesAvailable = holdingsWithMissingPrices.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell investments in {accountInfo?.name}?</DialogTitle>
          <DialogDescription>
            This account has holdings. All shares will be sold at current market
            prices before deleting.
          </DialogDescription>
        </DialogHeader>

        {accountInfo && (
          <div className="space-y-3 py-2">
            {accountInfo.holdings.map((holding) => {
              const hasPriceLoaded = holding.price > 0;
              return (
                <div
                  key={holding.symbolKey}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {holding.symbol}{" "}
                    <span
                      className={cn(
                        "text-[10px] px-1 py-0.5 rounded",
                        holding.assetType === "stock"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                      )}
                    >
                      {holding.assetType === "stock" ? "S" : "C"}
                    </span>{" "}
                    ({holding.quantity.toLocaleString()} @{" "}
                    <span className={hasPriceLoaded ? "" : "text-amber-500"}>
                      {hasPriceLoaded ? `$${holding.price.toFixed(2)}` : "loading..."}
                    </span>
                    )
                  </span>
                  <span className={hasPriceLoaded ? "font-medium" : "font-medium text-muted-foreground"}>
                    {hasPriceLoaded
                      ? `$${holding.value.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Total value:</span>
              <span className={allPricesAvailable ? "font-semibold text-emerald-500" : "font-semibold text-muted-foreground"}>
                {allPricesAvailable
                  ? `$${accountInfo.totalValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
              </span>
            </div>

            {/* Warning when some prices not available */}
            {!allPricesAvailable && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {holdingsWithMissingPrices.length === 1
                    ? `Price for ${holdingsWithMissingPrices[0].symbol} is still loading.`
                    : `Prices for ${holdingsWithMissingPrices.map((h) => h.symbol).join(", ")} are still loading.`}
                  {" "}Please wait before selling.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            No, keep account
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!allPricesAvailable}
          >
            Yes, sell all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
