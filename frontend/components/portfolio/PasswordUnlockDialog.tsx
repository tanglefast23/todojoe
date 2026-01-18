"use client";

import { useState, useCallback, useMemo } from "react";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOwnerStore } from "@/stores/ownerStore";
import { cn } from "@/lib/utils";

interface PasswordUnlockDialogProps {
  ownerId: string;
  ownerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PasswordUnlockDialog({
  ownerId,
  ownerName,
  open,
  onOpenChange,
  onSuccess,
}: PasswordUnlockDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(ownerId);

  const owners = useOwnerStore((state) => state.owners);
  const unlockOwner = useOwnerStore((state) => state.unlockOwner);

  // Get master owners that could be used to unlock
  const masterOwners = useMemo(() => {
    return owners.filter((o) => o.isMaster && o.id !== ownerId);
  }, [owners, ownerId]);

  // Reset selected owner when dialog opens with new owner
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setPassword("");
      setError(null);
      setShowPassword(false);
    } else {
      // Reset to the suggested owner when opening
      setSelectedOwnerId(ownerId);
    }
    onOpenChange(newOpen);
  }, [onOpenChange, ownerId]);

  const selectedOwner = useMemo(() => {
    return owners.find((o) => o.id === selectedOwnerId);
  }, [owners, selectedOwnerId]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await unlockOwner(selectedOwnerId, password);
      if (success) {
        setPassword("");
        setError(null);
        onSuccess();
        onOpenChange(false);
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [password, selectedOwnerId, unlockOwner, onSuccess, onOpenChange]);

  const hasMasterOption = masterOwners.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Unlock Portfolio
          </DialogTitle>
          <DialogDescription>
            Enter a password to unlock this portfolio.
            {hasMasterOption && " You can use the portfolio owner's password or a master account."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            {/* Owner selector - only show if there are master accounts */}
            {hasMasterOption && (
              <div className="space-y-2">
                <Label htmlFor="unlock-owner">Unlock as</Label>
                <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                  <SelectTrigger id="unlock-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* The assigned owner */}
                    <SelectItem value={ownerId}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>{ownerName}</span>
                        <span className="text-xs text-muted-foreground">(assigned)</span>
                      </div>
                    </SelectItem>
                    {/* Master owners */}
                    {masterOwners.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-amber-500" />
                          <span>{master.name}</span>
                          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            Master
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {selectedOwner?.isMaster ? (
                  <span className="flex items-center gap-1">
                    Master Password
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                ) : (
                  `${selectedOwner?.name || ownerName}'s Password`
                )}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter password"
                  autoFocus
                  disabled={isLoading}
                  className={cn(error && "border-destructive")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {selectedOwner?.isMaster && (
                <p className="text-xs text-muted-foreground">
                  Master accounts can unlock all portfolios
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlocking...
                </>
              ) : (
                "Unlock"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
