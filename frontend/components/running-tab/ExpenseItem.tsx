"use client";

import { useState } from "react";
import { Check, X, FileText, ExternalLink } from "lucide-react";
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
  itemNumber?: number;
  showNumber?: boolean;
}

// Rainbow gradient colors for item numbers
const NUMBER_COLORS = [
  "from-pink-500 to-rose-500",
  "from-orange-500 to-amber-500",
  "from-yellow-500 to-lime-500",
  "from-green-500 to-emerald-500",
  "from-teal-500 to-cyan-500",
  "from-blue-500 to-indigo-500",
  "from-violet-500 to-purple-500",
  "from-fuchsia-500 to-pink-500",
];

// Icon can be either an emoji string or cat image info
type ExpenseIcon =
  | { type: "emoji"; value: string }
  | { type: "cat"; cat: "ivory" | "tom" | "both" }
  | null;

// Get icon/emoji for expense based on name
function getExpenseIcon(name: string): ExpenseIcon {
  const lowerName = name.toLowerCase();

  // Cat-related expenses - use actual cat photos
  if (lowerName.includes("tom and ivory") || lowerName.includes("both")) {
    return { type: "cat", cat: "both" };
  }
  if (lowerName.includes("ivory")) {
    return { type: "cat", cat: "ivory" };
  }
  if (lowerName.includes("tom")) {
    return { type: "cat", cat: "tom" };
  }

  // Kia Top Up - white minivan
  if (lowerName.includes("kia")) {
    return { type: "emoji", value: "🚐" };
  }

  // Quick shortcut expenses
  if (lowerName.includes("groceries") || lowerName.includes("grocery")) {
    return { type: "emoji", value: "🛒" };
  }
  if (lowerName.includes("gas") || lowerName.includes("fuel") || lowerName.includes("petrol")) {
    return { type: "emoji", value: "⛽" };
  }
  if (lowerName.includes("bubble tea") || lowerName.includes("boba")) {
    return { type: "emoji", value: "🧋" };
  }
  if (lowerName.includes("coffee") || lowerName.includes("café") || lowerName.includes("cafe")) {
    return { type: "emoji", value: "☕" };
  }
  if (lowerName.includes("many drinks")) {
    return { type: "emoji", value: "🍹🍸🍺" };
  }
  if (lowerName.includes("drinks") || lowerName.includes("cocktail") || lowerName.includes("alcohol")) {
    return { type: "emoji", value: "🍹" };
  }
  if (lowerName.includes("food") || lowerName.includes("lunch") || lowerName.includes("dinner") || lowerName.includes("breakfast")) {
    return { type: "emoji", value: "🍜" };
  }
  if (lowerName.includes("parking") || lowerName.includes("park")) {
    return { type: "emoji", value: "🅿️" };
  }

  // Vet (from cat expenses)
  if (lowerName.includes("vet")) {
    return { type: "emoji", value: "💉" };
  }
  // Grooming (from cat expenses)
  if (lowerName.includes("grooming") || lowerName.includes("groom")) {
    return { type: "emoji", value: "✂️" };
  }

  return null;
}

// Component to render expense icon (emoji or cat image)
function ExpenseIconDisplay({ icon }: { icon: ExpenseIcon }) {
  if (!icon) return null;

  if (icon.type === "emoji") {
    return (
      <span className="text-lg" role="img" aria-label="expense icon">
        {icon.value}
      </span>
    );
  }

  if (icon.type === "cat") {
    if (icon.cat === "both") {
      return (
        <div className="flex -space-x-1">
          <img src="/ivory.PNG" alt="Ivory" className="w-6 h-7 rounded object-contain" />
          <img src="/tom.png" alt="Tom" className="w-6 h-7 rounded object-contain" />
        </div>
      );
    }
    const imgSrc = icon.cat === "ivory" ? "/ivory.PNG" : "/tom.png";
    const altText = icon.cat === "ivory" ? "Ivory" : "Tom";
    return (
      <img src={imgSrc} alt={altText} className="w-7 h-8 rounded object-contain" />
    );
  }

  return null;
}

const statusConfig: Record<
  ExpenseStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  pending: {
    label: "Pending",
    variant: "outline",
    className: "border-amber-400 text-amber-500 bg-amber-500/10",
  },
  approved: {
    label: "Approved",
    variant: "default",
    className: "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    className: "bg-gradient-to-r from-red-500 to-rose-500 text-white border-0",
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
  itemNumber,
  showNumber = false,
}: ExpenseItemProps) {
  const [imageError, setImageError] = useState(false);
  const config = statusConfig[expense.status];
  const isPending = expense.status === "pending";
  const numberColor = itemNumber ? NUMBER_COLORS[(itemNumber - 1) % NUMBER_COLORS.length] : NUMBER_COLORS[0];
  const expenseIcon = getExpenseIcon(expense.name);

  // Check if attachment is a PDF
  const isPdf = expense.attachmentUrl?.toLowerCase().includes(".pdf");

  // Get card style based on status
  const getCardStyle = () => {
    switch (expense.status) {
      case "approved":
        return "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-400/40";
      case "rejected":
        return "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-400/40";
      default:
        return "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-400/40";
    }
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border-2 ${getCardStyle()}`}>
      {/* Item Number */}
      {showNumber && itemNumber && (
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${numberColor} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
        >
          {itemNumber}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ExpenseIconDisplay icon={expenseIcon} />
          <h4 className="font-medium text-sm truncate">{expense.name}</h4>
          {/* Only show status badge for non-pending expenses */}
          {expense.status !== "pending" && (
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          )}
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

        {/* Rejection Reason - only for rejected expenses */}
        {expense.status === "rejected" && expense.rejectionReason && (
          <div className="mt-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">Reason:</span> {expense.rejectionReason}
            </p>
          </div>
        )}

        {/* Attachment Thumbnail */}
        {expense.attachmentUrl && (
          <div className="mt-3">
            <a
              href={expense.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-block"
            >
              {isPdf || imageError ? (
                // PDF or failed image - show icon with link
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-primary">
                      {isPdf ? "PDF Document" : "Attachment"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Tap to view <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ) : (
                // Image - show thumbnail
                <div className="relative overflow-hidden rounded-lg border-2 border-primary/20 hover:border-primary/40 transition-colors">
                  <img
                    src={expense.attachmentUrl}
                    alt="Expense attachment"
                    className="w-20 h-20 object-cover group-hover:scale-105 transition-transform"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              )}
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
              className="h-9 w-9 p-0 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-500/20 border-green-500/50"
              onClick={() => onApprove(expense.id)}
              title="Approve expense"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Approve</span>
            </Button>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-500/20 border-red-500/50"
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
