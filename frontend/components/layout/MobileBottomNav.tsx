"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Table2, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";

const navItems = [
  { title: "Tasks", href: "/tasks", icon: Table2 },
  { title: "Tab", href: "/running-tab", icon: Calculator },
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive
                  ? "text-violet-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.title}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 transition-all",
                  isActive && "scale-110"
                )}
              />
              <span className={cn(
                "text-xs font-medium",
                isActive && "text-violet-400"
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
