"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

/** JV To Do logo - minimalist notebook icon */
export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  // Responsive icon sizes
  const iconSizes = {
    sm: "w-6 h-6 md:w-7 md:h-7",
    md: "w-5 h-5 md:w-9 md:h-9",
    lg: "w-8 h-8 md:w-12 md:h-12",
  };

  // Responsive text sizes
  const textSizes = {
    sm: "text-xs md:text-xl",
    md: "text-xs md:text-3xl",
    lg: "text-sm md:text-4xl",
  };

  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-0 md:gap-3", className)}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("flex-shrink-0", iconSizes[size])}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="notebookGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>

        {/* Notebook body */}
        <rect
          x="8"
          y="4"
          width="26"
          height="32"
          rx="4"
          fill="url(#notebookGradient)"
        />

        {/* Notebook binding/spine */}
        <rect
          x="4"
          y="8"
          width="4"
          height="6"
          rx="1"
          fill="white"
          fillOpacity="0.9"
        />
        <rect
          x="4"
          y="17"
          width="4"
          height="6"
          rx="1"
          fill="white"
          fillOpacity="0.9"
        />
        <rect
          x="4"
          y="26"
          width="4"
          height="6"
          rx="1"
          fill="white"
          fillOpacity="0.9"
        />

        {/* Notebook lines */}
        <line x1="14" y1="12" x2="28" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
        <line x1="14" y1="18" x2="28" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
        <line x1="14" y1="24" x2="24" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
      </svg>

      {showText && (
        <span
          className={cn(
            "whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400",
            textSizes[size]
          )}
          style={{
            fontWeight: 900,
            letterSpacing: "-0.02em",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          JV To Do
        </span>
      )}
    </div>
  );
}
