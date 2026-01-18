"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStockQuote } from "@/hooks/useAssetData";
import { useAssetPnL, type PnLTimeRange, type AssetPnLDataPoint } from "@/hooks/useAssetPnL";
import { calculateAssetDetailStats } from "@/lib/assetDetailStats";
import {
  formatCurrency,
  formatCryptoPrice,
  formatPercent,
  formatDate,
  formatNumber,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AssetType, AssetDetailStats, TaxLot, Transaction } from "@/types/portfolio";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Trophy,
  Target,
  Clock,
  Sparkles,
  ChartLine,
  CalendarClock,
  History,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string | null;
  assetType: AssetType | null;
  currentPrice: number;
  assetName?: string;
  totalPortfolioValue?: number;
}

/** Format price based on asset type */
function formatPrice(price: number, assetType: AssetType): string {
  return assetType === "crypto" ? formatCryptoPrice(price) : formatCurrency(price, "USD", 2, 2);
}

/** Stat row component */
function StatRow({
  label,
  value,
  subValue,
  className,
}: {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-between items-baseline py-1", className)}>
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-right">
        <span className="font-medium">{value}</span>
        {subValue && (
          <span className="text-xs text-muted-foreground ml-2">{subValue}</span>
        )}
      </div>
    </div>
  );
}

/** Section header component */
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2 border-b border-border/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

/** Gain/loss indicator with color */
function GainIndicator({
  value,
  percent,
  className,
}: {
  value: number;
  percent: number;
  className?: string;
}) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "font-semibold",
        isPositive ? "text-gain" : "text-loss",
        className
      )}
    >
      {isPositive ? "+" : ""}
      {formatCurrency(value, "USD", 2, 2)} ({formatPercent(percent)})
    </span>
  );
}

/** Time ranges for the P&L chart */
const PNL_TIME_RANGES: { value: PnLTimeRange; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "ALL" },
];

/** Custom tooltip for the P&L chart */
function AssetPnLTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AssetPnLDataPoint }>;
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.pnl >= 0;

    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
        <p className="text-xs text-muted-foreground">{data.date}</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(data.pnl, "USD", 2, 2)}
        </p>
        <p className="text-xs text-muted-foreground">
          Value: {formatCurrency(data.value, "USD", 2, 2)}
        </p>
      </div>
    );
  }
  return null;
}

export function AssetDetailModal({
  open,
  onOpenChange,
  symbol,
  assetType,
  currentPrice,
  assetName,
  totalPortfolioValue = 0,
}: AssetDetailModalProps) {
  const transactions = usePortfolioStore((state) => state.transactions);
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const metricsMode = useSettingsStore((state) => state.metricsMode);

  // P&L chart state
  const [pnlTimeRange, setPnlTimeRange] = useState<PnLTimeRange>("1M");

  // Fetch stock quote for earnings date (only for stocks when modal is open)
  const { data: stockQuote } = useStockQuote(
    symbol ?? "",
    open && assetType === "stock" && !!symbol
  );

  // Get all accounts from visible portfolios
  const accounts = useMemo(() => {
    return portfolios.flatMap((p) => p.accounts);
  }, [portfolios]);

  // Filter transactions for active portfolio (or all if combined)
  const filteredTransactions = useMemo(() => {
    if (!activePortfolioId || activePortfolioId === "combined") {
      return transactions;
    }
    return transactions.filter((t) => t.portfolioId === activePortfolioId);
  }, [transactions, activePortfolioId]);

  // Get transactions for this specific asset, sorted by date descending
  const assetTransactions = useMemo(() => {
    if (!symbol || !assetType) return [];
    return filteredTransactions
      .filter((t) => t.symbol === symbol && t.assetType === assetType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions, symbol, assetType]);

  // Calculate stats
  const stats: AssetDetailStats | null = useMemo(() => {
    if (!symbol || !assetType) return null;
    return calculateAssetDetailStats(
      symbol,
      assetType,
      filteredTransactions,
      accounts,
      currentPrice,
      totalPortfolioValue,
      assetName
    );
  }, [symbol, assetType, filteredTransactions, accounts, currentPrice, totalPortfolioValue, assetName]);

  // Fetch P&L chart data - pass transactions for accurate position tracking
  const {
    data: pnlData,
    isLoading: pnlLoading,
    hasData: pnlHasData,
    summary: pnlSummary,
  } = useAssetPnL(
    symbol ?? "",
    assetType ?? "stock",
    filteredTransactions,
    pnlTimeRange,
    open && !!symbol && !!assetType && !!stats
  );

  // Determine chart color based on current P&L
  const pnlIsPositive = useMemo(() => {
    if (pnlData.length === 0) return (stats?.totalGain ?? 0) >= 0;
    return pnlData[pnlData.length - 1].pnl >= 0;
  }, [pnlData, stats?.totalGain]);

  // Calculate Y-axis domain
  const pnlYDomain = useMemo(() => {
    if (pnlData.length === 0) return [-100, 100];
    const pnlValues = pnlData.map((d) => d.pnl);
    const min = Math.min(...pnlValues, 0);
    const max = Math.max(...pnlValues, 0);
    const padding = Math.max(Math.abs(max - min) * 0.1, 10);
    return [min - padding, max + padding];
  }, [pnlData]);

  // Format Y-axis
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${value >= 0 ? "+" : ""}${(value / 1000).toFixed(1)}k`;
    }
    return `${value >= 0 ? "+" : ""}${value.toFixed(0)}`;
  };

  if (!stats) return null;

  const isPro = metricsMode === "pro";
  const isPositive = stats.totalGain >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold",
                  assetType === "stock"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                )}
              >
                {assetType === "stock" ? "S" : "C"}
              </span>
              <div>
                <span className="text-xl font-bold">{symbol}</span>
                {stats.name && (
                  <span className="ml-2 text-sm text-muted-foreground">{stats.name}</span>
                )}
              </div>
            </div>
            <span className="text-xl font-bold tabular-nums">
              {formatPrice(currentPrice, stats.assetType)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1">
          {/* Summary Section */}
          <SectionHeader icon={TrendingUp} title="Summary" />
          <div className="grid grid-cols-2 gap-x-6">
            <StatRow label="Total Value" value={formatCurrency(stats.currentValue, "USD", 2, 2)} />
            <StatRow label="Total Invested" value={formatCurrency(stats.totalInvested, "USD", 2, 2)} />
            <StatRow
              label="Total Gain/Loss"
              value={<GainIndicator value={stats.totalGain} percent={stats.totalGainPercent} />}
            />
            <StatRow label="Days Held" value={`${stats.daysHeld.toLocaleString()} days`} />
          </div>

          {/* P&L Chart Section */}
          <SectionHeader icon={DollarSign} title="Earned Over Time" />
          <div className="rounded-lg border border-border/50 p-3">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {PNL_TIME_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setPnlTimeRange(range.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      pnlTimeRange === range.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              {pnlHasData && (
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    pnlIsPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {pnlIsPositive ? "+" : ""}
                  {formatCurrency(pnlSummary.endPnL, "USD", 2, 2)}
                </span>
              )}
            </div>

            {/* Chart */}
            <div className="h-[160px] w-full">
              {pnlLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : pnlHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={pnlData}
                    margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="assetPnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="assetPnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      domain={pnlYDomain}
                      width={45}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <Tooltip
                      content={<AssetPnLTooltip />}
                      cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke={pnlIsPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                      strokeWidth={2}
                      fill={pnlIsPositive ? "url(#assetPnlGradientPositive)" : "url(#assetPnlGradientNegative)"}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No historical data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Position Section */}
          <SectionHeader icon={Layers} title="Position" />
          <div className="grid grid-cols-2 gap-x-6">
            <StatRow
              label="Total Shares"
              value={formatNumber(stats.totalShares, stats.assetType === "crypto" ? 8 : 4)}
            />
            <StatRow
              label="Avg Buy Price"
              value={formatPrice(stats.avgBuyInPrice, stats.assetType)}
            />
          </div>

          {/* Transactions Section */}
          <SectionHeader icon={Calendar} title="Transactions" />
          <div className="grid grid-cols-2 gap-x-6">
            <StatRow
              label="First Purchase"
              value={stats.firstPurchaseDate ? formatDate(stats.firstPurchaseDate) : "—"}
            />
            <StatRow
              label="Most Recent"
              value={stats.mostRecentPurchaseDate ? formatDate(stats.mostRecentPurchaseDate) : "—"}
            />
            <StatRow label="Total Trades" value={stats.transactionCount} />
            <StatRow label="Buys / Sells" value={`${stats.buyCount} / ${stats.sellCount}`} />
          </div>

          {/* Earnings Date (Stocks only) */}
          {assetType === "stock" && stockQuote?.earningsDate && (
            <>
              <SectionHeader icon={CalendarClock} title="Upcoming Events" />
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Next Earnings</span>
                </div>
                <p className="text-lg font-semibold mt-1">
                  {formatDate(stockQuote.earningsDate)}
                </p>
              </div>
            </>
          )}

          {/* Transaction History */}
          {assetTransactions.length > 0 && (
            <>
              <SectionHeader icon={History} title="Transaction History" />
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {assetTransactions.slice(0, 10).map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      assetType={stats.assetType}
                      currentPrice={currentPrice}
                    />
                  ))}
                  {assetTransactions.length > 10 && (
                    <div className="px-3 py-2 text-center text-xs text-muted-foreground bg-muted/30">
                      +{assetTransactions.length - 10} more transactions
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Account Breakdown */}
          {stats.accountBreakdown.length > 0 && (
            <>
              <SectionHeader icon={Layers} title="Account Breakdown" />
              <div className="space-y-1">
                {stats.accountBreakdown.map((acc) => (
                  <StatRow
                    key={acc.accountId}
                    label={acc.accountName}
                    value={formatCurrency(acc.value, "USD", 2, 2)}
                    subValue={`${formatNumber(acc.quantity, 4)} shares`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Trade Analysis */}
          <SectionHeader icon={Target} title="Trade Analysis" />
          <div className="space-y-1">
            {stats.largestPurchase && (
              <StatRow
                label="Largest Purchase"
                value={formatCurrency(stats.largestPurchase.value, "USD", 2, 2)}
                subValue={`${formatNumber(stats.largestPurchase.quantity, 4)} @ ${formatPrice(stats.largestPurchase.price, stats.assetType)}`}
              />
            )}
            {stats.bestTrade && (
              <StatRow
                label="Best Trade"
                value={
                  <span className="text-gain">
                    +{formatPercent(stats.bestTrade.gainPercent ?? 0)}
                  </span>
                }
                subValue={`@ ${formatPrice(stats.bestTrade.price, stats.assetType)}`}
              />
            )}
            {stats.worstTrade && stats.worstTrade.id !== stats.bestTrade?.id && (
              <StatRow
                label="Worst Trade"
                value={
                  <span className={stats.worstTrade.gainPercent && stats.worstTrade.gainPercent < 0 ? "text-loss" : "text-gain"}>
                    {formatPercent(stats.worstTrade.gainPercent ?? 0)}
                  </span>
                }
                subValue={`@ ${formatPrice(stats.worstTrade.price, stats.assetType)}`}
              />
            )}
          </div>

          {/* Fun Stats */}
          <SectionHeader icon={Sparkles} title="Fun Stats" />
          <div className="grid grid-cols-2 gap-x-6">
            {stats.funStats.patienceEarned > 0 && (
              <StatRow
                label="Patience Earned"
                value={
                  <span className="text-gain">
                    +{formatCurrency(stats.funStats.patienceEarned, "USD", 2, 2)}
                  </span>
                }
                className="col-span-2"
              />
            )}
            <StatRow
              label="Win Rate"
              value={`${formatNumber(stats.funStats.winRate, 1)}%`}
              subValue={`(${stats.funStats.winningTrades}/${stats.funStats.totalTrades})`}
            />
            {stats.funStats.currentStreak > 0 && (
              <StatRow
                label="Current Streak"
                value={
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" />
                    {stats.funStats.currentStreak} winners
                  </span>
                }
              />
            )}
          </div>

          {/* Pro Mode Stats */}
          {isPro && (
            <>
              <SectionHeader icon={ChartLine} title="Pro Metrics" />
              <div className="grid grid-cols-2 gap-x-6">
                <StatRow label="CAGR" value={formatPercent(stats.cagr)} />
                <StatRow label="Position %" value={`${formatNumber(stats.positionConcentration, 2)}%`} />
                {stats.dcaEffectiveness !== null && (
                  <StatRow
                    label="DCA Effectiveness"
                    value={
                      <span className={stats.dcaEffectiveness >= 0 ? "text-gain" : "text-loss"}>
                        {stats.dcaEffectiveness >= 0 ? "+" : ""}
                        {formatNumber(stats.dcaEffectiveness, 2)}%
                      </span>
                    }
                    subValue="vs lump sum"
                  />
                )}
                <StatRow
                  label="Price to 2x"
                  value={formatPrice(stats.priceTo2x, stats.assetType)}
                />
                {stats.breakEvenPrice && (
                  <StatRow
                    label="Break-even"
                    value={formatPrice(stats.breakEvenPrice, stats.assetType)}
                    className="col-span-2"
                  />
                )}
              </div>

              {/* Tax Lot Breakdown */}
              <SectionHeader icon={Clock} title="Holding Periods" />
              <div className="grid grid-cols-2 gap-x-6">
                <StatRow
                  label="Short-term Gain"
                  value={
                    <span className={stats.unrealizedShortTermGain >= 0 ? "text-gain" : "text-loss"}>
                      {stats.unrealizedShortTermGain >= 0 ? "+" : ""}
                      {formatCurrency(stats.unrealizedShortTermGain, "USD", 2, 2)}
                    </span>
                  }
                  subValue="< 1 year"
                />
                <StatRow
                  label="Long-term Gain"
                  value={
                    <span className={stats.unrealizedLongTermGain >= 0 ? "text-gain" : "text-loss"}>
                      {stats.unrealizedLongTermGain >= 0 ? "+" : ""}
                      {formatCurrency(stats.unrealizedLongTermGain, "USD", 2, 2)}
                    </span>
                  }
                  subValue=">= 1 year"
                />
              </div>

              {/* Tax Lots Table */}
              {stats.taxLots.length > 0 && (
                <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-muted-foreground font-medium">Date</th>
                        <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Qty</th>
                        <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Cost</th>
                        <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Gain</th>
                        <th className="px-2 py-1.5 text-center text-muted-foreground font-medium">Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.taxLots.slice(0, 5).map((lot, i) => (
                        <TaxLotRow key={i} lot={lot} assetType={stats.assetType} />
                      ))}
                      {stats.taxLots.length > 5 && (
                        <tr>
                          <td colSpan={5} className="px-2 py-1.5 text-center text-muted-foreground">
                            +{stats.taxLots.length - 5} more lots
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Tax lot table row */
function TaxLotRow({ lot, assetType }: { lot: TaxLot; assetType: AssetType }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-2 py-1.5">{formatDate(lot.purchaseDate)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {formatNumber(lot.quantity, assetType === "crypto" ? 4 : 2)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {formatCurrency(lot.costBasis, "USD", 0, 0)}
      </td>
      <td className={cn("px-2 py-1.5 text-right tabular-nums", lot.gain >= 0 ? "text-gain" : "text-loss")}>
        {lot.gain >= 0 ? "+" : ""}
        {formatPercent(lot.gainPercent)}
      </td>
      <td className="px-2 py-1.5 text-center">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            lot.holdingPeriod === "long"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
          )}
        >
          {lot.holdingPeriod === "long" ? "LT" : "ST"}
        </span>
      </td>
    </tr>
  );
}

/** Transaction history row */
function TransactionRow({
  transaction,
  assetType,
  currentPrice,
}: {
  transaction: Transaction;
  assetType: AssetType;
  currentPrice: number;
}) {
  const isBuy = transaction.type === "buy";
  const value = transaction.quantity * transaction.price;
  const currentValue = transaction.quantity * currentPrice;
  const gainPercent = isBuy
    ? ((currentPrice - transaction.price) / transaction.price) * 100
    : null;

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0 hover:bg-muted/30">
      <div className="flex items-center gap-2">
        {isBuy ? (
          <ArrowDownRight className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-red-500" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", isBuy ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
              {isBuy ? "BUY" : "SELL"}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
          </div>
          <div className="text-sm mt-0.5">
            {formatNumber(transaction.quantity, assetType === "crypto" ? 4 : 2)} @ {assetType === "crypto" ? formatCryptoPrice(transaction.price) : formatCurrency(transaction.price, "USD", 2, 2)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums">
          {formatCurrency(value, "USD", 2, 2)}
        </div>
        {isBuy && gainPercent !== null && (
          <div className={cn("text-xs tabular-nums", gainPercent >= 0 ? "text-gain" : "text-loss")}>
            {gainPercent >= 0 ? "+" : ""}{formatPercent(gainPercent)}
          </div>
        )}
      </div>
    </div>
  );
}
