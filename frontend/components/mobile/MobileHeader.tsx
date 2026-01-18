"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyToggle } from "@/components/ui/currency-toggle";
import { MobileToggle } from "@/components/ui/mobile-toggle";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/audio";
import { COMBINED_PORTFOLIO_ID } from "@/types/portfolio";

// Same color palette as desktop PortfolioTabs for consistency
const PORTFOLIO_COLORS = [
  { bg: "bg-violet-500", ring: "ring-violet-300" },
  { bg: "bg-emerald-500", ring: "ring-emerald-300" },
  { bg: "bg-amber-500", ring: "ring-amber-300" },
  { bg: "bg-rose-500", ring: "ring-rose-300" },
  { bg: "bg-cyan-500", ring: "ring-cyan-300" },
  { bg: "bg-fuchsia-500", ring: "ring-fuchsia-300" },
  { bg: "bg-lime-500", ring: "ring-lime-300" },
  { bg: "bg-orange-500", ring: "ring-orange-300" },
  { bg: "bg-sky-500", ring: "ring-sky-300" },
  { bg: "bg-pink-500", ring: "ring-pink-300" },
];

interface MobileHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function MobileHeader({ onRefresh, isRefreshing }: MobileHeaderProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio);
  const getVisiblePortfolios = usePortfolioStore((state) => state.getVisiblePortfolios);
  const combinedGroups = usePortfolioStore((state) => state.combinedGroups);
  const addCombinedGroup = usePortfolioStore((state) => state.addCombinedGroup);
  const canAccessCombinedGroup = usePortfolioStore((state) => state.canAccessCombinedGroup);

  // Combine modal state
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());

  // Get portfolios filtered by active owner (handled internally by store)
  const portfolios = useMemo(() => {
    return getVisiblePortfolios();
  }, [getVisiblePortfolios]);

  // Filter combined groups to only show ones the user can access
  const visibleCombinedGroups = useMemo(() => {
    return combinedGroups.filter((group) => canAccessCombinedGroup(group.id));
  }, [combinedGroups, canAccessCombinedGroup]);

  // Handle portfolio selection
  const handlePortfolioSelect = (portfolioId: string) => {
    if (portfolioId !== activePortfolioId) {
      playClickSound();
      setActivePortfolio(portfolioId);
    }
  };

  // Handle opening combine modal
  const handleOpenCombine = () => {
    playClickSound();
    setSelectedForCombine(new Set());
    setShowCombineModal(true);
  };

  // Toggle portfolio selection for combining
  const togglePortfolioForCombine = (portfolioId: string) => {
    playClickSound();
    setSelectedForCombine((prev) => {
      const next = new Set(prev);
      if (next.has(portfolioId)) {
        next.delete(portfolioId);
      } else {
        next.add(portfolioId);
      }
      return next;
    });
  };

  // Create combined group
  const handleCreateCombined = () => {
    if (selectedForCombine.size < 2) return;
    playClickSound();
    addCombinedGroup(Array.from(selectedForCombine));
    setShowCombineModal(false);
    setSelectedForCombine(new Set());
  };

  return (
    <>
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center px-3 gap-2">
        {/* Portfolio Selector Circles (horizontally scrollable, scrollbar on hover) */}
        <div className="flex-1 overflow-x-auto scrollbar-hover-visible">
          <div className="flex items-center gap-2 py-1 px-1">
            {portfolios.map((portfolio, index) => {
              const colors = PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length];
              const isSelected = portfolio.id === activePortfolioId ||
                (activePortfolioId === COMBINED_PORTFOLIO_ID && index === 0);
              // First two letters: first uppercase, second lowercase
              const twoLetters = portfolio.name.length > 1
                ? portfolio.name.charAt(0).toUpperCase() + portfolio.name.charAt(1).toLowerCase()
                : portfolio.name.charAt(0).toUpperCase();

              return (
                <button
                  key={portfolio.id}
                  onClick={() => handlePortfolioSelect(portfolio.id)}
                  className={cn(
                    "h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all",
                    colors.bg,
                    isSelected && `ring-2 ring-offset-2 ring-offset-background ${colors.ring}`
                  )}
                  title={portfolio.name}
                >
                  {twoLetters}
                </button>
              );
            })}
            {/* Combined Groups (filtered by access) */}
            {visibleCombinedGroups.map((group) => {
              const isSelected = group.id === activePortfolioId;
              return (
                <button
                  key={group.id}
                  onClick={() => handlePortfolioSelect(group.id)}
                  className={cn(
                    "h-7 min-w-7 px-1.5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all bg-purple-500",
                    isSelected && "ring-2 ring-offset-2 ring-offset-background ring-purple-300"
                  )}
                  title={group.name}
                >
                  {group.name}
                </button>
              );
            })}
            {/* Combine (+) button */}
            <button
              onClick={handleOpenCombine}
              className="h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              title="Combine portfolios"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: Actions (fixed) */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {/* Refresh */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 w-9"
              title="Refresh data"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          )}

          {/* Currency Toggle */}
          <CurrencyToggle size="sm" />

          {/* Mobile/Desktop Toggle */}
          <MobileToggle size="sm" />
        </div>
      </div>

    </header>

      {/* Combine Portfolios Modal - rendered outside header for proper z-index */}
      {showCombineModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 pb-8 px-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCombineModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-background border border-border rounded-xl p-4 w-full max-w-sm shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Combine Portfolios</h3>
              <button
                onClick={() => setShowCombineModal(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Instructions */}
            <p className="text-sm text-muted-foreground mb-4">
              Tap portfolios to combine them into a single view.
            </p>

            {/* Portfolio Grid - 3 columns */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {portfolios.map((portfolio, index) => {
                const colors = PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length];
                const isSelected = selectedForCombine.has(portfolio.id);
                const firstLetter = portfolio.name.charAt(0).toUpperCase();

                return (
                  <button
                    key={portfolio.id}
                    onClick={() => togglePortfolioForCombine(portfolio.id)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white transition-all relative",
                        colors.bg,
                        isSelected && "ring-2 ring-offset-2 ring-offset-background ring-green-500"
                      )}
                    >
                      {firstLetter}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-full">
                      {portfolio.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Accept Button */}
            <Button
              onClick={handleCreateCombined}
              disabled={selectedForCombine.size < 2}
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              Combine ({selectedForCombine.size} selected)
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
