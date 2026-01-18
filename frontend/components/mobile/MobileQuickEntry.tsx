"use client";

/**
 * Mobile Quick Entry - Tap-based transaction entry
 * Shows assets grouped by account as tappable pills
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useFormatters } from "@/hooks/useFormatters";
import { cn } from "@/lib/utils";
import { fetchQuote } from "@/lib/quoteUtils";
import { detectAssetType, parseSymbolKey } from "@/lib/assetUtils";
import {
  MobileBottomSheet,
  MobileSheetHeader,
  AssetTypeSelector,
  TotalPreview,
} from "./MobileBottomSheet";
import type { AssetType, TransactionType } from "@/types/portfolio";
import { COMBINED_PORTFOLIO_ID } from "@/types/portfolio";

interface SelectedAsset {
  symbolKey: string;   // Full key with suffix (NNE-stock)
  symbol: string;      // Clean symbol for display/API (NNE)
  assetType: AssetType;
  accountId: string;
  accountName: string;
}

type AssetTypeOption = "auto" | "stock" | "crypto";

export function MobileQuickEntry() {
  const { formatCurrency } = useFormatters();

  // Store access
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const getQuickOverviewGrid = usePortfolioStore((state) => state.getQuickOverviewGrid);
  const addTransaction = usePortfolioStore((state) => state.addTransaction);

  // Get target portfolio
  const targetPortfolioId = activePortfolioId === COMBINED_PORTFOLIO_ID
    ? portfolios[0]?.id || "default"
    : activePortfolioId;

  // Get grid data (symbols grouped by account)
  const gridData = useMemo(() => {
    return getQuickOverviewGrid(targetPortfolioId);
  }, [getQuickOverviewGrid, targetPortfolioId]);

  // Modal state
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [manualPrice, setManualPrice] = useState(""); // Fallback when API fails
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Buy New modal state
  const [showBuyNew, setShowBuyNew] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newAssetTypeOption, setNewAssetTypeOption] = useState<AssetTypeOption>("auto");
  const [newQuantity, setNewQuantity] = useState("");
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [newManualPrice, setNewManualPrice] = useState("");
  const [newIsFetchingPrice, setNewIsFetchingPrice] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Fetch current price when asset is selected using shared utility
  const fetchPrice = useCallback(async (symbol: string, assetType: AssetType) => {
    if (!symbol) return;

    setIsFetchingPrice(true);
    setCurrentPrice(null);

    try {
      const result = await fetchQuote(symbol, assetType);
      setCurrentPrice(result.price);
    } catch {
      // Both failed - user can enter price manually
      setCurrentPrice(null);
    } finally {
      setIsFetchingPrice(false);
    }
  }, []);

  // When asset is selected, fetch price
  useEffect(() => {
    if (selectedAsset) {
      fetchPrice(selectedAsset.symbol, selectedAsset.assetType);
      setQuantity("");
      setManualPrice("");
      setTransactionType("buy");
    }
  }, [selectedAsset, fetchPrice]);

  // Fetch price for new symbol using shared utility
  const fetchNewSymbolPrice = useCallback(async (symbol: string, typeOption: AssetTypeOption) => {
    if (!symbol || symbol.length < 1) {
      setNewPrice(null);
      return;
    }

    setNewIsFetchingPrice(true);
    setNewPrice(null);

    try {
      const result = await fetchQuote(symbol, typeOption);
      setNewPrice(result.price);
    } catch {
      setNewPrice(null);
    } finally {
      setNewIsFetchingPrice(false);
    }
  }, []);

  // Fetch price when new symbol changes (with debounce)
  useEffect(() => {
    if (!showBuyNew || !newSymbol) return;

    const timer = setTimeout(() => {
      fetchNewSymbolPrice(newSymbol, newAssetTypeOption);
    }, 500);

    return () => clearTimeout(timer);
  }, [showBuyNew, newSymbol, newAssetTypeOption, fetchNewSymbolPrice]);

  // Initialize account when opening Buy New modal
  const openBuyNewModal = () => {
    setShowBuyNew(true);
    setNewSymbol("");
    setNewAssetTypeOption("auto");
    setNewQuantity("");
    setNewPrice(null);
    setNewManualPrice("");
    // Default to first account
    if (gridData.accounts.length > 0) {
      setSelectedAccountId(gridData.accounts[0].id);
    }
  };

  // Close Buy New modal
  const closeBuyNewModal = () => {
    setShowBuyNew(false);
    setNewSymbol("");
    setNewQuantity("");
    setNewPrice(null);
    setNewManualPrice("");
  };

  // Handle Buy New submit
  const handleBuyNewSubmit = () => {
    if (!newSymbol || !newQuantity || !selectedAccountId) return;

    const effectiveNewPrice = newPrice ?? (newManualPrice ? parseFloat(newManualPrice) : null);
    if (!effectiveNewPrice) return;

    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;

    const assetType = newAssetTypeOption === "auto" ? detectAssetType(newSymbol) : newAssetTypeOption;

    addTransaction(
      {
        symbol: newSymbol.toUpperCase(),
        type: "buy",
        assetType,
        quantity: qty,
        price: effectiveNewPrice,
        date: new Date().toISOString().split("T")[0],
      },
      targetPortfolioId,
      selectedAccountId
    );

    // Show success
    setSuccessMessage(`Bought ${qty} ${newSymbol.toUpperCase()}`);
    setShowSuccess(true);
    setShowBuyNew(false);

    setTimeout(() => {
      setShowSuccess(false);
      setNewSymbol("");
      setNewQuantity("");
      setNewPrice(null);
      setNewManualPrice("");
    }, 1200);
  };

  // Effective price (auto-fetched or manual)
  const effectivePrice = currentPrice ?? (manualPrice ? parseFloat(manualPrice) : null);

  // Handle asset tap
  const handleAssetTap = (symbolKey: string, accountId: string, accountName: string) => {
    // Get clean symbol (strip -stock/-crypto suffix)
    const { symbol, assetType: parsedType } = parseSymbolKey(symbolKey);
    const gridAssetType = gridData.symbolTypes[symbolKey];
    const finalType: AssetType = parsedType ?? (gridAssetType === "both" ? "stock" : gridAssetType) ?? "stock";
    setSelectedAsset({ symbolKey, symbol, assetType: finalType, accountId, accountName });
  };

  // Handle submit
  const handleSubmit = () => {
    if (!selectedAsset || !quantity || !effectivePrice) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    // Add transaction with current date/time
    addTransaction(
      {
        symbol: selectedAsset.symbol,
        type: transactionType,
        assetType: selectedAsset.assetType,
        quantity: qty,
        price: effectivePrice,
        date: new Date().toISOString().split("T")[0],
      },
      targetPortfolioId,
      selectedAsset.accountId
    );

    // Show success
    setSuccessMessage(`${transactionType === "buy" ? "Bought" : "Sold"} ${qty} ${selectedAsset.symbol}`);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      setSelectedAsset(null);
      setQuantity("");
      setManualPrice("");
      setCurrentPrice(null);
    }, 1200);
  };

  // Close modal
  const closeModal = () => {
    setSelectedAsset(null);
    setQuantity("");
    setManualPrice("");
    setCurrentPrice(null);
  };

  // Calculate total
  const total = effectivePrice && quantity ? effectivePrice * parseFloat(quantity || "0") : 0;

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50">
        <h1 className="text-xl font-bold">Quick Entry</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tap an asset to buy or sell
        </p>
      </div>

      {/* Assets grouped by account */}
      <div className="p-4 space-y-6">
        {gridData.accounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No assets yet</p>
            <p className="text-xs mt-1">Add transactions from the form below</p>
          </div>
        ) : (
          gridData.accounts.map((account) => {
            // Get symbols that have holdings in this account
            const accountSymbols = gridData.symbols.filter(
              (symbol) => account.holdings[symbol] && account.holdings[symbol] > 0
            );

            if (accountSymbols.length === 0) return null;

            return (
              <div key={account.id}>
                {/* Account Header */}
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  {account.name}
                </h2>

                {/* Asset Pills */}
                <div className="flex flex-wrap gap-2">
                  {accountSymbols.map((symbolKey) => {
                    const { symbol: cleanSymbol, assetType: parsedType } = parseSymbolKey(symbolKey);
                    const isCrypto = parsedType === "crypto" || gridData.symbolTypes[symbolKey] === "crypto";

                    return (
                      <button
                        key={`${account.id}-${symbolKey}`}
                        onClick={() => handleAssetTap(symbolKey, account.id, account.name)}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all",
                          "active:scale-95 hover:shadow-md",
                          isCrypto
                            ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                            : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        )}
                      >
                        {/* Asset Type Dot */}
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            isCrypto ? "bg-orange-500" : "bg-blue-500"
                          )}
                        />
                        {/* Symbol (clean, without -stock/-crypto) */}
                        <span className="font-semibold">{cleanSymbol}</span>
                        {/* Quantity */}
                        <span className="text-xs opacity-75">
                          {account.holdings[symbolKey].toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Buy New Button - at bottom */}
        <button
          onClick={openBuyNewModal}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-green-500/50 text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors font-semibold"
        >
          <Plus className="h-5 w-5" />
          BUY
        </button>
      </div>

      {/* Bottom Sheet Modal for existing asset */}
      <MobileBottomSheet
        isOpen={!!selectedAsset}
        onClose={closeModal}
        successMessage={showSuccess ? successMessage : null}
      >
        {selectedAsset && (
          <>
            {/* Asset Info Header */}
            <MobileSheetHeader
              icon={<span className="text-lg font-bold">{selectedAsset.symbol.slice(0, 2)}</span>}
              iconClassName={cn(
                selectedAsset.assetType === "crypto"
                  ? "bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                  : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
              )}
              title={selectedAsset.symbol}
              subtitle={selectedAsset.accountName}
              rightContent={
                <div className="text-right">
                  {isFetchingPrice ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : currentPrice ? (
                    <>
                      <p className="text-lg font-semibold tabular-nums">{formatCurrency(currentPrice)}</p>
                      <p className="text-xs text-muted-foreground">Current price</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Enter price below</p>
                  )}
                </div>
              }
            />

            {/* Manual Price Input (when auto-fetch fails) */}
            {!isFetchingPrice && !currentPrice && (
              <div className="mb-5">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Price per unit ($)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="Enter price"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="h-14 text-xl text-center font-semibold rounded-xl"
                />
              </div>
            )}

            {/* Buy/Sell Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setTransactionType("buy")}
                className={cn(
                  "h-14 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
                  transactionType === "buy"
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <TrendingUp className="h-5 w-5" />
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTransactionType("sell")}
                className={cn(
                  "h-14 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
                  transactionType === "sell"
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <TrendingDown className="h-5 w-5" />
                Sell
              </button>
            </div>

            {/* Quantity Input */}
            <div className="mb-5">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Quantity
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-16 text-2xl text-center font-semibold rounded-xl"
                autoFocus
              />
            </div>

            {/* Total Preview */}
            <TotalPreview total={total} formatCurrency={formatCurrency} />

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!quantity || !effectivePrice || parseFloat(quantity) <= 0}
              size="lg"
              className={cn(
                "w-full h-14 text-lg font-semibold rounded-xl",
                transactionType === "buy"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {transactionType === "buy" ? "Buy" : "Sell"} {selectedAsset.symbol}
            </Button>
          </>
        )}
      </MobileBottomSheet>

      {/* Buy New Modal */}
      <MobileBottomSheet
        isOpen={showBuyNew}
        onClose={closeBuyNewModal}
        successMessage={null}
      >
        {/* Header */}
        <MobileSheetHeader
          icon={<Plus className="h-6 w-6 text-green-600 dark:text-green-400" />}
          iconClassName="bg-green-100 dark:bg-green-900/50"
          title="Buy New Asset"
          subtitle="Add a new position"
        />

        {/* Symbol Input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Symbol
          </label>
          <Input
            type="text"
            placeholder="e.g. AAPL, BTC"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            className="h-14 text-xl text-center font-semibold rounded-xl uppercase"
            autoFocus
          />
        </div>

        {/* Asset Type Selector */}
        <AssetTypeSelector
          value={newAssetTypeOption}
          onChange={setNewAssetTypeOption}
        />

        {/* Account Selector */}
        {gridData.accounts.length > 1 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Account
            </label>
            <div className="flex flex-wrap gap-2">
              {gridData.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountId(account.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    selectedAccountId === account.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price Display/Input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Price
          </label>
          {newIsFetchingPrice ? (
            <div className="h-14 rounded-xl bg-muted flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : newPrice ? (
            <div className="h-14 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{formatCurrency(newPrice)}</span>
            </div>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="Enter price"
              value={newManualPrice}
              onChange={(e) => setNewManualPrice(e.target.value)}
              className="h-14 text-xl text-center font-semibold rounded-xl"
            />
          )}
        </div>

        {/* Quantity Input */}
        <div className="mb-5">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Quantity
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="Enter quantity"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            className="h-14 text-xl text-center font-semibold rounded-xl"
          />
        </div>

        {/* Total Preview */}
        <TotalPreview
          total={(() => {
            const effectiveNewPrice = newPrice ?? (newManualPrice ? parseFloat(newManualPrice) : null);
            return effectiveNewPrice && newQuantity ? effectiveNewPrice * parseFloat(newQuantity || "0") : 0;
          })()}
          formatCurrency={formatCurrency}
        />

        {/* Submit Button */}
        <Button
          onClick={handleBuyNewSubmit}
          disabled={!newSymbol || !newQuantity || (!newPrice && !newManualPrice) || parseFloat(newQuantity) <= 0}
          size="lg"
          className="w-full h-14 text-lg font-semibold rounded-xl bg-green-600 hover:bg-green-700"
        >
          <TrendingUp className="h-5 w-5 mr-2" />
          Buy {newSymbol || "Asset"}
        </Button>
      </MobileBottomSheet>
    </div>
  );
}
