"use client";

import { cn } from "@/lib/utils";

// Same colors used in AccountSelector for consistency
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

interface CreatorAvatarProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CreatorAvatar({ name, className, size = "sm" }: CreatorAvatarProps) {
  // Get initials (first letter of first two words, or first two letters)
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Consistent color based on name
  const colorIndex = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const bgColor = AVATAR_COLORS[colorIndex];

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-medium",
        bgColor,
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
