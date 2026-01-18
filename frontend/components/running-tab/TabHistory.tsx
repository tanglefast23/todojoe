"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatVND } from "./BalanceDisplay";
import { formatDateTime } from "@/lib/formatters";
import type { TabHistoryEntry, TabHistoryType } from "@/types/runningTab";

interface TabHistoryProps {
  history: TabHistoryEntry[];
  owners: { id: string; name: string }[];
}

const historyTypeConfig: Record<
  TabHistoryType,
  { label: string; colorClass: string }
> = {
  initial: { label: "Initial Balance", colorClass: "text-blue-500" },
  add: { label: "Balance Added", colorClass: "text-green-500" },
  expense_approved: { label: "Expense Approved", colorClass: "text-red-500" },
  expense_rejected: { label: "Expense Rejected", colorClass: "text-muted-foreground" },
};

export function TabHistory({ history, owners }: TabHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const enrichedHistory = useMemo(() => {
    const ownerMap = new Map(owners.map((o) => [o.id, o.name]));
    return history.map((entry) => ({
      ...entry,
      creatorName: entry.createdBy ? ownerMap.get(entry.createdBy) : undefined,
    }));
  }, [history, owners]);

  if (history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Balance History</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-1" />
                Show ({history.length})
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Audit log of all balance changes
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="space-y-3">
            {enrichedHistory.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface HistoryItemProps {
  entry: TabHistoryEntry & { creatorName?: string };
}

function HistoryItem({ entry }: HistoryItemProps) {
  const config = historyTypeConfig[entry.type];
  const isPositive = entry.amount > 0;
  const isNeutral = entry.amount === 0;

  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", config.colorClass)}>
            {config.label}
          </span>
        </div>
        {entry.description && (
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {entry.creatorName && (
            <span>
              By <span className="font-medium">{entry.creatorName}</span>
            </span>
          )}
          <span>{formatDateTime(entry.createdAt)}</span>
        </div>
      </div>
      <div
        className={cn(
          "font-mono text-sm font-medium",
          isNeutral
            ? "text-muted-foreground"
            : isPositive
              ? "text-green-500"
              : "text-red-500"
        )}
      >
        {isPositive ? "+" : ""}
        {formatVND(entry.amount)}
      </div>
    </div>
  );
}
