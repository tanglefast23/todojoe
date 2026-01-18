"use client";

import { memo, useEffect } from "react";
import { TrendingDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSellPlanFlow } from "@/hooks/useSellPlanFlow";
import {
  SymbolSelector,
  PercentageInput,
  AccountAllocator,
  BuyAllocator,
} from "./sell-planning";

/**
 * SellPlanningWidget - A step-based wizard for planning sell orders
 *
 * Flow: idle → symbol → percentage → accounts → buySymbolsForAccount → buyAllocationForAccount
 *
 * This component orchestrates the sell planning flow using the useSellPlanFlow hook
 * for state management and sub-components for each step's UI.
 */
export const SellPlanningWidget = memo(function SellPlanningWidget() {
  const flow = useSellPlanFlow();

  // Keyboard shortcut: "s" to start a new sell plan when idle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger when in idle state and not typing in an input
      if (flow.step !== "idle") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // "s" key to start sell
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        flow.handleNewPlan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flow.step, flow.handleNewPlan]);

  // Return consistent empty state during SSR and initial mount
  if (!flow.mounted || flow.symbols.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <TrendingDown className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">No holdings to plan</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add some holdings in the Portfolio page first
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show message when in the legacy "combined" view (not custom combined groups)
  // Custom combined groups (like "D/K") are allowed - portfolioId is resolved from accounts
  if (flow.activePortfolioId === "combined" || !flow.activePortfolioId) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-amber-500/10 p-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">Combined Portfolio View</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You&apos;re in combined portfolio. Select a single portfolio for Sell Plans.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden tablet-compact-widget">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-muted/30">
        <h3 className="text-lg font-semibold">Sell Planning</h3>
        <p className="text-sm text-muted-foreground">
          Calculate how much to sell based on a percentage of your total portfolio
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Step: Idle - Show Sell Button */}
        {flow.step === "idle" && (
          <div className="flex flex-col items-center gap-6 py-12 tablet-compact-empty">
            <Button
              size="lg"
              variant="destructive"
              className="px-12 py-8 text-xl font-semibold"
              onClick={flow.handleNewPlan}
              disabled={flow.isLoading}
            >
              <TrendingDown className="h-6 w-6 mr-3" />
              Sell
            </Button>
            <p className="text-sm text-muted-foreground">
              Click or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">S</kbd> to start planning a sell order
            </p>
          </div>
        )}

        {/* Step: Symbol Input */}
        {flow.step === "symbol" && (
          <SymbolSelector
            symbolInput={flow.symbolInput}
            showAutocomplete={flow.showAutocomplete}
            filteredSymbols={flow.filteredSymbols}
            totals={flow.totals}
            priceMap={flow.priceMap}
            error={flow.error}
            symbolInputRef={flow.symbolInputRef}
            onSymbolChange={flow.handleSymbolChange}
            onSymbolSelect={flow.handleSymbolSelect}
            onSymbolKeyDown={flow.handleSymbolKeyDown}
            onFocus={() => flow.setShowAutocomplete(true)}
            getPlainSymbol={flow.getPlainSymbol}
          />
        )}

        {/* Step: Percentage Input */}
        {flow.step === "percentage" && flow.selectedSymbol && (
          <PercentageInput
            selectedSymbol={flow.selectedSymbol}
            selectedPlainSymbol={flow.selectedPlainSymbol}
            priceMap={flow.priceMap}
            totals={flow.totals}
            totalPortfolioValue={flow.totalPortfolioValue}
            percentageInput={flow.percentageInput}
            error={flow.error}
            percentageInputRef={flow.percentageInputRef}
            onPercentageChange={(value) => flow.setPercentageInput(value)}
            onPercentageConfirm={flow.handlePercentageConfirm}
            onSellAll={flow.handleSellAll}
            onPercentageKeyDown={flow.handlePercentageKeyDown}
            formatShares={flow.formatShares}
            roundShares={flow.roundShares}
          />
        )}

        {/* Step: Account Selection */}
        {flow.step === "accounts" && flow.selectedSymbol && (
          <AccountAllocator
            selectedSymbol={flow.selectedSymbol}
            percentageInput={flow.percentageInput}
            accountAllocations={flow.accountAllocations}
            neededShares={flow.neededShares}
            totalAllocated={flow.totalAllocated}
            remaining={flow.remaining}
            error={flow.error}
            onAllocationChange={flow.handleAllocationChange}
            onAutoFill={flow.handleAutoFill}
            onAllocationKeyDown={flow.handleAllocationKeyDown}
            onAccountsConfirm={flow.handleAccountsConfirm}
            onCancel={flow.handleCancel}
            formatShares={flow.formatShares}
            isCrypto={flow.isCrypto}
          />
        )}

        {/* Step: Buy Symbol Input for Current Account */}
        {flow.step === "buySymbolsForAccount" &&
          flow.selectedSymbol &&
          flow.currentSellingAccount && (
            <BuyAllocator
              mode="symbols"
              selectedSymbol={flow.selectedSymbol}
              selectedPlainSymbol={flow.selectedPlainSymbol}
              percentageInput={flow.percentageInput}
              sellingAccounts={flow.sellingAccounts}
              currentAccountIndex={flow.currentAccountIndex}
              currentSellingAccount={flow.currentSellingAccount}
              currentAccountBuySymbolsList={flow.currentAccountBuySymbolsList}
              buySymbolInput={flow.buySymbolInput}
              showBuyAutocomplete={flow.showBuyAutocomplete}
              filteredBuySymbols={flow.filteredBuySymbols}
              totals={flow.totals}
              priceMap={flow.priceMap}
              error={flow.error}
              buySymbolInputRef={flow.buySymbolInputRef}
              onBuySymbolChange={flow.handleBuySymbolChange}
              onBuySymbolSelect={flow.handleBuySymbolSelectForAccount}
              onBuySymbolKeyDown={flow.handleBuySymbolKeyDown}
              onRemoveBuySymbol={flow.handleRemoveBuySymbol}
              onFocus={() => flow.setShowBuyAutocomplete(true)}
              onCancel={flow.handleCancel}
              formatShares={flow.formatShares}
            />
          )}

        {/* Step: Buy Allocation for Current Account */}
        {flow.step === "buyAllocationForAccount" &&
          flow.selectedSymbol &&
          flow.currentSellingAccount && (
            <BuyAllocator
              mode="percentages"
              selectedSymbol={flow.selectedSymbol}
              selectedPlainSymbol={flow.selectedPlainSymbol}
              percentageInput={flow.percentageInput}
              sellingAccounts={flow.sellingAccounts}
              currentAccountIndex={flow.currentAccountIndex}
              currentSellingAccount={flow.currentSellingAccount}
              currentAccountBuySymbolsList={flow.currentAccountBuySymbolsList}
              currentAccountBuyPercentagesMap={flow.currentAccountBuyPercentagesMap}
              currentAccountTotalBuyPercentage={flow.currentAccountTotalBuyPercentage}
              priceMap={flow.priceMap}
              error={flow.error}
              onBuyPercentageChange={flow.handleBuyPercentageChange}
              onBuyPercentageKeyDown={flow.handleBuyPercentageKeyDown}
              onBuyAllocationConfirm={flow.handleBuyAllocationConfirmForAccount}
              onCancel={flow.handleCancel}
            />
          )}
      </div>
    </div>
  );
});
