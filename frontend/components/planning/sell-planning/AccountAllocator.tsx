"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningAccountAllocation } from "@/hooks/useSellPlanFlow";

interface AccountAllocatorProps {
  selectedSymbol: string;
  percentageInput: string;
  accountAllocations: PlanningAccountAllocation[];
  neededShares: number;
  totalAllocated: number;
  remaining: number;
  error: string | null;
  onAllocationChange: (accountId: string, value: string) => void;
  onAutoFill: (accountId: string) => void;
  onAllocationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, accountId: string) => void;
  onAccountsConfirm: () => void;
  onCancel: () => void;
  formatShares: (shares: number, symbol: string) => string;
  isCrypto: (symbol: string) => boolean;
}

export function AccountAllocator({
  selectedSymbol,
  percentageInput,
  accountAllocations,
  neededShares,
  totalAllocated,
  remaining,
  error,
  onAllocationChange,
  onAutoFill,
  onAllocationKeyDown,
  onAccountsConfirm,
  onCancel,
  formatShares,
  isCrypto,
}: AccountAllocatorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
          <Check className="h-3 w-3" />
        </span>
        <span className="font-medium">{selectedSymbol}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
          <Check className="h-3 w-3" />
        </span>
        <span>{percentageInput}%</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          3
        </span>
        Select accounts
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Shares needed</span>
          <span className="font-bold text-lg">{formatShares(neededShares, selectedSymbol)}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm text-muted-foreground">Allocated</span>
          <span
            className={cn(
              "font-medium",
              remaining > 0.01 ? "text-amber-500" : "text-emerald-500"
            )}
          >
            {formatShares(totalAllocated, selectedSymbol)} /{" "}
            {formatShares(neededShares, selectedSymbol)}
          </span>
        </div>
        {remaining > 0.01 && (
          <div className="text-sm text-amber-500 mt-2">
            Still need {formatShares(remaining, selectedSymbol)} more shares
          </div>
        )}
      </div>

      <div className="space-y-3">
        {accountAllocations.map((allocation) => (
          <div
            key={allocation.accountId}
            className="flex items-center gap-4 p-3 border rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium">{allocation.accountName}</div>
              <div className="text-sm text-muted-foreground">
                Available: {formatShares(allocation.available, selectedSymbol)} shares
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max={allocation.available}
                step={isCrypto(selectedSymbol) ? "0.01" : "1"}
                value={allocation.toSell || ""}
                onChange={(e) => onAllocationChange(allocation.accountId, e.target.value)}
                onKeyDown={(e) => onAllocationKeyDown(e, allocation.accountId)}
                className="w-24 text-right"
                placeholder="0"
              />
              {remaining > 0.01 && allocation.toSell < allocation.available && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAutoFill(allocation.accountId)}
                >
                  Fill
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onAccountsConfirm} disabled={remaining > 0.01}>
          Continue
        </Button>
      </div>
    </div>
  );
}
