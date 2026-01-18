"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  Wallet,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
// Native title attribute used instead of Radix Tooltip to prevent
// "Maximum update depth exceeded" errors during currency toggle
import { Logo } from "./Logo";
import { useSidebar } from "./SidebarContext";

interface NavItemData {
  title: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItemData[] = [
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Running Tab",
    href: "/running-tab",
    icon: Wallet,
  },
];

const secondaryItems: NavItemData[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

// Hoisted NavItem component to prevent recreation on every render
interface NavItemProps {
  item: NavItemData;
  isActive: boolean;
  isCollapsed: boolean;
}

const NavItem = memo(function NavItem({ item, isActive, isCollapsed }: NavItemProps) {
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full h-11 touch-target focus-ring group/nav transition-all duration-200",
        isCollapsed ? "justify-center px-2" : "justify-start gap-3",
        isActive && "bg-secondary",
        !isActive && !isCollapsed && "hover:translate-x-1"
      )}
      title={isCollapsed ? item.title : undefined}
      asChild
    >
      <Link href={item.href} aria-current={isActive ? "page" : undefined}>
        <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/nav:scale-110" aria-hidden="true" />
        {!isCollapsed && <span className="truncate">{item.title}</span>}
      </Link>
    </Button>
  );
});

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { isCollapsed, toggleCollapsed } = useSidebar();

  // Hide sidebar on login page
  const isLoginPage = pathname === "/";

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  // NOTE: All hooks must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (isLoginPage) return; // Skip effect on login page
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isLoginPage]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isLoginPage) return; // Skip effect on login page
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isLoginPage]);

  // Don't render sidebar on login page (after all hooks are called)
  if (isLoginPage) {
    return null;
  }

  // Inline SidebarContent - kept inside component as it uses local state (isCollapsed, setIsOpen)
  // but we've hoisted NavItem outside which is the heavier component
  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b",
        isCollapsed ? "justify-center px-2" : "justify-between gap-2 px-4"
      )}>
        {!isCollapsed && <Logo size="md" />}
        {isCollapsed && <Logo size="sm" showText={false} />}
        {/* Close button - mobile only */}
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10 touch-target"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-4")} aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return <NavItem key={item.href} item={item} isActive={isActive} isCollapsed={isCollapsed} />;
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className={isCollapsed ? "p-2" : "p-4"}>
        <Separator className="mb-4" />
        {secondaryItems.map((item) => {
          const isActive = pathname === item.href;
          return <NavItem key={item.href} item={item} isActive={isActive} isCollapsed={isCollapsed} />;
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button - fixed in top-left */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden h-10 w-10 touch-target focus-ring bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - mobile: drawer, desktop: fixed */}
      <aside
        id="mobile-sidebar"
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r bg-background transition-all duration-200",
          // Width: collapsed on desktop only
          isCollapsed ? "md:w-16" : "w-64",
          // Mobile: slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible
          "md:translate-x-0"
        )}
        aria-label="Sidebar navigation"
      >
        <SidebarContent />

        {/* Collapse toggle button - desktop only */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 hidden md:flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  );
}
