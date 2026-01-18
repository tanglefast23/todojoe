"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function OwnerManagement() {
  const {
    owners,
    addOwner,
    removeOwner,
    updateOwnerName,
    setOwnerMaster,
    changeOwnerPassword,
    isOwnerUnlocked,
    unlockOwner,
    lockOwner,
    lockAllOwners,
    checkRateLimit,
  } = useOwnerStore();

  const portfolios = usePortfolioStore((state) => state.portfolios);
  const addOwnerToPortfolio = usePortfolioStore((state) => state.addOwnerToPortfolio);
  const removeOwnerFromPortfolio = usePortfolioStore((state) => state.removeOwnerFromPortfolio);

  // Add owner dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerConfirmPassword, setNewOwnerConfirmPassword] = useState("");
  const [newOwnerIsMaster, setNewOwnerIsMaster] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Change password dialog state
  const [changePasswordOwner, setChangePasswordOwner] = useState<{ id: string; name: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPasswordChange, setShowNewPasswordChange] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOwner, setDeleteConfirmOwner] = useState<{ id: string; name: string } | null>(null);

  // Edit name state
  const [editingOwner, setEditingOwner] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");

  // Unlock owner dialog state
  const [unlockOwnerTarget, setUnlockOwnerTarget] = useState<{ id: string; name: string } | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const handleAddOwner = useCallback(async () => {
    if (!newOwnerName.trim()) {
      setAddError("Please enter a name");
      return;
    }
    if (!newOwnerPassword) {
      setAddError("Please enter a password");
      return;
    }
    if (newOwnerPassword !== newOwnerConfirmPassword) {
      setAddError("Passwords do not match");
      return;
    }
    if (newOwnerPassword.length < 4) {
      setAddError("Password must be at least 4 characters");
      return;
    }

    await addOwner(newOwnerName.trim(), newOwnerPassword, newOwnerIsMaster);

    // Reset form
    setNewOwnerName("");
    setNewOwnerPassword("");
    setNewOwnerConfirmPassword("");
    setNewOwnerIsMaster(false);
    setShowNewPassword(false);
    setAddError(null);
    setIsAddDialogOpen(false);
  }, [newOwnerName, newOwnerPassword, newOwnerConfirmPassword, newOwnerIsMaster, addOwner]);

  const handleChangePassword = useCallback(async () => {
    if (!changePasswordOwner) return;

    if (!currentPassword) {
      setChangePasswordError("Please enter current password");
      return;
    }
    if (!newPassword) {
      setChangePasswordError("Please enter new password");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setChangePasswordError("Password must be at least 4 characters");
      return;
    }

    const success = await changeOwnerPassword(changePasswordOwner.id, currentPassword, newPassword);
    if (!success) {
      setChangePasswordError("Current password is incorrect");
      return;
    }

    // Reset form
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrentPassword(false);
    setShowNewPasswordChange(false);
    setChangePasswordError(null);
    setChangePasswordOwner(null);
  }, [changePasswordOwner, currentPassword, newPassword, confirmNewPassword, changeOwnerPassword]);

  const handleDeleteOwner = useCallback((id: string) => {
    removeOwner(id);
    setDeleteConfirmOwner(null);
  }, [removeOwner]);

  const handleSaveEditName = useCallback(() => {
    if (editingOwner && editName.trim()) {
      updateOwnerName(editingOwner.id, editName.trim());
    }
    setEditingOwner(null);
    setEditName("");
  }, [editingOwner, editName, updateOwnerName]);

  const handleUnlockOwner = useCallback(async () => {
    if (!unlockOwnerTarget) return;

    // Check rate limit before attempting unlock
    const lockStatus = checkRateLimit(unlockOwnerTarget.id);
    if (lockStatus.locked) {
      const seconds = Math.ceil(lockStatus.remainingMs / 1000);
      setUnlockError(`Too many failed attempts. Try again in ${seconds} seconds.`);
      return;
    }

    if (!unlockPassword.trim()) {
      setUnlockError("Please enter the password");
      return;
    }

    const success = await unlockOwner(unlockOwnerTarget.id, unlockPassword);
    if (!success) {
      // Check if now locked out after failed attempt
      const newLockStatus = checkRateLimit(unlockOwnerTarget.id);
      if (newLockStatus.locked) {
        setUnlockError("Too many failed attempts. Account locked for 1 minute.");
      } else {
        setUnlockError("Incorrect password");
      }
      return;
    }

    // Reset form
    setUnlockPassword("");
    setShowUnlockPassword(false);
    setUnlockError(null);
    setUnlockOwnerTarget(null);
  }, [unlockOwnerTarget, unlockPassword, unlockOwner, checkRateLimit]);

  // Count portfolios assigned to each owner
  const getOwnerPortfolioCount = useCallback((ownerId: string) => {
    return portfolios.filter((p) => p.ownerIds?.includes(ownerId)).length;
  }, [portfolios]);

  // Toggle portfolio assignment for an owner
  const togglePortfolioAssignment = useCallback((portfolioId: string, ownerId: string, isAssigned: boolean) => {
    if (isAssigned) {
      removeOwnerFromPortfolio(portfolioId, ownerId);
    } else {
      addOwnerToPortfolio(portfolioId, ownerId);
    }
  }, [addOwnerToPortfolio, removeOwnerFromPortfolio]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Owner Profiles
        </CardTitle>
        <CardDescription>
          Manage owner profiles for portfolio security. Each owner has a password that unlocks all their assigned portfolios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Notice */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Security Note</p>
          <p>
            This is convenience security for shared devices. Portfolios remain accessible when the owner&apos;s password is entered.
            Unlock state clears when the browser is fully closed.
          </p>
        </div>

        {/* Owner List with Portfolio Access Grid */}
        {owners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No owner profiles yet</p>
            <p className="text-sm">Create an owner to protect portfolios with a password</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Portfolio Header Row */}
            {portfolios.length > 0 && (
              <div className="flex items-end gap-3 pl-[180px] pr-[200px]">
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio.id}
                    className="flex-1 min-w-[80px] max-w-[120px] text-center"
                  >
                    <p className="text-xs text-muted-foreground font-medium truncate px-1" title={portfolio.name}>
                      {portfolio.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Owner Rows */}
            <div className="space-y-2">
              {owners.map((owner) => {
                const isUnlocked = isOwnerUnlocked(owner.id);
                const portfolioCount = getOwnerPortfolioCount(owner.id);

                return (
                  <div
                    key={owner.id}
                    className={cn(
                      "rounded-xl border transition-all duration-200",
                      isUnlocked ? "bg-green-500/5 border-green-500/20" : "bg-muted/20 border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* Owner Info */}
                      <div className="flex items-center gap-3 w-[160px] shrink-0">
                        {owner.isMaster ? (
                          <ShieldCheck className="h-5 w-5 text-amber-500" />
                        ) : isUnlocked ? (
                          <LockOpen className="h-5 w-5 text-green-500" />
                        ) : (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          {editingOwner?.id === owner.id ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveEditName()}
                              onBlur={handleSaveEditName}
                              autoFocus
                              className="h-7 w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{owner.name}</span>
                              {owner.isMaster && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                                  Master
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {portfolioCount} portfolio{portfolioCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      {/* Portfolio Access Indicators */}
                      <div className="flex items-center gap-3 flex-1">
                        {portfolios.map((portfolio) => {
                          const hasAccess = portfolio.ownerIds?.includes(owner.id) || false;
                          return (
                            <div
                              key={portfolio.id}
                              className="flex-1 min-w-[80px] max-w-[120px] flex justify-center"
                            >
                              <button
                                onClick={() => togglePortfolioAssignment(portfolio.id, owner.id, hasAccess)}
                                className={cn(
                                  "w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
                                  hasAccess
                                    ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                                    : "bg-transparent border-muted-foreground/30 hover:border-muted-foreground/50"
                                )}
                                title={hasAccess ? `Remove ${owner.name}'s access to ${portfolio.name}` : `Give ${owner.name} access to ${portfolio.name}`}
                              >
                                {hasAccess && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Lock/Unlock Button */}
                        {isUnlocked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => lockOwner(owner.id)}
                            title="Lock"
                            className="h-8 w-8 p-0"
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUnlockOwnerTarget({ id: owner.id, name: owner.name });
                              setUnlockPassword("");
                              setUnlockError(null);
                            }}
                            title="Unlock"
                            className="h-8 w-8 p-0"
                          >
                            <LockOpen className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Master Toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOwnerMaster(owner.id, !owner.isMaster)}
                          title={owner.isMaster ? "Remove master access" : "Grant master access"}
                          className={cn("h-8 w-8 p-0", owner.isMaster && "text-amber-500")}
                        >
                          {owner.isMaster ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Edit Name */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingOwner({ id: owner.id, name: owner.name });
                            setEditName(owner.name);
                          }}
                          title="Edit name"
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Change Password */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setChangePasswordOwner({ id: owner.id, name: owner.name })}
                          title="Change password"
                          className="h-8 w-8 p-0"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmOwner({ id: owner.id, name: owner.name })}
                          title="Delete owner"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            {portfolios.length > 0 && (
              <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Has access</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  <span>No access</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Owner
          </Button>
          {owners.length > 0 && (
            <Button variant="outline" onClick={lockAllOwners}>
              <Lock className="h-4 w-4 mr-2" />
              Lock All
            </Button>
          )}
        </div>

        {/* Add Owner Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setNewOwnerName("");
            setNewOwnerPassword("");
            setNewOwnerConfirmPassword("");
            setNewOwnerIsMaster(false);
            setShowNewPassword(false);
            setAddError(null);
          }
        }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add Owner Profile</DialogTitle>
              <DialogDescription>
                Create a new owner to protect portfolios with a password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="owner-name">Name</Label>
                <Input
                  id="owner-name"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="e.g., Joe, Leonard"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-password">Password</Label>
                <div className="relative">
                  <Input
                    id="owner-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-confirm-password">Confirm Password</Label>
                <Input
                  id="owner-confirm-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newOwnerConfirmPassword}
                  onChange={(e) => setNewOwnerConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="owner-master">Master Access</Label>
                  <p className="text-xs text-muted-foreground">
                    Can view ALL portfolios when unlocked
                  </p>
                </div>
                <Switch
                  id="owner-master"
                  checked={newOwnerIsMaster}
                  onCheckedChange={setNewOwnerIsMaster}
                />
              </div>

              {addError && (
                <p className="text-sm text-destructive">{addError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddOwner}>
                Create Owner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={!!changePasswordOwner} onOpenChange={(open) => {
          if (!open) {
            setChangePasswordOwner(null);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setShowCurrentPassword(false);
            setShowNewPasswordChange(false);
            setChangePasswordError(null);
          }
        }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Change password for {changePasswordOwner?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPasswordChange ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordChange(!showNewPasswordChange)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showNewPasswordChange ? "Hide password" : "Show password"}
                  >
                    {showNewPasswordChange ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type={showNewPasswordChange ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              {changePasswordError && (
                <p className="text-sm text-destructive">{changePasswordError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePasswordOwner(null)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword}>
                Change Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmOwner} onOpenChange={(open) => !open && setDeleteConfirmOwner(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete Owner</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{deleteConfirmOwner?.name}&rdquo;?
                Portfolios assigned to this owner will become public (no password required).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOwner(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmOwner && handleDeleteOwner(deleteConfirmOwner.id)}
              >
                Delete Owner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unlock Owner Password Dialog */}
        <Dialog open={!!unlockOwnerTarget} onOpenChange={(open) => {
          if (!open) {
            setUnlockOwnerTarget(null);
            setUnlockPassword("");
            setUnlockError(null);
            setShowUnlockPassword(false);
          }
        }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Unlock {unlockOwnerTarget?.name}</DialogTitle>
              <DialogDescription>
                Enter the password to unlock this owner&apos;s portfolios.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="unlock-password">Password</Label>
                <div className="relative">
                  <Input
                    id="unlock-password"
                    type={showUnlockPassword ? "text" : "password"}
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      setUnlockError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUnlockOwner();
                      }
                    }}
                    placeholder="Enter password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showUnlockPassword ? "Hide password" : "Show password"}
                  >
                    {showUnlockPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {unlockError && (
                <p className="text-sm text-destructive">{unlockError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUnlockOwnerTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleUnlockOwner}>
                Unlock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
