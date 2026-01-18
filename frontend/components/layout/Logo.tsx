"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { icon: 24, text: "text-lg" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 40, text: "text-2xl" },
};

/** Moonfolio logo - crescent moon with upward rocket trail */
export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2 max-w-full overflow-hidden", className)}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="moonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="rocketGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>

        {/* Crescent moon */}
        <path
          d="M20 4C11.163 4 4 11.163 4 20s7.163 16 16 16c1.381 0 2.727-.175 4.01-.505C18.035 33.51 14 28.284 14 22c0-6.284 4.035-11.51 10.01-13.495C22.727 4.175 21.381 4 20 4z"
          fill="url(#moonGradient)"
        />

        {/* Rocket trail / chart line going up */}
        <path
          d="M18 32L24 24L28 26L36 8"
          stroke="url(#rocketGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Rocket head / arrow tip */}
        <circle cx="36" cy="8" r="3" fill="#4ade80" />

        {/* Small stars */}
        <circle cx="30" cy="14" r="1.5" fill="#fbbf24" opacity="0.8" />
        <circle cx="34" cy="20" r="1" fill="#fbbf24" opacity="0.6" />
      </svg>

      {showText && (
        <span className={cn("font-bold tracking-tight truncate", text)}>
          <span className="text-amber-400">Moon</span>
          <span className="text-emerald-400">folio</span>
        </span>
      )}
    </div>
  );
}
