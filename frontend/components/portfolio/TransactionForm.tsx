"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortfolioStore } from "@/stores/portfolioStore";
import type { AssetType, TransactionType } from "@/types/portfolio";
import { COMBINED_PORTFOLIO_ID } from "@/types/portfolio";

interface TransactionFormProps {
  onSuccess?: () => void;
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  // Initialize date empty to avoid hydration mismatch, set on mount
  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const isInitialMount = useRef(true);
  const [error, setError] = useState("");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceAutoFilled, setPriceAutoFilled] = useState(false);

  const addTransaction = usePortfolioStore((state) => state.addTransaction);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const getAccountsForPortfolio = usePortfolioStore((state) => state.getAccountsForPortfolio);
  const portfolios = usePortfolioStore((state) => state.portfolios);

  // Get accounts for active portfolio (or first portfolio if combined view)
  const targetPortfolioId = activePortfolioId === COMBINED_PORTFOLIO_ID
    ? portfolios[0]?.id || "default"
    : activePortfolioId;
  const accounts = getAccountsForPortfolio(targetPortfolioId);

  // Set default account when dialog opens or accounts change
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      // Default to "Other" account if available, otherwise first account
      const otherAccount = accounts.find((a) => a.name === "Other");
      setAccountId(otherAccount?.id || accounts[0].id);
    }
  }, [accounts, accountId]);

  // Set initial date on mount to avoid hydration mismatch
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, []);

  // Auto-fill current price when symbol changes
  const fetchCurrentPrice = useCallback(async (sym: string, type: AssetType) => {
    if (!sym || sym.length < 1) return;

    setIsFetchingPrice(true);
    try {
      if (type === "crypto") {
        const quote = await api.getCryptoQuote(sym);
        setPrice(quote.price.toString());
        setPriceAutoFilled(true);
      } else {
        const quote = await api.getStockQuote(sym);
        setPrice(quote.price.toString());
        setPriceAutoFilled(true);
      }
    } catch {
      // Silently fail - user can still enter price manually
      setPriceAutoFilled(false);
    } finally {
      setIsFetchingPrice(false);
    }
  }, []);

  // Debounced price fetch when symbol changes
  useEffect(() => {
    if (!symbol || symbol.length < 1) {
      setPriceAutoFilled(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchCurrentPrice(symbol, assetType);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [symbol, assetType, fetchCurrentPrice]);

  // Get today's date string (memoized to avoid repeated calls)
  const getTodayDate = useCallback(() => new Date().toISOString().split("T")[0], []);

  const resetForm = () => {
    setTransactionType("buy");
    setAssetType("stock");
    setSymbol("");
    setQuantity("");
    setPrice("");
    setDate(getTodayDate());
    setAccountId("");
    setError("");
    setIsFetchingPrice(false);
    setPriceAutoFilled(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!symbol.trim()) {
      setError("Symbol is required");
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Quantity must be a positive number");
      return;
    }

    const prc = parseFloat(price);
    if (isNaN(prc) || prc <= 0) {
      setError("Price must be a positive number");
      return;
    }

    if (!date) {
      setError("Date is required");
      return;
    }

    // Add transaction with selected account
    addTransaction(
      {
        symbol: symbol.toUpperCase().trim(),
        type: transactionType,
        assetType,
        quantity: qty,
        price: prc,
        date,
      },
      targetPortfolioId,
      accountId
    );

    resetForm();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a buy or sell transaction for your portfolio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction-type">Transaction Type</Label>
              <Select
                value={transactionType}
                onValueChange={(v) => setTransactionType(v as TransactionType)}
              >
                <SelectTrigger id="transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-type">Asset Type</Label>
              <Select
                value={assetType}
                onValueChange={(v) => setAssetType(v as AssetType)}
              >
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Symbol and Account */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder={assetType === "stock" ? "AAPL" : "BTC"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="flex items-center gap-2">
                Price per Unit ($)
                {isFetchingPrice && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </Label>
              <div className="relative">
                <Input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="150.00"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setPriceAutoFilled(false);
                  }}
                  disabled={isFetchingPrice}
                />
              </div>
              {priceAutoFilled && (
                <p className="text-xs text-muted-foreground">
                  Current market price
                </p>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Total Preview */}
          {quantity && price && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                Total: ${(parseFloat(quantity || "0") * parseFloat(price || "0")).toFixed(2)}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {transactionType === "buy" ? "Buy" : "Sell"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
