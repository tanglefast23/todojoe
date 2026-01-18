"use client";

import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TagFilterDropdownProps {
  allTags: string[];
  activeFilters: string[];
  onToggleFilter: (tag: string) => void;
  onClearFilters: () => void;
}

export function TagFilterDropdown({
  allTags,
  activeFilters,
  onToggleFilter,
  onClearFilters,
}: TagFilterDropdownProps) {
  // Defer dropdown render until after mount to avoid Radix hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || allTags.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs transition-colors",
            activeFilters.length > 0 &&
              "bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400"
          )}
        >
          <Filter className="w-3 h-3 mr-1" />
          Filter
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {activeFilters.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Filter by Tag</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allTags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag}
            checked={activeFilters.includes(tag)}
            onCheckedChange={() => onToggleFilter(tag)}
            className="text-xs"
          >
            {tag}
          </DropdownMenuCheckboxItem>
        ))}
        {activeFilters.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={onClearFilters}
              className="text-xs text-muted-foreground"
            >
              Clear filters
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
