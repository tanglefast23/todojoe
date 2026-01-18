"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AddAccountPopoverProps {
  onAddAccount: (name: string) => void;
  defaultAccountNumber: number;
}

export function AddAccountPopover({
  onAddAccount,
  defaultAccountNumber,
}: AddAccountPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  const handleAddAccount = () => {
    const name = newAccountName.trim() || `Account ${defaultAccountNumber}`;
    onAddAccount(name);
    setNewAccountName("");
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setNewAccountName("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs transition-colors",
            isOpen &&
              "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
          )}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Accounts
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium">Account Name</p>
          <Input
            placeholder="e.g. TFSA, RRSP, Margin"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                handleAddAccount();
              }
            }}
            className="h-7 text-xs"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">
            Press Enter or Tab to add
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
