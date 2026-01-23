"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, CalendarDays, Mail, PlusCircle, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

// Navigation items for mobile bottom nav
const navItems = [
  { title: "Daily", href: "/daily", icon: Sunrise },
  { title: "Entry", href: "/entry", icon: PlusCircle },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Gmail", href: "/gmail", icon: Mail },
];

/** Mobile bottom navigation bar for TODO app */
export const MobileBottomNav = memo(function MobileBottomNav() {
  const pathname = usePathname();

  const handleNavClick = (href: string) => {
    if (pathname !== href) {
      playClickSound();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background safe-area-pb">
      <div className="flex items-center justify-around h-[84px] pt-3 pb-7">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isEntry = item.href === "/entry";

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                isActive
                  ? "text-indigo-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.title}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Fixed-size container ensures center point stays consistent */}
              <div className="flex items-center justify-center w-11 h-11">
                {isActive ? (
                  // Active state: circular background with larger icon
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-indigo-500 transition-all">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  // Inactive state: regular icon centered in same space
                  <item.icon className="h-[22px] w-[22px] transition-all" />
                )}
              </div>
              <span className={cn(
                "text-[11px] font-medium",
                isActive && "text-indigo-400",
                isEntry && isActive && "font-semibold"
              )}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
