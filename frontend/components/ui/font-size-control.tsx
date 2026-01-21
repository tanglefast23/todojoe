"use client";

import { useSettingsStore, type FontSize } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface FontSizeControlProps {
  className?: string;
}

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
  xlarge: "XL",
};

export function FontSizeControl({ className }: FontSizeControlProps) {
  const { fontSize, cycleFontSize } = useSettingsStore();

  return (
    <button
      onClick={cycleFontSize}
      className={cn(
        "flex items-center justify-center",
        "h-8 w-8 rounded-md",
        "text-sm font-medium text-muted-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-colors",
        className
      )}
      title={`Font size: ${fontSize} (tap to change)`}
    >
      {FONT_SIZE_LABELS[fontSize]}
    </button>
  );
}
