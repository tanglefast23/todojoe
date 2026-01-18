"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, Shield, ShieldCheck, Globe } from "lucide-react";
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
import { useOwnerStore } from "@/stores/ownerStore";
import { usePortfolioStore } from "@/stores/portfolioStore";

interface AssignOwnerDialogProps {
  portfolioId: string;
  portfolioName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignOwnerDialog({
  portfolioId,
  portfolioName,
  open,
  onOpenChange,
}: AssignOwnerDialogProps) {
  const owners = useOwnerStore((state) => state.owners);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const setPortfolioOwners = usePortfolioStore((state) => state.setPortfolioOwners);

  // Get current owners for this portfolio
  const portfolio = portfolios.find((p) => p.id === portfolioId);
  const currentOwnerIds = portfolio?.ownerIds || [];

  // Local state for selected owners (supports multi-select)
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>(currentOwnerIds);

  // Reset selection when dialog opens or portfolio changes
  useEffect(() => {
    if (open) {
      setSelectedOwnerIds(currentOwnerIds);
    }
  }, [open, currentOwnerIds]);

  const toggleOwner = useCallback((ownerId: string) => {
    setSelectedOwnerIds((prev) => {
      if (prev.includes(ownerId)) {
        return prev.filter((id) => id !== ownerId);
      } else {
        return [...prev, ownerId];
      }
    });
  }, []);

  const handleSave = useCallback(() => {
    setPortfolioOwners(portfolioId, selectedOwnerIds);
    onOpenChange(false);
  }, [portfolioId, selectedOwnerIds, setPortfolioOwners, onOpenChange]);

  const handleMakePublic = useCallback(() => {
    setSelectedOwnerIds([]);
  }, []);

  const isPublic = selectedOwnerIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Assign Owners to &ldquo;{portfolioName}&rdquo;</DialogTitle>
          <DialogDescription>
            Select which owners can access this portfolio. Multiple owners can share access.
            Public portfolios are visible to everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Public Option */}
          <button
            onClick={handleMakePublic}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
              isPublic
                ? "bg-primary/10 border-primary"
                : "hover:bg-muted/50 border-transparent"
            )}
          >
            <Globe className={cn("h-5 w-5", isPublic ? "text-primary" : "text-muted-foreground")} />
            <div className="flex-1">
              <p className={cn("font-medium", isPublic && "text-primary")}>Public</p>
              <p className="text-xs text-muted-foreground">
                No password required - visible to everyone
              </p>
            </div>
            {isPublic && <Check className="h-5 w-5 text-primary" />}
          </button>

          {/* Divider */}
          {owners.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or assign to owners
                </span>
              </div>
            </div>
          )}

          {/* Owner List */}
          {owners.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No owner profiles created yet.</p>
              <p className="text-xs">Go to Settings to create owners.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {owners.map((owner) => {
                const isSelected = selectedOwnerIds.includes(owner.id);

                return (
                  <button
                    key={owner.id}
                    onClick={() => toggleOwner(owner.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50 border-transparent"
                    )}
                  >
                    {owner.isMaster ? (
                      <ShieldCheck className={cn("h-5 w-5", isSelected ? "text-amber-500" : "text-muted-foreground")} />
                    ) : (
                      <Shield className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("font-medium", isSelected && "text-primary")}>
                          {owner.name}
                        </p>
                        {owner.isMaster && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            Master
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {owner.isMaster ? "Can see all portfolios when unlocked" : "Password required to access"}
                      </p>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selection Summary */}
          {selectedOwnerIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedOwnerIds.length} owner{selectedOwnerIds.length !== 1 ? "s" : ""} selected
              {selectedOwnerIds.length > 1 && " - any can unlock this portfolio"}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
