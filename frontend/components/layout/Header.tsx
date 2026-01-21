"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, Settings, CalendarDays, CheckSquare, Mail, PlusCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MobileToggle } from "@/components/ui/mobile-toggle";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

// Navigation items for the header
const navItems = [
  { title: "Entry", href: "/entry", icon: PlusCircle },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Gmail", href: "/gmail", icon: Mail },
  { title: "Search", href: "/search", icon: Sparkles },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Spacer for balance */}
      <div className="flex-1" />

      {/* Center: Logo + Navigation Links */}
      <nav className="hidden md:flex items-center gap-4">
        <Link href="/calendar" className="mr-2">
          <Logo size="md" />
        </Link>
        {navItems.map((item) => {
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
      </div>
    </header>
  );
}
