"use client";

import { Check, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVND } from "./BalanceDisplay";
import { formatRelativeTime } from "@/lib/formatters";
import type { Expense, ExpenseStatus } from "@/types/runningTab";
import { AttachmentUpload } from "./AttachmentUpload";

interface ExpenseItemProps {
  expense: Expense;
  creatorName?: string;
  approverName?: string;
  canApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAttachment: (id: string, url: string) => void;
}

const statusConfig: Record<
  ExpenseStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  pending: {
    label: "Pending",
    variant: "outline",
    className: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  },
  approved: {
    label: "Approved",
    variant: "default",
    className: "bg-green-500 hover:bg-green-600",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
  },
};

export function ExpenseItem({
  expense,
  creatorName,
  approverName,
  canApprove,
  onApprove,
  onReject,
  onAttachment,
}: ExpenseItemProps) {
  const config = statusConfig[expense.status];
  const isPending = expense.status === "pending";

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-sm truncate">{expense.name}</h4>
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        </div>

        <p className="text-lg font-semibold mt-1">{formatVND(expense.amount)}</p>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
          {creatorName && (
            <span>
              Created by <span className="font-medium">{creatorName}</span>
            </span>
          )}
          <span>{formatRelativeTime(expense.createdAt)}</span>
          {expense.status !== "pending" && approverName && (
            <>
              <span className="mx-1">|</span>
              <span>
                {expense.status === "approved" ? "Approved" : "Rejected"} by{" "}
                <span className="font-medium">{approverName}</span>
              </span>
            </>
          )}
        </div>

        {/* Attachment Preview */}
        {expense.attachmentUrl && (
          <div className="mt-3">
            <a
              href={expense.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ImageIcon className="h-4 w-4" />
              View Attachment
            </a>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Attachment button - only for pending expenses */}
        {isPending && !expense.attachmentUrl && (
          <AttachmentUpload
            expenseId={expense.id}
            onUpload={(url) => onAttachment(expense.id, url)}
          />
        )}

        {/* Approve/Reject buttons - only for pending and authorized users */}
        {isPending && canApprove && (
          <>
            <Button
              variant="outline"
              size="icon-sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={() => onApprove(expense.id)}
              title="Approve expense"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Approve</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => onReject(expense.id)}
              title="Reject expense"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Reject</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
