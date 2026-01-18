"use client";

import { useState, useRef } from "react";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddExpenseModalProps {
  onAddExpense: (name: string, amount: number) => void;
  onAddBulkExpenses: (entries: { name: string; amount: number }[]) => void;
  onTopUp: (amount: number, description: string) => void;
}

export function AddExpenseModal({
  onAddExpense,
  onAddBulkExpenses,
  onTopUp,
}: AddExpenseModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("simple");

  // Refs for keyboard navigation
  const nameInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const bulkTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Simple form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  // Bulk form state
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setAmount("");
    setBulkText("");
    setBulkError(null);
    setActiveTab("simple");
  };

  const handleSimpleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (name.trim() && numAmount > 0) {
      onAddExpense(name.trim(), numAmount);
      resetForm();
      setOpen(false);
    }
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);

    try {
      const entries = parseBulkInput(bulkText);
      if (entries.length === 0) {
        setBulkError("No valid entries found. Use format: name amount, name amount, ...");
        return;
      }
      onAddBulkExpenses(entries);
      resetForm();
      setOpen(false);
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Failed to parse bulk input"
      );
    }
  };

  // Format amount input as user types
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value) {
      const num = parseInt(value, 10);
      setAmount(num.toLocaleString("vi-VN"));
    } else {
      setAmount("");
    }
  };

  // Handle Enter key on name field - move to amount field
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      amountInputRef.current?.focus();
    }
  };

  // Focus name input when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        if (activeTab === "simple") {
          nameInputRef.current?.focus();
        } else {
          bulkTextareaRef.current?.focus();
        }
      }, 50);
    }
  };

  // Handle tab change - focus appropriate input
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      if (tab === "simple") {
        nameInputRef.current?.focus();
      } else {
        bulkTextareaRef.current?.focus();
      }
    }, 50);
  };

  // Handle Enter key on bulk textarea - submit form
  const handleBulkKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const entries = parseBulkInputSafe(bulkText);
      if (entries.length > 0) {
        onAddBulkExpenses(entries);
        resetForm();
        setOpen(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Add a new expense to the running tab. It will need approval before
            being deducted.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="mt-4">
            {/* Quick Top-Up */}
            <div className="mb-4 pb-4 border-b">
              <p className="text-xs text-muted-foreground mb-2">Quick Top-Up</p>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3 bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600 dark:text-green-400"
                onClick={() => {
                  onTopUp(5000000, "Kia 5 mil Reload");
                  resetForm();
                  setOpen(false);
                }}
              >
                <Zap className="h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Kia 5 mil Reload</span>
                  <span className="text-xs opacity-70">+5,000,000 VND</span>
                </div>
              </Button>
            </div>

            <form onSubmit={handleSimpleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Expense Name</label>
                <Input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="e.g., Coffee, Lunch, Groceries"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (VND)</label>
                <Input
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="50,000"
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim() || !amount}>
                  Add Expense
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Bulk Entry</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Format: name amount, name amount, ...
                </p>
                <textarea
                  ref={bulkTextareaRef}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  onKeyDown={handleBulkKeyDown}
                  placeholder="coffee 50000, lunch 120000, snacks 30000"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                {bulkError && (
                  <p className="text-sm text-destructive mt-1">{bulkError}</p>
                )}
              </div>
              <BulkPreview text={bulkText} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!bulkText.trim()}>
                  Add All
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Parse bulk input text into expense entries.
 * Smart format: "name amount, name amount, ..."
 * The amount is detected as the first number sequence in each item.
 * Examples:
 *   "coffee 50000, lunch 100000" → 2 items
 *   "coffee50000, lunch100000" → 2 items (no space needed)
 *   "gas station 75000" → name: "gas station", amount: 75000
 */
function parseBulkInput(text: string): { name: string; amount: number }[] {
  // Normalize: replace newlines with commas, then split by comma
  const normalized = text.replace(/\n/g, ",");
  const items = normalized.split(",").map((p) => p.trim()).filter(Boolean);

  const entries: { name: string; amount: number }[] = [];

  for (const item of items) {
    // Find where the number starts (the amount)
    // Match: any text followed by a number sequence at the end
    const match = item.match(/^(.+?)[\s]*(\d[\d\s.,]*)$/);

    if (match) {
      const name = match[1].trim();
      // Remove any non-numeric characters from the amount (spaces, dots, commas)
      const amountStr = match[2].replace(/[^0-9]/g, "");
      const amount = parseInt(amountStr, 10);

      if (name && amount > 0) {
        entries.push({ name, amount });
      }
    }
  }

  return entries;
}

/**
 * Preview component showing parsed bulk entries
 */
function BulkPreview({ text }: { text: string }) {
  if (!text.trim()) return null;

  // Parse outside of JSX to avoid try/catch lint issues
  const entries = parseBulkInputSafe(text);
  if (entries.length === 0) return null;

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Preview ({entries.length} items)
      </p>
      <ul className="space-y-1 text-sm">
        {entries.slice(0, 5).map((entry, idx) => (
          <li key={idx} className="flex justify-between">
            <span>{entry.name}</span>
            <span className="font-mono">
              {entry.amount.toLocaleString("vi-VN")}
            </span>
          </li>
        ))}
        {entries.length > 5 && (
          <li className="text-muted-foreground">
            ...and {entries.length - 5} more
          </li>
        )}
      </ul>
      <div className="mt-2 pt-2 border-t flex justify-between font-medium">
        <span>Total</span>
        <span className="font-mono">{total.toLocaleString("vi-VN")} VND</span>
      </div>
    </div>
  );
}

/**
 * Safe version of parseBulkInput that returns empty array on error
 */
function parseBulkInputSafe(text: string): { name: string; amount: number }[] {
  try {
    return parseBulkInput(text);
  } catch {
    return [];
  }
}
