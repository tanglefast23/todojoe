"use client";

import { useCallback, useMemo } from "react";
import { Users, Layers, Crown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useOwnerStore } from "@/stores/ownerStore";
import { usePortfolioStore } from "@/stores/portfolioStore";

export function CombinedPortfolioPermissions() {
  const owners = useOwnerStore((state) => state.owners);

  const combinedGroups = usePortfolioStore((state) => state.combinedGroups);
  const addOwnerToCombinedGroup = usePortfolioStore((state) => state.addOwnerToCombinedGroup);
  const removeOwnerFromCombinedGroup = usePortfolioStore((state) => state.removeOwnerFromCombinedGroup);
  const portfolios = usePortfolioStore((state) => state.portfolios);

  // Get portfolio name from ID
  const getPortfolioName = useCallback((portfolioId: string) => {
    return portfolios.find((p) => p.id === portfolioId)?.name || "Unknown";
  }, [portfolios]);

  // Generate display name for combined group (full names)
  const getGroupDisplayName = useCallback((group: { portfolioIds: string[] }) => {
    return group.portfolioIds
      .map((id) => getPortfolioName(id))
      .join(" + ");
  }, [getPortfolioName]);

  // Get owner name from ID
  const getOwnerName = useCallback((ownerId: string) => {
    return owners.find((o) => o.id === ownerId)?.name || "Unknown";
  }, [owners]);

  // Check if owner has access to combined group
  const hasAccess = useCallback((groupId: string, ownerId: string) => {
    const group = combinedGroups.find((g) => g.id === groupId);
    if (!group) return false;

    // Check if owner is in allowed list OR is the creator
    return group.creatorOwnerId === ownerId || group.allowedOwnerIds?.includes(ownerId) || false;
  }, [combinedGroups]);

  // Check if owner is the creator
  const isCreator = useCallback((groupId: string, ownerId: string) => {
    const group = combinedGroups.find((g) => g.id === groupId);
    return group?.creatorOwnerId === ownerId;
  }, [combinedGroups]);

  // Toggle access for an owner to a combined group
  const toggleAccess = useCallback((groupId: string, ownerId: string, currentlyHasAccess: boolean) => {
    // Don't allow removing creator access via this UI
    if (isCreator(groupId, ownerId)) return;

    if (currentlyHasAccess) {
      removeOwnerFromCombinedGroup(groupId, ownerId);
    } else {
      addOwnerToCombinedGroup(groupId, ownerId);
    }
  }, [addOwnerToCombinedGroup, removeOwnerFromCombinedGroup, isCreator]);

  // Count combined groups each owner can access
  const getOwnerGroupCount = useCallback((ownerId: string) => {
    return combinedGroups.filter((g) =>
      g.creatorOwnerId === ownerId || g.allowedOwnerIds?.includes(ownerId)
    ).length;
  }, [combinedGroups]);

  // Don't show if no combined groups or no owners
  if (combinedGroups.length === 0 || owners.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Combined Portfolio Access
        </CardTitle>
        <CardDescription>
          Control which owners can view combined portfolio groups. The creator and master account always have access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Note */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Access Rules</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>• <Crown className="inline h-3 w-3 text-amber-500" /> Creator automatically has access (shown with crown)</li>
            <li>• Master account can always view all combined portfolios</li>
            <li>• Additional owners can be granted access below</li>
          </ul>
        </div>

        {/* Combined Groups Header Row */}
        <div className="flex items-end gap-3 pl-[180px] pr-[40px]">
          {combinedGroups.map((group) => (
            <div
              key={group.id}
              className="flex-1 min-w-[80px] max-w-[120px] text-center"
            >
              <p className="text-xs text-muted-foreground font-medium truncate px-1" title={getGroupDisplayName(group)}>
                {group.name}
              </p>
              <p className="text-[10px] text-muted-foreground/60 truncate px-1">
                {getGroupDisplayName(group)}
              </p>
            </div>
          ))}
        </div>

        {/* Owner Rows */}
        <div className="space-y-2">
          {owners.map((owner) => {
            const groupCount = getOwnerGroupCount(owner.id);

            return (
              <div
                key={owner.id}
                className={cn(
                  "rounded-xl border transition-all duration-200",
                  owner.isMaster ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/20 border-border/50"
                )}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Owner Info */}
                  <div className="flex items-center gap-3 w-[160px] shrink-0">
                    <Users className={cn("h-5 w-5", owner.isMaster ? "text-amber-500" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{owner.name}</span>
                        {owner.isMaster && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                            Master
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {owner.isMaster ? "All groups" : `${groupCount} group${groupCount !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>

                  {/* Combined Group Access Indicators */}
                  <div className="flex items-center gap-3 flex-1">
                    {combinedGroups.map((group) => {
                      const ownerHasAccess = hasAccess(group.id, owner.id);
                      const ownerIsCreator = isCreator(group.id, owner.id);
                      const isMaster = owner.isMaster;

                      return (
                        <div
                          key={group.id}
                          className="flex-1 min-w-[80px] max-w-[120px] flex justify-center"
                        >
                          <button
                            onClick={() => !isMaster && toggleAccess(group.id, owner.id, ownerHasAccess)}
                            disabled={isMaster} // Master always has access, can't toggle
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center relative",
                              isMaster
                                ? "bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/30 cursor-default"
                                : ownerHasAccess
                                  ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                                  : "bg-transparent border-muted-foreground/30 hover:border-muted-foreground/50"
                            )}
                            title={
                              isMaster
                                ? `${owner.name} has master access to all groups`
                                : ownerIsCreator
                                  ? `${owner.name} created this group (always has access)`
                                  : ownerHasAccess
                                    ? `Remove ${owner.name}'s access to ${group.name}`
                                    : `Give ${owner.name} access to ${group.name}`
                            }
                          >
                            {(ownerHasAccess || isMaster) && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                            {/* Crown indicator for creator */}
                            {ownerIsCreator && !isMaster && (
                              <Crown className="absolute -top-2 -right-2 h-3 w-3 text-amber-500" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Has access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
            <span>No access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Master (all access)</span>
          </div>
          <div className="flex items-center gap-2">
            <Crown className="h-3 w-3 text-amber-500" />
            <span>Creator</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
