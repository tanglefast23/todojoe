"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
}

export function AddExpenseModal({
  onAddExpense,
  onAddBulkExpenses,
}: AddExpenseModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("simple");

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
        setBulkError("No valid entries found. Use format: Name, Amount, Name, Amount, ...");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="mt-4">
            <form onSubmit={handleSimpleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Expense Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Coffee, Lunch, Groceries"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (VND)</label>
                <Input
                  type="text"
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
                  Format: Name, Amount, Name, Amount, ...
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Coffee, 50000, Lunch, 120000, Snacks, 30000"
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
 * Format: "Name, Amount, Name, Amount, ..."
 * or "Name, Amount\nName, Amount"
 */
function parseBulkInput(text: string): { name: string; amount: number }[] {
  // Normalize: replace newlines with commas, then split
  const normalized = text.replace(/\n/g, ",");
  const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);

  const entries: { name: string; amount: number }[] = [];

  for (let i = 0; i < parts.length - 1; i += 2) {
    const name = parts[i];
    const amountStr = parts[i + 1];

    if (!name || !amountStr) continue;

    // Parse amount (remove any non-numeric characters)
    const amount = parseInt(amountStr.replace(/[^0-9]/g, ""), 10);

    if (name.trim() && amount > 0) {
      entries.push({ name: name.trim(), amount });
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
