"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, RefreshCw, User, ShieldCheck, Settings, Table2, DollarSign, PenLine, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileToggle } from "@/components/ui/mobile-toggle";
import { useOwnerStore } from "@/stores/ownerStore";
import { useShallow } from "zustand/react/shallow";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

// Navigation items for the header (Settings moved to right side as icon)
const navItems = [
  { title: "Entry", href: "/entry", icon: PenLine, masterOnly: true },
  { title: "Tasks", href: "/tasks", icon: Table2 },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Running Tab", href: "/running-tab", icon: DollarSign },
];

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

// Same color palette as AccountSelector for consistency (fallback)
const AVATAR_COLORS = [
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-fuchsia-500", text: "text-white" },
  { bg: "bg-lime-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  // Owner state - combined with useShallow to reduce subscriptions
  const { owners, getActiveOwnerId, getActiveOwner, isGuest, isMasterLoggedIn, logout } = useOwnerStore(
    useShallow((state) => ({
      owners: state.owners,
      getActiveOwnerId: state.getActiveOwnerId,
      getActiveOwner: state.getActiveOwner,
      isGuest: state.isGuest,
      isMasterLoggedIn: state.isMasterLoggedIn,
      logout: state.logout,
    }))
  );

  // Hydration-safe
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeOwner = isMounted ? getActiveOwner() : null;
  const isGuestUser = isMounted ? isGuest() : false;
  const activeOwnerId = isMounted ? getActiveOwnerId() : null;
  const isMaster = isMounted ? isMasterLoggedIn() : false;

  // Sort owners same way as AccountSelector: master first, then alphabetically
  const sortedOwners = useMemo(() => {
    return [...owners].sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [owners]);

  // Get the color for the active owner based on their sorted position
  const getOwnerColor = (ownerId: string | null) => {
    if (!ownerId) return AVATAR_COLORS[0];
    const index = sortedOwners.findIndex((o) => o.id === ownerId);
    if (index === -1) return AVATAR_COLORS[0];
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  const ownerColor = activeOwnerId ? getOwnerColor(activeOwnerId) : AVATAR_COLORS[0];

  const handleOwnerLogout = () => {
    logout();
    router.push("/");
  };

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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Spacer for balance */}
      <div className="flex-1" />

      {/* Center: Logo + Navigation Links */}
      <nav className="hidden md:flex items-center gap-4">
        <Link href="/tasks" className="mr-2">
          <Logo size="md" />
        </Link>
        {navItems
          .filter((item) => !item.masterOnly || isMaster)
          .map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-400/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
      </nav>

      {/* Right: Controls */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {/* Page Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
          className="group"
          title="Refresh page"
        >
          <RefreshCw
            className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180"
          />
          <span className="sr-only">Refresh page</span>
        </Button>

        {/* Mobile/Desktop Toggle */}
        <MobileToggle size="sm" />

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/settings")}
          className="group"
          title="Settings"
        >
          <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
          <span className="sr-only">Settings</span>
        </Button>

        {/* Owner Profile (Local Auth) */}
        {isMounted && activeOwnerId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full transition-transform duration-200 hover:scale-105">
                {(() => {
                  // Guest user
                  if (isGuestUser) {
                    return (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-dashed border-muted-foreground/30">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    );
                  }

                  // Check for profile picture
                  const profilePic = getProfilePicture(activeOwner?.name);
                  if (profilePic) {
                    return (
                      <div className="relative h-8 w-8 rounded-full overflow-hidden">
                        <img
                          src={profilePic}
                          alt={`Profile picture of ${activeOwner?.name || "User"}`}
                          className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
                        />
                      </div>
                    );
                  }

                  // Fallback: colored circle with initials
                  return (
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${ownerColor?.bg || "bg-violet-500"} ${ownerColor?.text || "text-white"} text-xs font-bold`}>
                      {getInitials(activeOwner?.name)}
                    </div>
                  );
                })()}
                <span className="sr-only">Owner menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {isGuestUser ? "Guest" : activeOwner?.name || "Unknown"}
                    </p>
                    {activeOwner?.isMaster && (
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isGuestUser
                      ? "Viewing public portfolios"
                      : activeOwner?.isMaster
                        ? "Master account - full access"
                        : "Personal portfolios"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleOwnerLogout} className="text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                Switch Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

      </div>
    </header>
  );
}
