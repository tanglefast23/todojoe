"use client";

import { useState, useMemo } from "react";
import { Briefcase, Check, Trash2, Plus } from "lucide-react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Same vibrant color palette as desktop PortfolioTabs
const PORTFOLIO_COLORS = [
  { bg: "bg-violet-500", text: "text-violet-500", ring: "ring-violet-400" },
  { bg: "bg-emerald-500", text: "text-emerald-500", ring: "ring-emerald-400" },
  { bg: "bg-amber-500", text: "text-amber-500", ring: "ring-amber-400" },
  { bg: "bg-rose-500", text: "text-rose-500", ring: "ring-rose-400" },
  { bg: "bg-cyan-500", text: "text-cyan-500", ring: "ring-cyan-400" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-500", ring: "ring-fuchsia-400" },
  { bg: "bg-lime-500", text: "text-lime-500", ring: "ring-lime-400" },
  { bg: "bg-orange-500", text: "text-orange-500", ring: "ring-orange-400" },
  { bg: "bg-sky-500", text: "text-sky-500", ring: "ring-sky-400" },
  { bg: "bg-pink-500", text: "text-pink-500", ring: "ring-pink-400" },
];

/** Colorful portfolio button matching desktop style */
function PortfolioButton({
  name,
  isSelected,
  colorIndex,
  onSelect,
  onLongPress,
}: {
  name: string;
  isSelected: boolean;
  colorIndex: number;
  onSelect: () => void;
  onLongPress?: () => void;
}) {
  const colors = PORTFOLIO_COLORS[colorIndex % PORTFOLIO_COLORS.length];

  const handleClick = () => {
    playClickSound();
    onSelect();
  };

  // Long press detection for mobile
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const handleTouchStart = () => {
    if (onLongPress) {
      pressTimer = setTimeout(() => {
        playClickSound();
        onLongPress();
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn(
        "w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 text-center",
        isSelected
          ? cn(
              colors.bg,
              "text-white shadow-lg ring-2 ring-offset-2 ring-offset-background scale-[1.02]",
              colors.ring
            )
          : cn(
              "bg-muted/30 border border-border/50",
              colors.text,
              "hover:bg-muted/50 active:scale-[0.98]"
            )
      )}
      style={isSelected ? {
        boxShadow: `0 8px 20px -4px rgba(0,0,0,0.3)`
      } : undefined}
    >
      {name}
    </button>
  );
}

/** Combined group button with colorful text like individual portfolios */
function CombinedGroupButton({
  name,
  isSelected,
  portfolioCount,
  colorIndex,
  onSelect,
  onLongPress,
}: {
  name: string;
  isSelected: boolean;
  portfolioCount: number;
  colorIndex: number;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const colors = PORTFOLIO_COLORS[colorIndex % PORTFOLIO_COLORS.length];

  // Long press detection for mobile
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const handleClick = () => {
    playClickSound();
    onSelect();
  };

  const handleTouchStart = () => {
    pressTimer = setTimeout(() => {
      playClickSound();
      onLongPress();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn(
        "w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 text-center",
        isSelected
          ? cn(
              colors.bg,
              "text-white shadow-lg ring-2 ring-offset-2 ring-offset-background scale-[1.02]",
              colors.ring
            )
          : cn(
              "bg-muted/30 border border-border/50",
              colors.text,
              "hover:bg-muted/50 active:scale-[0.98]"
            )
      )}
      style={isSelected ? {
        boxShadow: `0 8px 20px -4px rgba(0,0,0,0.3)`
      } : undefined}
    >
      {name} <span className={cn(
        "text-xs font-normal",
        isSelected ? "text-white/70" : "opacity-70"
      )}>({portfolioCount})</span>
    </button>
  );
}

/** Get initials from portfolio name */
function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== "string") return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

/** Full-page portfolio selection view for mobile - colorful 2-column grid */
export function MobilePortfoliosView() {
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio);
  const combinedGroups = usePortfolioStore((state) => state.combinedGroups);
  const addCombinedGroup = usePortfolioStore((state) => state.addCombinedGroup);
  const removeCombinedGroup = usePortfolioStore((state) => state.removeCombinedGroup);
  const canAccessCombinedGroup = usePortfolioStore((state) => state.canAccessCombinedGroup);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());
  const [deleteGroup, setDeleteGroup] = useState<{ id: string; name: string } | null>(null);

  const activeOwnerId = getActiveOwnerId();

  // Filter portfolios accessible by current owner
  const accessiblePortfolios = useMemo(() => {
    if (!activeOwnerId) return portfolios;
    return portfolios.filter(
      (p) => p.ownerIds && p.ownerIds.includes(activeOwnerId)
    );
  }, [portfolios, activeOwnerId]);

  // Filter combined groups to only show ones the user can access
  const visibleCombinedGroups = useMemo(() => {
    return combinedGroups.filter((group) => canAccessCombinedGroup(group.id));
  }, [combinedGroups, canAccessCombinedGroup]);

  // Get portfolio color by index
  const getPortfolioColor = (portfolioId: string) => {
    const index = accessiblePortfolios.findIndex((p) => p.id === portfolioId);
    return PORTFOLIO_COLORS[index >= 0 ? index % PORTFOLIO_COLORS.length : 0];
  };

  return (
    <div className="flex-1 overflow-y-auto pb-16">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Portfolios</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select a portfolio to view
        </p>
      </div>

      {/* Portfolio Grid - 2 columns */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* "+ Combine" Button - spans 2 columns, opens create dialog */}
          <button
            onClick={() => {
              playClickSound();
              setIsCreateOpen(true);
            }}
            className="col-span-2 w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 bg-muted/30 border border-dashed border-muted-foreground/30 text-fuchsia-500 hover:bg-muted/50 hover:border-fuchsia-400/50 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            Combine
          </button>

          {/* Existing Combined Groups (filtered by access) */}
          {visibleCombinedGroups.map((group, groupIndex) => {
            const groupPortfolios = accessiblePortfolios.filter(
              (p) => group.portfolioIds.includes(p.id)
            );
            // Offset color index by number of portfolios so combined groups get different colors
            const colorIndex = accessiblePortfolios.length + groupIndex;
            return (
              <CombinedGroupButton
                key={group.id}
                name={group.name}
                isSelected={activePortfolioId === group.id}
                portfolioCount={groupPortfolios.length}
                colorIndex={colorIndex}
                onSelect={() => setActivePortfolio(group.id)}
                onLongPress={() => setDeleteGroup({ id: group.id, name: group.name })}
              />
            );
          })}

          {/* Individual Portfolios */}
          {accessiblePortfolios.map((portfolio, index) => (
            <PortfolioButton
              key={portfolio.id}
              name={portfolio.name}
              isSelected={activePortfolioId === portfolio.id}
              colorIndex={index}
              onSelect={() => setActivePortfolio(portfolio.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {accessiblePortfolios.length === 0 && (
          <div className="text-center py-12 text-muted-foreground mt-4">
            <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No portfolios found</p>
            <p className="text-xs mt-1">Create portfolios from desktop</p>
          </div>
        )}

        {/* Hint for long press */}
        {visibleCombinedGroups.length > 0 && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            Long-press a combined view to delete
          </p>
        )}
      </div>

      {/* Create Combined Group Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setSelectedForCombine(new Set());
          }
        }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Create Combined View</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Select portfolios to combine into a new group
            </p>
          </DialogHeader>

          {/* Scrollable 2-column grid */}
          <div className="max-h-[50vh] overflow-y-auto mt-4 -mx-2 px-2">
            <div className="grid grid-cols-2 gap-2">
              {accessiblePortfolios.map((portfolio, index) => {
                const colors = PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length];
                const isSelected = selectedForCombine.has(portfolio.id);

                return (
                  <button
                    key={portfolio.id}
                    onClick={() => {
                      playClickSound();
                      const newSet = new Set(selectedForCombine);
                      if (isSelected) {
                        newSet.delete(portfolio.id);
                      } else {
                        newSet.add(portfolio.id);
                      }
                      setSelectedForCombine(newSet);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                      isSelected
                        ? "bg-primary/5 border-primary/30"
                        : "border-border/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="relative">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white",
                          colors.bg
                        )}
                      >
                        {getInitials(portfolio.name)}
                      </div>
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-medium text-center line-clamp-2",
                      colors.text
                    )}>
                      {portfolio.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedForCombine.size} of {accessiblePortfolios.length} selected
            </span>
            <button
              onClick={() => {
                playClickSound();
                setSelectedForCombine(new Set(accessiblePortfolios.map((p) => p.id)));
              }}
              className="text-sm text-primary hover:underline font-medium"
            >
              Select all
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={() => {
              if (selectedForCombine.size >= 2) {
                addCombinedGroup(Array.from(selectedForCombine));
                setSelectedForCombine(new Set());
                setIsCreateOpen(false);
                playClickSound();
              }
            }}
            disabled={selectedForCombine.size < 2}
            className={cn(
              "w-full mt-4 py-3 font-semibold rounded-xl shadow-lg transition-all",
              selectedForCombine.size >= 2
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-purple-500/30 active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Create Combined View
          </button>
        </DialogContent>
      </Dialog>

      {/* Delete Combined Group Confirmation Dialog */}
      <Dialog
        open={deleteGroup !== null}
        onOpenChange={(open) => !open && setDeleteGroup(null)}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Delete Combined View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteGroup?.name}&rdquo;? This only removes the combined view, not the underlying portfolios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteGroup(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteGroup) {
                  removeCombinedGroup(deleteGroup.id);
                  setDeleteGroup(null);
                  playClickSound();
                }
              }}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
