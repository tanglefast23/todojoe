"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, Check, Trash2, Pencil, Shield, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { COMBINED_PORTFOLIO_ID } from "@/types/portfolio";
import { AssignOwnerDialog } from "./AssignOwnerDialog";
import { playClickSound } from "@/lib/audio";

// Vibrant color palette for portfolio tabs
const PORTFOLIO_COLORS = [
  { bg: "bg-violet-500", hover: "hover:bg-violet-400", ring: "ring-violet-400", text: "text-violet-500" },
  { bg: "bg-emerald-500", hover: "hover:bg-emerald-400", ring: "ring-emerald-400", text: "text-emerald-500" },
  { bg: "bg-amber-500", hover: "hover:bg-amber-400", ring: "ring-amber-400", text: "text-amber-500" },
  { bg: "bg-rose-500", hover: "hover:bg-rose-400", ring: "ring-rose-400", text: "text-rose-500" },
  { bg: "bg-cyan-500", hover: "hover:bg-cyan-400", ring: "ring-cyan-400", text: "text-cyan-500" },
  { bg: "bg-fuchsia-500", hover: "hover:bg-fuchsia-400", ring: "ring-fuchsia-400", text: "text-fuchsia-500" },
  { bg: "bg-lime-500", hover: "hover:bg-lime-400", ring: "ring-lime-400", text: "text-lime-500" },
  { bg: "bg-orange-500", hover: "hover:bg-orange-400", ring: "ring-orange-400", text: "text-orange-500" },
  { bg: "bg-sky-500", hover: "hover:bg-sky-400", ring: "ring-sky-400", text: "text-sky-500" },
  { bg: "bg-pink-500", hover: "hover:bg-pink-400", ring: "ring-pink-400", text: "text-pink-500" },
];

export function PortfolioTabs() {
  const {
    activePortfolioId,
    setActivePortfolio,
    addPortfolio,
    renamePortfolio,
    deletePortfolio,
    getVisiblePortfolios,
    reorderPortfolios,
    combinedGroups,
    addCombinedGroup,
    removeCombinedGroup,
    canAccessCombinedGroup,
  } = usePortfolioStore();

  const { owners, isMasterLoggedIn } = useOwnerStore();

  // Build owner Map for O(1) lookups instead of O(n) Array.find()
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);

  // Hydration-safe: wait for mount to get accurate visible portfolios
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Get visible portfolios based on logged-in user
  const visiblePortfolios = isMounted ? getVisiblePortfolios() : [];

  // Filter combined groups to only show ones the user can access
  const visibleCombinedGroups = useMemo(() => {
    if (!isMounted) return [];
    return combinedGroups.filter((group) => canAccessCombinedGroup(group.id));
  }, [isMounted, combinedGroups, canAccessCombinedGroup]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [isCombinedSettingsOpen, setIsCombinedSettingsOpen] = useState(false);
  // Track selected portfolios when creating a new combined group
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());
  // Track combined group being deleted
  const [deleteCombinedGroup, setDeleteCombinedGroup] = useState<{ id: string; name: string } | null>(null);

  // Assign owner dialog state (only for master users)
  const [assignOwnerPortfolio, setAssignOwnerPortfolio] = useState<{ id: string; name: string } | null>(null);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmPortfolio, setDeleteConfirmPortfolio] = useState<{ id: string; name: string } | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder portfolios
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = visiblePortfolios.findIndex((p) => p.id === active.id);
        const newIndex = visiblePortfolios.findIndex((p) => p.id === over.id);
        const reordered = arrayMove(visiblePortfolios, oldIndex, newIndex);
        reorderPortfolios(reordered.map((p) => p.id));
        playClickSound();
      }
    },
    [visiblePortfolios, reorderPortfolios]
  );

  // Get owner names for a portfolio (for tooltip) - O(1) lookups via ownerMap
  const getPortfolioOwnerNames = useCallback((portfolioOwnerIds?: string[]) => {
    if (!portfolioOwnerIds || portfolioOwnerIds.length === 0) return "Public";
    return portfolioOwnerIds
      .map((id) => ownerMap.get(id)?.name)
      .filter(Boolean)
      .join(", ");
  }, [ownerMap]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingPortfolioId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPortfolioId]);

  const startEditing = (portfolioId: string, currentName: string) => {
    setEditingPortfolioId(portfolioId);
    setEditValue(currentName);
  };

  const saveEdit = () => {
    if (editingPortfolioId && editValue.trim()) {
      renamePortfolio(editingPortfolioId, editValue.trim());
    }
    setEditingPortfolioId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingPortfolioId(null);
    setEditValue("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleAddPortfolio = () => {
    if (newPortfolioName.trim()) {
      // Support comma-separated names for creating multiple portfolios
      const names = newPortfolioName
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      let lastId = "";
      names.forEach((name) => {
        lastId = addPortfolio(name);
      });

      // Switch to the last created portfolio
      if (lastId) {
        setActivePortfolio(lastId);
      }

      setNewPortfolioName("");
      setIsAddDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddPortfolio();
    }
  };

  // Get initials for mini avatars (with defensive checks)
  const getInitials = (name: string | undefined | null) => {
    if (!name || typeof name !== "string") return "?";
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed
      .split(" ")
      .map((n) => n[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  };

  // Get color for portfolio by finding its index
  const getPortfolioColor = (portfolioId: string) => {
    const index = visiblePortfolios.findIndex((p) => p.id === portfolioId);
    return PORTFOLIO_COLORS[index >= 0 ? index % PORTFOLIO_COLORS.length : 0];
  };

  const handleDeletePortfolio = (portfolioId: string) => {
    deletePortfolio(portfolioId);
    setDeleteConfirmPortfolio(null);
  };

  // Check if current user is master (can assign owners)
  const canAssignOwners = isMounted && isMasterLoggedIn();

  return (
    <div className="flex items-center gap-2">
      {/* Tab List */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/30 backdrop-blur-sm">
        {/* "Combined" Button - Opens popover to CREATE new combined groups */}
        <Popover
          open={isCombinedSettingsOpen}
          onOpenChange={(open) => {
            setIsCombinedSettingsOpen(open);
            // Reset selection when closing without creating
            if (!open) {
              setSelectedForCombine(new Set());
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              onClick={() => playClickSound()}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                "border border-dashed border-muted-foreground/30 hover:border-purple-400/50"
              )}
            >
              + Combine
            </button>
          </PopoverTrigger>

          {/* Portfolio picker popover for creating new combined group */}
          <PopoverContent className="w-72 p-4" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">Create Combined View</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Select portfolios to combine into a new group
                </p>
              </div>

              <div className="space-y-2">
                {visiblePortfolios.map((portfolio) => {
                  const colors = getPortfolioColor(portfolio.id);
                  const isSelected = selectedForCombine.has(portfolio.id);

                  return (
                    <button
                      key={portfolio.id}
                      onClick={() => {
                        const newSet = new Set(selectedForCombine);
                        if (isSelected) {
                          newSet.delete(portfolio.id);
                        } else {
                          newSet.add(portfolio.id);
                        }
                        setSelectedForCombine(newSet);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "border-transparent hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          colors.bg
                        )}
                      >
                        {getInitials(portfolio.name)}
                      </div>
                      <span className="flex-1 text-left text-sm font-medium">
                        {portfolio.name}
                      </span>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {selectedForCombine.size} of {visiblePortfolios.length} selected
                </span>
                <button
                  onClick={() => {
                    setSelectedForCombine(new Set(visiblePortfolios.map((p) => p.id)));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Select all
                </button>
              </div>

              {/* Create button */}
              <Button
                onClick={() => {
                  if (selectedForCombine.size >= 2) {
                    addCombinedGroup(Array.from(selectedForCombine));
                    setSelectedForCombine(new Set());
                    setIsCombinedSettingsOpen(false);
                    playClickSound();
                  }
                }}
                disabled={selectedForCombine.size < 2}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600"
              >
                Create Combined View
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Existing Combined Groups - rendered as selectable buttons (filtered by access) */}
        {visibleCombinedGroups.map((group) => {
          const isActive = activePortfolioId === group.id;

          // Long-press detection for both mouse and touch
          let pressTimer: ReturnType<typeof setTimeout> | null = null;
          let didLongPress = false;

          const handlePressStart = () => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
              didLongPress = true;
              playClickSound();
              setDeleteCombinedGroup({ id: group.id, name: group.name });
            }, 500);
          };

          const handlePressEnd = () => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
          };

          const handleClick = () => {
            if (!didLongPress) {
              playClickSound();
              setActivePortfolio(group.id);
            }
          };

          return (
            <ContextMenu key={group.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={handleClick}
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  onTouchCancel={handlePressEnd}
                  className={cn(
                    "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/50 scale-105"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {group.name}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem
                  onClick={() => setDeleteCombinedGroup({ id: group.id, name: group.name })}
                  className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Combined View
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Individual Portfolio Tabs */}
        {visiblePortfolios.map((portfolio, index) => {
          const colorScheme = PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length];
          const isActive = activePortfolioId === portfolio.id;
          const canDelete = visiblePortfolios.length > 1;
          const ownerNames = getPortfolioOwnerNames(portfolio.ownerIds);

          return editingPortfolioId === portfolio.id ? (
            <input
              key={portfolio.id}
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={saveEdit}
              className={cn(
                "px-3 py-1.5 text-sm font-semibold rounded-lg transition-all",
                colorScheme.bg,
                "text-white border-2 border-white/30 outline-none",
                "min-w-[80px] w-auto"
              )}
              style={{ width: `${Math.max(editValue.length * 8 + 20, 80)}px` }}
            />
          ) : (
            <ContextMenu key={portfolio.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => {
                    playClickSound();
                    setActivePortfolio(portfolio.id);
                  }}
                  onDoubleClick={() => startEditing(portfolio.id, portfolio.name)}
                  className={cn(
                    "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                    isActive
                      ? cn(
                          colorScheme.bg,
                          "text-white shadow-lg ring-2 ring-offset-1 ring-offset-background scale-105",
                          colorScheme.ring
                        )
                      : cn(
                          "text-muted-foreground",
                          "hover:text-foreground",
                          `hover:${colorScheme.bg}/20`,
                          "border border-transparent hover:border-current/20"
                        )
                  )}
                  style={isActive ? {
                    boxShadow: `0 4px 14px -2px var(--tw-shadow-color, rgba(0,0,0,0.25))`
                  } : undefined}
                  title={`Owned by: ${ownerNames}`}
                >
                  <span className={cn(
                    !isActive && colorScheme.text,
                    !isActive && "font-medium"
                  )}>
                    {portfolio.name}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem
                  onClick={() => startEditing(portfolio.id, portfolio.name)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </ContextMenuItem>
                {canAssignOwners && (
                  <ContextMenuItem
                    onClick={() => setAssignOwnerPortfolio({ id: portfolio.id, name: portfolio.name })}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Assign Owners
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => setDeleteConfirmPortfolio({ id: portfolio.id, name: portfolio.name })}
                  className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                  disabled={!canDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Portfolio
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {/* Delete Portfolio Confirmation Dialog */}
      <Dialog
        open={deleteConfirmPortfolio !== null}
        onOpenChange={(open) => !open && setDeleteConfirmPortfolio(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Portfolio</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirmPortfolio?.name}&rdquo;? This will permanently remove all holdings and transaction history for this portfolio. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmPortfolio(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmPortfolio && handleDeletePortfolio(deleteConfirmPortfolio.id)}
            >
              Delete Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Combined Group Confirmation Dialog */}
      <Dialog
        open={deleteCombinedGroup !== null}
        onOpenChange={(open) => !open && setDeleteCombinedGroup(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Combined View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the combined view &ldquo;{deleteCombinedGroup?.name}&rdquo;? This only removes the combined view, not the underlying portfolios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCombinedGroup(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteCombinedGroup) {
                  removeCombinedGroup(deleteCombinedGroup.id);
                  setDeleteCombinedGroup(null);
                  playClickSound();
                }
              }}
            >
              Delete Combined View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Portfolio Button */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Portfolio</DialogTitle>
            <DialogDescription>
              Add portfolios to track separate sets of investments. Use commas to create multiple at once.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="portfolio-name" className="text-sm font-medium">
              Portfolio Name
            </Label>
            <Input
              id="portfolio-name"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Retirement, Trading, Long-term (comma-separated)"
              className="mt-2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPortfolio}
              disabled={newPortfolioName.trim().length === 0}
            >
              Create Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Owner Dialog (Master only) */}
      {assignOwnerPortfolio && (
        <AssignOwnerDialog
          portfolioId={assignOwnerPortfolio.id}
          portfolioName={assignOwnerPortfolio.name}
          open={!!assignOwnerPortfolio}
          onOpenChange={(open) => !open && setAssignOwnerPortfolio(null)}
        />
      )}
    </div>
  );
}
