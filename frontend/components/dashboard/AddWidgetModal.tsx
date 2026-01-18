"use client";

import { useState } from "react";
import {
  CreditCard,
  List,
  LineChart,
  BarChart3,
  PieChart,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import type { WidgetType, WidgetConfig } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface WidgetOption {
  type: WidgetType;
  name: string;
  description: string;
  icon: React.ElementType;
  requiresSymbol: boolean;
  requiresSymbols: boolean;
}

const WIDGET_OPTIONS: WidgetOption[] = [
  {
    type: "asset-card",
    name: "Asset Card",
    description: "Single asset with price and change",
    icon: CreditCard,
    requiresSymbol: true,
    requiresSymbols: false,
  },
  {
    type: "watchlist",
    name: "Watchlist",
    description: "Multiple assets in a compact list",
    icon: List,
    requiresSymbol: false,
    requiresSymbols: true,
  },
  {
    type: "chart",
    name: "Price Chart",
    description: "Historical price line chart",
    icon: LineChart,
    requiresSymbol: true,
    requiresSymbols: false,
  },
  {
    type: "quick-stats",
    name: "Quick Stats",
    description: "Portfolio summary at a glance",
    icon: BarChart3,
    requiresSymbol: false,
    requiresSymbols: false,
  },
  {
    type: "allocation-pie",
    name: "Allocation Pie",
    description: "Portfolio allocation breakdown",
    icon: PieChart,
    requiresSymbol: false,
    requiresSymbols: false,
  },
];

const PRESET_WATCHLISTS = [
  { name: "Tech Giants", symbols: ["AAPL", "GOOGL", "MSFT", "AMZN", "META"] },
  { name: "Top Crypto", symbols: ["BTC", "ETH", "SOL", "XRP", "ADA"] },
  { name: "EV Sector", symbols: ["TSLA", "RIVN", "LCID", "NIO", "F"] },
];

export function AddWidgetModal() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [symbol, setSymbol] = useState("");
  const [symbols, setSymbols] = useState("");
  const [assetType, setAssetType] = useState<"stock" | "crypto">("stock");
  const [timeRange, setTimeRange] = useState("1M");

  const addWidget = useDashboardStore((state) => state.addWidget);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const combinedGroups = usePortfolioStore((state) => state.combinedGroups);

  // Check if current view is a combined view (not a real portfolio)
  const isCombinedView = activePortfolioId === "combined" ||
    combinedGroups.some((g) => g.id === activePortfolioId);

  // Get the actual portfolio ID to use for widgets
  // If in combined view, use the first portfolio from the group or first available portfolio
  const getTargetPortfolioId = (): string => {
    if (!isCombinedView) {
      return activePortfolioId;
    }
    // Find the combined group
    const group = combinedGroups.find((g) => g.id === activePortfolioId);
    if (group && group.portfolioIds.length > 0) {
      return group.portfolioIds[0]; // Use first portfolio in the group
    }
    // Fallback to first available portfolio
    return portfolios[0]?.id || "default";
  };

  const handleSelectWidget = (type: WidgetType) => {
    setSelectedType(type);
    setSymbol("");
    setSymbols("");
  };

  const handleAddWidget = () => {
    if (!selectedType) return;

    const option = WIDGET_OPTIONS.find((o) => o.type === selectedType);
    if (!option) return;

    // Validate required fields
    if (option.requiresSymbol && !symbol.trim()) return;
    if (option.requiresSymbols && !symbols.trim()) return;

    const config: WidgetConfig = {};

    if (option.requiresSymbol) {
      config.symbol = symbol.toUpperCase().trim();
    }

    if (option.requiresSymbols) {
      const symbolList = symbols
        .split(",")
        .map((s) => s.toUpperCase().trim())
        .filter(Boolean);
      config.symbols = symbolList;
      // Each watchlist widget now tracks its own symbols in config.symbols
      // No need to add to portfolio-level watchlist
    }

    if (selectedType === "chart") {
      config.timeRange = timeRange;
    }

    const targetPortfolioId = getTargetPortfolioId();
    console.log("[AddWidget] Adding widget:", { selectedType, targetPortfolioId, activePortfolioId, isCombinedView });
    addWidget(targetPortfolioId, selectedType, config);
    setOpen(false);
    setSelectedType(null);
    setSymbol("");
    setSymbols("");
  };

  const handlePresetSelect = (preset: { name: string; symbols: string[] }) => {
    setSymbols(preset.symbols.join(", "));
  };

  const selectedOption = WIDGET_OPTIONS.find((o) => o.type === selectedType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard.
          </DialogDescription>
        </DialogHeader>

        {!selectedType ? (
          // Widget Selection Grid
          <div className="grid grid-cols-2 gap-3 py-4">
            {WIDGET_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.type}
                  onClick={() => handleSelectWidget(option.type)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                    "hover:border-primary hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{option.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          // Configuration Form
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              {selectedOption && (
                <>
                  <selectedOption.icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{selectedOption.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOption.description}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Symbol input for single asset widgets */}
            {selectedOption?.requiresSymbol && (
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <div className="flex gap-2">
                  <Input
                    id="symbol"
                    placeholder="e.g., AAPL, BTC, TSLA"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && symbol.trim()) {
                        e.preventDefault();
                        handleAddWidget();
                      }
                    }}
                    className="flex-1"
                  />
                  {selectedType === "asset-card" && (
                    <Select
                      value={assetType}
                      onValueChange={(v) => setAssetType(v as "stock" | "crypto")}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Symbols input for watchlist */}
            {selectedOption?.requiresSymbols && (
              <div className="space-y-2">
                <Label htmlFor="symbols">Symbols (comma-separated)</Label>
                <Input
                  id="symbols"
                  placeholder="e.g., AAPL, GOOGL, MSFT, BTC, ETH"
                  value={symbols}
                  onChange={(e) => setSymbols(e.target.value)}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && symbols.trim()) {
                      e.preventDefault();
                      handleAddWidget();
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Presets:</span>
                  {PRESET_WATCHLISTS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handlePresetSelect(preset)}
                      className="text-xs text-primary hover:underline"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time range for chart widget */}
            {selectedType === "chart" && (
              <div className="space-y-2">
                <Label htmlFor="time-range">Default Time Range</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="time-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1D">1 Day</SelectItem>
                    <SelectItem value="1W">1 Week</SelectItem>
                    <SelectItem value="1M">1 Month</SelectItem>
                    <SelectItem value="3M">3 Months</SelectItem>
                    <SelectItem value="6M">6 Months</SelectItem>
                    <SelectItem value="1Y">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedType(null)}>
                Back
              </Button>
              <Button
                onClick={handleAddWidget}
                disabled={
                  (selectedOption?.requiresSymbol && !symbol.trim()) ||
                  (selectedOption?.requiresSymbols && !symbols.trim())
                }
              >
                Add Widget
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
