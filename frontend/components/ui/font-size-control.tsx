"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "./button";
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
  const { fontSize, increaseFontSize, decreaseFontSize } = useSettingsStore();

  const isSmallest = fontSize === "small";
  const isLargest = fontSize === "xlarge";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={decreaseFontSize}
        disabled={isSmallest}
        title="Decrease font size"
        className="h-8 w-8"
      >
        <Minus className="h-4 w-4" />
        <span className="sr-only">Decrease font size</span>
      </Button>

      <span
        className="min-w-[2rem] text-center text-xs font-medium text-muted-foreground"
        title={`Font size: ${fontSize}`}
      >
        {FONT_SIZE_LABELS[fontSize]}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={increaseFontSize}
        disabled={isLargest}
        title="Increase font size"
        className="h-8 w-8"
      >
        <Plus className="h-4 w-4" />
        <span className="sr-only">Increase font size</span>
      </Button>
    </div>
  );
}
