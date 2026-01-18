"use client";

import { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { playSelectionChime, playLoginSuccess, playCancelSound } from "@/lib/audio";
import { useOwnerStore, GUEST_ID } from "@/stores/ownerStore";
import { verifyPassword } from "@/lib/crypto";
import type { Owner } from "@/types/owner";
import { Logo } from "@/components/layout/Logo";

// Profile pictures for known users (case-insensitive match)
const PROFILE_PICTURES: Record<string, string> = {
  joe: "/joe.png",
  cliff: "/cliff.png",
  foad: "/foad.png",
  ivy: "/ivy.png",
  leonard: "/leonard.png",
  thanh: "/thanh.png",
};

// Get profile picture path for a name, or null if not found
function getProfilePicture(name: string | undefined | null): string | null {
  if (!name || typeof name !== "string") return null;
  const normalizedName = name.toLowerCase().trim();
  return PROFILE_PICTURES[normalizedName] || null;
}

// Color palette for account avatars (used as fallback)
const AVATAR_COLORS = [
  { bg: "bg-violet-500", ring: "ring-violet-400" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { bg: "bg-amber-500", ring: "ring-amber-400" },
  { bg: "bg-rose-500", ring: "ring-rose-400" },
  { bg: "bg-cyan-500", ring: "ring-cyan-400" },
  { bg: "bg-fuchsia-500", ring: "ring-fuchsia-400" },
  { bg: "bg-lime-500", ring: "ring-lime-400" },
  { bg: "bg-orange-500", ring: "ring-orange-400" },
];

interface AccountSelectorProps {
  onLoginSuccess: () => void;
}

export function AccountSelector({ onLoginSuccess }: AccountSelectorProps) {
  const owners = useOwnerStore((state) => state.owners);
  const login = useOwnerStore((state) => state.login);
  const addOwner = useOwnerStore((state) => state.addOwner);
  const removeOwner = useOwnerStore((state) => state.removeOwner);
  const initializeDefaultOwner = useOwnerStore((state) => state.initializeDefaultOwner);
  const checkRateLimit = useOwnerStore((state) => state.checkRateLimit);

  // Get master owner for password verification
  const masterOwner = owners.find((o) => o.isMaster);

  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Create new account state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete account state
  const [deleteOwnerTarget, setDeleteOwnerTarget] = useState<Owner | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMasterPasswordDialog, setShowMasterPasswordDialog] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; owner: Owner } | null>(null);

  // Initialize owners from storage/Supabase
  useEffect(() => {
    const init = async () => {
      await initializeDefaultOwner();
      setIsInitializing(false);
    };
    init();
  }, [initializeDefaultOwner]);

  // Sort owners: master first, then alphabetically
  const sortedOwners = [...owners].sort((a, b) => {
    if (a.isMaster && !b.isMaster) return -1;
    if (!a.isMaster && b.isMaster) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleOwnerClick = useCallback(async (owner: Owner) => {
    playSelectionChime();

    // Non-admin accounts: login directly without password
    if (!owner.isMaster) {
      const success = await login(owner.id, "");
      if (success) {
        playLoginSuccess();
        onLoginSuccess();
      }
      return;
    }

    // Admin accounts: show password dialog
    setSelectedOwner(owner);
    setPassword("");
    setError(null);
  }, [login, onLoginSuccess]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;

    // Check rate limit before attempting login
    const lockStatus = checkRateLimit(selectedOwner.id);
    if (lockStatus.locked) {
      const seconds = Math.ceil(lockStatus.remainingMs / 1000);
      setError(`Too many failed attempts. Try again in ${seconds} seconds.`);
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await login(selectedOwner.id, password);
      if (success) {
        playLoginSuccess();
        onLoginSuccess();
      } else {
        // Check if now locked out after failed attempt
        const newLockStatus = checkRateLimit(selectedOwner.id);
        if (newLockStatus.locked) {
          setError("Too many failed attempts. Account locked for 1 minute.");
        } else {
          setError("Incorrect password");
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedOwner, password, login, onLoginSuccess, checkRateLimit]);

  const handleDialogClose = useCallback(() => {
    playCancelSound();
    setSelectedOwner(null);
    setPassword("");
    setError(null);
    setShowPassword(false);
  }, []);

  const handleCreateDialogClose = useCallback(() => {
    playCancelSound();
    setIsCreateOpen(false);
    setNewName("");
    setNewPassword("");
    setCreateError(null);
    setShowNewPassword(false);
  }, []);

  // Check if this will be the first account (admin)
  const isFirstAccount = owners.length === 0;

  const handleCreateAccount = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      setCreateError("Please enter a name");
      return;
    }

    // First account (admin) requires a password
    if (isFirstAccount) {
      if (!newPassword.trim()) {
        setCreateError("Admin account requires a password");
        return;
      }
      if (newPassword.length < 4) {
        setCreateError("Password must be at least 4 characters");
        return;
      }
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // First account becomes admin with password, others are passwordless
      const password = isFirstAccount ? newPassword : "";
      const newId = await addOwner(newName.trim(), password, false);
      // Auto-login as the new user
      await login(newId, password);
      playLoginSuccess();
      onLoginSuccess();
    } catch {
      setCreateError("Failed to create account. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }, [newName, newPassword, isFirstAccount, addOwner, login, onLoginSuccess]);

  // Right-click handler
  const handleContextMenu = useCallback((e: React.MouseEvent, owner: Owner) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, owner });
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Start delete flow
  const handleDeleteClick = useCallback(() => {
    if (contextMenu) {
      setDeleteOwnerTarget(contextMenu.owner);
      setShowDeleteConfirm(true);
      setContextMenu(null);
    }
  }, [contextMenu]);

  // User confirmed "Yes" on first dialog - now ask for master password
  const handleDeleteConfirmYes = useCallback(() => {
    setShowDeleteConfirm(false);
    setShowMasterPasswordDialog(true);
    setMasterPassword("");
    setDeleteError(null);
  }, []);

  // User clicked "No" on first dialog - cancel
  const handleDeleteConfirmNo = useCallback(() => {
    playCancelSound();
    setShowDeleteConfirm(false);
    setDeleteOwnerTarget(null);
  }, []);

  // Verify master password and delete account
  const handleMasterPasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteOwnerTarget || !masterOwner) return;

    if (!masterPassword.trim()) {
      setDeleteError("Please enter the Master password");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Verify master password
      const isValid = await verifyPassword(masterPassword, masterOwner.passwordHash);
      if (!isValid) {
        setDeleteError("Incorrect Master password");
        setIsDeleting(false);
        return;
      }

      // Delete the owner
      removeOwner(deleteOwnerTarget.id);

      // Close dialogs
      setShowMasterPasswordDialog(false);
      setDeleteOwnerTarget(null);
      setMasterPassword("");
    } catch {
      setDeleteError("An error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteOwnerTarget, masterOwner, masterPassword, removeOwner]);

  // Close master password dialog
  const handleMasterPasswordClose = useCallback(() => {
    playCancelSound();
    setShowMasterPasswordDialog(false);
    setDeleteOwnerTarget(null);
    setMasterPassword("");
    setDeleteError(null);
    setShowMasterPassword(false);
  }, []);

  // Get initials for avatar (with defensive checks)
  const getInitials = (name: string | undefined | null) => {
    if (!name || typeof name !== "string") return "?";
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed
      .split(" ")
      .map((n) => n[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  };

  const getColorForOwner = (index: number) => {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  // Show loading while initializing default owner
  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get profile pictures for background decoration
  const profilePicsForBg = Object.entries(PROFILE_PICTURES);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden relative">
      {/* Giant staggered profile pictures as background decoration */}
      {/* Hidden on mobile for cleaner look, visible on larger screens */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        {profilePicsForBg.map(([name, src], index) => {
          // Base size is 18vmin, but Leonard (index 4) is 1.4x larger and centered behind logo
          const baseSize = 18;
          const isLeonard = name === "leonard";
          const imageSize = isLeonard ? baseSize * 1.4 : baseSize; // 25.2vmin for Leonard
          // Positions calculated so imageSize + position always < 100% in both dimensions
          // Leonard is centered behind the logo
          const positions = [
            { top: 5, left: 5, rotate: -15 },      // Top-left (joe)
            { top: 60, left: 8, rotate: 12 },      // Bottom-left (cliff)
            { top: 5, left: 77, rotate: 20 },      // Top-right (foad)
            { top: 60, left: 75, rotate: -10 },    // Bottom-right (ivy)
            { top: 8, left: 42, rotate: 0 },       // Center behind logo (leonard)
            { top: 35, left: 82, rotate: -8 },     // Right side (thanh)
          ];
          const pos = positions[index % positions.length];
          return (
            <div
              key={name}
              className="absolute rounded-full overflow-hidden opacity-[0.08] blur-[1px]"
              style={{
                width: `${imageSize}vmin`,
                height: `${imageSize}vmin`,
                top: `${pos.top}%`,
                left: `${pos.left}%`,
                transform: `rotate(${pos.rotate}deg)`,
              }}
            >
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover object-[center_20%]"
              />
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">
        {/* App Logo - prominent display, responsive scaling */}
        <div className="mb-4 sm:mb-6 transform scale-[2] sm:scale-[2.5] md:scale-[3.5] lg:scale-[5]">
          <Logo size="lg" />
        </div>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 w-full mt-6 sm:mt-8 px-2">
        {/* Owner accounts */}
        {sortedOwners.map((owner, index) => {
          const colors = getColorForOwner(index);
          const profilePic = getProfilePicture(owner.name);
          return (
            <button
              key={owner.id}
              onClick={() => handleOwnerClick(owner)}
              onContextMenu={(e) => handleContextMenu(e, owner)}
              className="group flex flex-col items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-2xl transition-all duration-300 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <div
                className={cn(
                  "relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full shadow-lg transition-transform duration-300 ease-out overflow-hidden",
                  !profilePic && colors.bg,
                  "group-hover:scale-[1.15] sm:group-hover:scale-[1.3] group-hover:ring-4 group-hover:ring-offset-2 group-hover:ring-offset-background",
                  profilePic ? "ring-gray-300 dark:ring-gray-600" : colors.ring
                )}
              >
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={owner.name}
                    className="w-full h-full object-cover object-[center_20%]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-lg sm:text-xl md:text-2xl font-bold">
                    {getInitials(owner.name)}
                  </div>
                )}
                {owner.isMaster && (
                  <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-amber-500 rounded-full p-1 sm:p-1.5 shadow-md z-10">
                    <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="text-center transition-transform duration-300 ease-out group-hover:scale-[1.3] sm:group-hover:scale-[1.6]">
                <p className="font-semibold text-foreground text-sm sm:text-base">{owner.name}</p>
                {owner.isMaster && (
                  <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">Master</p>
                )}
              </div>
            </button>
          );
        })}

        {/* Create New account */}
        <button
          onClick={() => {
            playSelectionChime();
            setIsCreateOpen(true);
          }}
          className="group flex flex-col items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-2xl transition-all duration-300 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary/30 text-primary transition-transform duration-300 ease-out group-hover:scale-[1.15] sm:group-hover:scale-[1.3] group-hover:ring-4 group-hover:ring-offset-2 group-hover:ring-offset-background group-hover:ring-primary/30 group-hover:bg-primary/20">
            <Plus className="h-6 w-6 sm:h-8 sm:h-8 md:h-10 md:w-10" />
          </div>
          <div className="text-center transition-transform duration-300 ease-out group-hover:scale-[1.3] sm:group-hover:scale-[1.6]">
            <p className="font-semibold text-primary text-sm sm:text-base">Create New</p>
            <p className="text-[10px] sm:text-xs text-primary/70">Add account</p>
          </div>
        </button>
        </div>
      </div>


      {/* Password Dialog */}
      <Dialog open={selectedOwner !== null} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedOwner && (
                <>
                  {(() => {
                    const profilePic = getProfilePicture(selectedOwner.name);
                    const colorIndex = sortedOwners.findIndex((o) => o.id === selectedOwner.id);
                    return profilePic ? (
                      <img
                        src={profilePic}
                        alt={selectedOwner.name}
                        className="w-10 h-10 rounded-full object-cover object-[center_20%]"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold",
                          getColorForOwner(colorIndex).bg
                        )}
                      >
                        {getInitials(selectedOwner.name)}
                      </div>
                    );
                  })()}
                  <span>Welcome back, {selectedOwner.name}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Enter your password to continue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit}>
            <div className="py-4">
              <div className="relative">
                <Input
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
                <p className="text-sm text-destructive mt-2">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create New Account Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) handleCreateDialogClose();
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/20 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <span>{isFirstAccount ? "Create Admin Account" : "Create New Account"}</span>
            </DialogTitle>
            <DialogDescription>
              {isFirstAccount
                ? "This will be the admin account. Enter a name and password."
                : "Enter your name to create an account."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount}>
            <div className="py-4 space-y-4">
              <div>
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setCreateError(null);
                  }}
                  placeholder="Your name"
                  autoFocus
                  disabled={isCreating}
                  className={cn(createError && !newName.trim() && "border-destructive")}
                />
              </div>
              {/* Password field only for first account (admin) */}
              {isFirstAccount && (
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setCreateError(null);
                    }}
                    placeholder="Choose a password"
                    disabled={isCreating}
                    className={cn(createError && !newPassword.trim() && "border-destructive")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateDialogClose}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  isFirstAccount ? "Create Admin" : "Create Account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
