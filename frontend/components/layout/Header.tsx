"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Moon, RefreshCw, Sun, User, ShieldCheck, Settings, Table2, Calculator } from "lucide-react";
import { useTheme } from "next-themes";
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

// Navigation items for the header
const navItems = [
  { title: "Tasks", href: "/tasks", icon: Table2 },
  { title: "Running Tab", href: "/running-tab", icon: Calculator },
  { title: "Settings", href: "/settings", icon: Settings },
];

// Profile pictures for known users (case-insensitive match)
const PROFILE_PICTURES: Record<string, string> = {
  joe: "/joe.png",
  cliff: "/cliff.png",
  foad: "/foad.png",
  ivy: "/ivy.png",
  leonard: "/leonard.png",
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

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({ onRefresh, isRefreshing }: HeaderProps) {
  const { setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Owner state - combined with useShallow to reduce subscriptions
  const { owners, getActiveOwnerId, getActiveOwner, isGuest, logout } = useOwnerStore(
    useShallow((state) => ({
      owners: state.owners,
      getActiveOwnerId: state.getActiveOwnerId,
      getActiveOwner: state.getActiveOwner,
      isGuest: state.isGuest,
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
      {/* Left: Logo */}
      <div className="flex items-center">
        <Link href="/tasks">
          <Logo size="md" />
        </Link>
      </div>

      {/* Center: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {/* Refresh Button - using native title to avoid Radix tooltip cascade issues */}
        {/* Use isMounted to defer isRefreshing state and prevent hydration mismatch */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isMounted && isRefreshing}
            className="group"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-5 w-5 transition-transform duration-500 ${isMounted && isRefreshing ? "animate-spin" : "group-hover:rotate-180"}`}
            />
            <span className="sr-only">Refresh data</span>
          </Button>
        )}

        {/* Mobile/Desktop Toggle */}
        <MobileToggle size="sm" />

        {/* Theme Toggle - only render after mount to avoid Radix hydration mismatch */}
        {isMounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="group">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 group-hover:rotate-12 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 group-hover:-rotate-12 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
                        <Image
                          src={profilePic}
                          alt={`Profile picture of ${activeOwner?.name || "User"}`}
                          fill
                          className="object-cover object-[center_20%]"
                          sizes="32px"
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
