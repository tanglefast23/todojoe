"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseShortcutsProps {
  onSelectExpense: (name: string) => void;
}

type ShortcutStep = "main" | "drinks" | "cats" | "cats-expense";

export function ExpenseShortcuts({ onSelectExpense }: ExpenseShortcutsProps) {
  const [step, setStep] = useState<ShortcutStep>("main");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const resetToMain = () => {
    setStep("main");
    setSelectedCat(null);
  };

  // Simple shortcuts - single tap
  const handleSimpleShortcut = (name: string) => {
    onSelectExpense(name);
  };

  // Drinks sub-options
  const handleDrinksSelect = (drinkType: string) => {
    onSelectExpense(drinkType);
    resetToMain();
  };

  // Cats - first select which cat
  const handleCatSelect = (cat: string) => {
    setSelectedCat(cat);
    setStep("cats-expense");
  };

  // Cats - then select expense type
  const handleCatExpenseSelect = (expenseType: string) => {
    if (selectedCat) {
      onSelectExpense(`${selectedCat} - ${expenseType}`);
    }
    resetToMain();
  };

  // Main shortcuts grid - 6 columns, centered
  if (step === "main") {
    return (
      <div className="flex justify-center gap-2 sm:gap-3">
        <ShortcutSquare
          onClick={() => handleSimpleShortcut("Groceries")}
          label="Groceries"
          emoji="🛒"
          color="emerald"
        />
        <ShortcutSquare
          onClick={() => handleSimpleShortcut("Gas")}
          label="Gas"
          emoji="⛽"
          color="amber"
        />
        <ShortcutSquare
          onClick={() => setStep("drinks")}
          label="Drinks"
          emoji="🥤"
          color="cyan"
          hasSubmenu
        />
        <ShortcutSquare
          onClick={() => handleSimpleShortcut("Food")}
          label="Food"
          emoji="🍜"
          color="red"
        />
        <ShortcutSquare
          onClick={() => handleSimpleShortcut("Parking")}
          label="Parking"
          emoji="🅿️"
          color="slate"
        />
        <ShortcutSquare
          onClick={() => setStep("cats")}
          label="Cats"
          emoji="🐱"
          color="purple"
          hasSubmenu
        />
      </div>
    );
  }

  // Drinks sub-options - Full screen overlay
  if (step === "drinks") {
    return (
      <FullScreenOverlay title="Select drink type" onBack={resetToMain}>
        <LargeShortcutSquare
          onClick={() => handleDrinksSelect("🧋 Bubble Tea")}
          label="Bubble Tea"
          emoji="🧋"
          color="amber"
        />
        <LargeShortcutSquare
          onClick={() => handleDrinksSelect("☕ Coffee")}
          label="Coffee"
          emoji="☕"
          color="orange"
        />
        <LargeShortcutSquare
          onClick={() => handleDrinksSelect("🍹🍹 Many Drinks")}
          label="Many"
          emoji="🍹🍸🍺"
          color="pink"
        />
      </FullScreenOverlay>
    );
  }

  // Cats - select which cat - Full screen overlay
  if (step === "cats") {
    return (
      <FullScreenOverlay title="Which cat?" onBack={resetToMain}>
        <LargeShortcutSquare
          onClick={() => handleCatSelect("Ivory")}
          label="Ivory"
          sublabel="white"
          catImage="ivory"
          color="slate"
        />
        <LargeShortcutSquare
          onClick={() => handleCatSelect("Tom")}
          label="Tom"
          sublabel="brown"
          catImage="tom"
          color="amber"
        />
        <LargeShortcutSquare
          onClick={() => handleCatSelect("Tom and Ivory")}
          label="Both"
          catImage="both"
          color="purple"
        />
      </FullScreenOverlay>
    );
  }

  // Cats - select expense type - Full screen overlay
  if (step === "cats-expense") {
    return (
      <FullScreenOverlay title={`${selectedCat} — expense type`} onBack={() => setStep("cats")}>
        <LargeShortcutSquare
          onClick={() => handleCatExpenseSelect("Vet")}
          label="Vet"
          emoji="💉"
          color="red"
        />
        <LargeShortcutSquare
          onClick={() => handleCatExpenseSelect("Grooming")}
          label="Grooming"
          emoji="✂️"
          color="blue"
        />
        <LargeShortcutSquare
          onClick={() => handleCatExpenseSelect("Other")}
          label="Other"
          emoji="📦"
          color="zinc"
        />
      </FullScreenOverlay>
    );
  }

  return null;
}

// Color configurations for shortcuts
const colorConfig = {
  emerald: "bg-emerald-500/15 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/25",
  amber: "bg-amber-500/15 border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/25",
  cyan: "bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/25",
  red: "bg-red-500/15 border-red-500/30 hover:border-red-400 hover:bg-red-500/25",
  slate: "bg-slate-500/15 border-slate-500/30 hover:border-slate-400 hover:bg-slate-500/25",
  purple: "bg-purple-500/15 border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/25",
  orange: "bg-orange-600/15 border-orange-600/30 hover:border-orange-500 hover:bg-orange-600/25",
  pink: "bg-pink-500/15 border-pink-500/30 hover:border-pink-400 hover:bg-pink-500/25",
  blue: "bg-blue-500/15 border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/25",
  zinc: "bg-zinc-500/15 border-zinc-500/30 hover:border-zinc-400 hover:bg-zinc-500/25",
};

// Full screen overlay for sub-menus
function FullScreenOverlay({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onBack}
          className="p-3 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-lg font-medium text-muted-foreground">{title}</span>
      </div>

      {/* Large squares - full height distributed */}
      <div className="flex-1 flex flex-col gap-4 px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

// Large shortcut square for overlay - fills available space
function LargeShortcutSquare({
  label,
  emoji,
  catImage,
  sublabel,
  onClick,
  color,
}: {
  label: string;
  emoji?: string;
  catImage?: "ivory" | "tom" | "both";
  sublabel?: string;
  onClick: () => void;
  color: keyof typeof colorConfig;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 w-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98]",
        colorConfig[color]
      )}
    >
      {catImage ? (
        catImage === "both" ? (
          <div className="flex -space-x-6">
            <img src="/ivory.PNG" alt="Ivory" className="w-32 h-40 rounded-2xl object-contain" />
            <img src="/tom.png" alt="Tom" className="w-32 h-40 rounded-2xl object-contain" />
          </div>
        ) : (
          <img
            src={catImage === "ivory" ? "/ivory.PNG" : "/tom.png"}
            alt={catImage === "ivory" ? "Ivory" : "Tom"}
            className="w-44 h-48 rounded-2xl object-contain"
          />
        )
      ) : (
        <span className="text-7xl leading-none">{emoji}</span>
      )}
      <span className="text-2xl font-bold text-foreground">{label}</span>
      {sublabel && (
        <span className="text-sm text-muted-foreground -mt-1">{sublabel}</span>
      )}
    </button>
  );
}

// Reusable shortcut square component
function ShortcutSquare({
  label,
  emoji,
  catImage,
  sublabel,
  onClick,
  color,
  hasSubmenu,
}: {
  label: string;
  emoji?: string;
  catImage?: "ivory" | "tom" | "both";
  sublabel?: string;
  onClick: () => void;
  color: keyof typeof colorConfig;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95",
        colorConfig[color]
      )}
    >
      {catImage ? (
        catImage === "both" ? (
          <div className="flex -space-x-1">
            <img src="/ivory.PNG" alt="Ivory" className="w-5 h-6 sm:w-6 sm:h-7 rounded object-contain" />
            <img src="/tom.png" alt="Tom" className="w-5 h-6 sm:w-6 sm:h-7 rounded object-contain" />
          </div>
        ) : (
          <img
            src={catImage === "ivory" ? "/ivory.PNG" : "/tom.png"}
            alt={catImage === "ivory" ? "Ivory" : "Tom"}
            className="w-7 h-8 sm:w-8 sm:h-9 rounded object-contain"
          />
        )
      ) : (
        <span className="text-xl sm:text-2xl leading-none">{emoji}</span>
      )}
      <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground/80">{label}</span>
      {sublabel && (
        <span className="text-[7px] sm:text-[8px] text-muted-foreground/60">{sublabel}</span>
      )}
      {hasSubmenu && (
        <span className="absolute top-0.5 right-1 text-[7px] text-muted-foreground/40">•••</span>
      )}
    </button>
  );
}
