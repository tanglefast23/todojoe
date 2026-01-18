/**
 * Portfolio-related TypeScript types
 */

export type AssetType = "stock" | "crypto";

export type TransactionType = "buy" | "sell";

/**
 * Account within a portfolio (e.g., TFSA, RRSP, Other)
 */
export interface Account {
  id: string;
  name: string;
  portfolioId: string;
  createdAt: string;
  updatedAt?: string; // For conflict resolution during sync
}

export const OTHER_ACCOUNT_ID = "other";

export interface Transaction {
  id: string;
  symbol: string;
  type: TransactionType;
  assetType: AssetType;
  quantity: number;
  price: number;
  date: string; // ISO date string
  notes?: string;
  tags?: string[];
  portfolioId: string; // Which portfolio this transaction belongs to
  accountId: string;   // Which account within the portfolio (TFSA, RRSP, Other)
  updatedAt?: string;  // For conflict resolution during sync
}

export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;            // For conflict resolution during sync
  isIncludedInCombined: boolean; // Whether to include in "Combined" view
  accounts: Account[];           // Accounts within this portfolio
  ownerIds?: string[];           // Owner profile IDs (empty/undefined = public, multiple = shared access)
  displayOrder?: number;         // Order in the portfolio tabs (lower = first)
}

export const COMBINED_PORTFOLIO_ID = "combined";

/**
 * A user-created combined group of portfolios
 * Shows as a separate button alongside individual portfolios
 */
export interface CombinedGroup {
  id: string;
  name: string;                  // Auto-generated from portfolio names (e.g., "Karen + Kim")
  portfolioIds: string[];        // IDs of portfolios in this group
  createdAt: string;
  displayOrder?: number;         // Order in the tabs
  creatorOwnerId?: string;       // Owner who created this group (auto-has access)
  allowedOwnerIds?: string[];    // Additional owners who can see this group (master always has access)
}

/**
 * Data structure for Quick Overview grid display
 */
export interface QuickOverviewData {
  symbols: string[];
  symbolTypes: Record<string, AssetType | "both">; // symbol -> asset type (or "both" if mixed)
  accounts: Array<{
    id: string;
    name: string;
    holdings: Record<string, number>; // symbol -> quantity
  }>;
  totals: Record<string, number>; // symbol -> total quantity
}

export interface Holding {
  id: string;
  symbol: string;
  name?: string;
  assetType: AssetType;
  quantity: number;
  avgCost: number;
  tags?: string[];
}

export interface HoldingWithValue extends Holding {
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  hourChangePercent: number | null; // 1-hour change (crypto only, null for stocks)
  dayChange: number;
  dayChangePercent: number;
  allocation: number;
  priceAvailable: boolean; // False when API failed - UI should show "N/A" not $0
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: HoldingWithValue[];
  costBasisOverridden?: boolean; // True if using manual override
}

export interface PortfolioMetrics {
  cagr: number;
  volatility: number;
  sharpeRatio: number;
  allocation: AllocationItem[];
}

export interface AllocationItem {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL";

export interface CustomTimeRange {
  start: string;
  end: string;
}

export interface TimeRangeOption {
  label: string;
  value: TimeRange | "CUSTOM" | "YTD" | "SINCE_PURCHASE";
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "All", value: "ALL" },
  { label: "YTD", value: "YTD" },
  { label: "Since Purchase", value: "SINCE_PURCHASE" },
  { label: "Custom", value: "CUSTOM" },
];

// ============================================
// Asset Detail Modal Types
// ============================================

/** Per-account holding breakdown for a symbol */
export interface AccountHolding {
  accountId: string;
  accountName: string;
  quantity: number;
  value: number;
}

/** Individual transaction statistics */
export interface TransactionStats {
  id: string;
  date: string;
  type: TransactionType;
  quantity: number;
  price: number;
  value: number;
  gainPercent?: number; // Current gain/loss % vs purchase price
}

/** Fun/motivational statistics */
export interface FunStats {
  patienceEarned: number;  // $ gained from positions held > 1 year
  winRate: number;         // % of buy transactions currently profitable
  winningTrades: number;   // Count of profitable buys
  totalTrades: number;     // Total buy count
  currentStreak: number;   // Consecutive profitable trades (chronological)
}

/** FIFO tax lot for gain/loss tracking */
export interface TaxLot {
  purchaseDate: string;
  quantity: number;
  purchasePrice: number;
  costBasis: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
  holdingPeriod: "short" | "long"; // short = < 1 year, long = >= 1 year
  daysHeld: number;
}

/** Complete asset detail statistics */
export interface AssetDetailStats {
  // Basic Info
  symbol: string;
  assetType: AssetType;
  name?: string;

  // Simple Mode Stats (always visible)
  avgBuyInPrice: number;
  firstPurchaseDate: string;
  mostRecentPurchaseDate: string;
  daysHeld: number;
  totalShares: number;
  totalInvested: number;       // Cost basis
  currentPrice: number;
  currentValue: number;
  totalGain: number;
  totalGainPercent: number;
  transactionCount: number;
  buyCount: number;
  sellCount: number;
  accountBreakdown: AccountHolding[];
  largestPurchase: TransactionStats | null;
  bestTrade: TransactionStats | null;   // Highest gain %
  worstTrade: TransactionStats | null;  // Lowest gain % (could be negative)
  funStats: FunStats;

  // Pro Mode Stats (conditional on metricsMode === "pro")
  cagr: number;                         // Compound Annual Growth Rate
  volatility: number;                   // Price volatility measure
  unrealizedShortTermGain: number;      // Gains from positions < 1 year
  unrealizedLongTermGain: number;       // Gains from positions >= 1 year
  breakEvenPrice: number | null;        // Only if currently losing money
  priceTo2x: number;                    // Price needed to double investment
  dcaEffectiveness: number | null;      // % benefit vs lump sum (null if single purchase)
  positionConcentration: number;        // % of total portfolio
  taxLots: TaxLot[];                    // FIFO lot breakdown
}
