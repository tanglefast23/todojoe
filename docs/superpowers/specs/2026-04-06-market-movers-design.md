# Market Movers — Portfolio-Aware Geopolitical Intelligence

**Date:** 2026-04-06
**Status:** Approved

## Problem

The daily briefing tracks stock prices and ticker-specific news, but misses the macro events that move entire sectors: wars, sanctions, tariffs, OPEC decisions, rate changes, supply chain disruptions. A user holding semiconductor stocks needs to know about a new chip export ban — not because it mentions NVDA by name, but because it affects the entire supply chain their portfolio depends on.

## Solution

A new "Market Movers" section on the daily page. One Gemini 2.0 Flash call (with Google Search grounding) acts as a financial analyst who knows the user's exact positions. It searches for any global event from the last 24 hours that would meaningfully impact those holdings, explains the chain of impact, and returns 0-3 items. If nothing significant happened, the section doesn't appear.

## Prompt Design

The prompt receives the full `INVESTMENT_WATCH_SYMBOLS` list dynamically:

```
You are a financial analyst monitoring a client's portfolio.
Their positions include: ${symbols}.

Search for any global event from the last 24 hours that would
meaningfully impact one or more of these holdings. Think broadly:

- Geopolitical: wars, sanctions, trade agreements, diplomatic shifts
- Monetary: central bank decisions, rate changes, currency crises
- Commodities: oil, rare earth, semiconductor supply chains
- Regulatory: antitrust, tariffs, export controls, new legislation
- Macro: GDP data, employment, consumer confidence, sovereign debt

For each event found, explain the chain of impact:
EVENT → which sector/supply chain → which symbols affected → direction

Only return events a professional analyst would flag as portfolio-relevant.
If nothing significant happened in the last 24 hours, return an empty array.

Return JSON array:
[{
  "headline": "1-2 sentence summary of the event",
  "impactChain": "brief chain: event → sector → symbols → why",
  "affectedSymbols": ["NVDA", "TSM"],
  "direction": "positive" | "negative" | "uncertain",
  "url": "source URL",
  "source": "Reuters"
}]
```

**Model:** Gemini 2.0 Flash
**Grounding:** `google_search: {}` (real-time news access)
**Temperature:** 0.1 (conservative, factual)

## API Changes

### `/api/daily/route.ts`

Add `fetchMarketMovers()` as a fourth parallel call:

```typescript
const [cryptoPrices, stockPrices, news, investmentNews, marketMovers] =
  await Promise.all([
    fetchCryptoPrices(CRYPTO_SYMBOLS),
    fetchStockPrices(STOCK_SYMBOLS),
    fetchNews(),
    fetchInvestmentNews(),
    fetchMarketMovers(),
  ]);
```

The function:
- Reads `INVESTMENT_WATCH_SYMBOLS` from env
- Returns `[]` if no symbols configured (skip the API call entirely)
- Calls Gemini with the prompt above
- Parses JSON response, validates shape
- Returns `MarketMoverItem[]`

### New Type

```typescript
interface MarketMoverItem {
  headline: string;
  impactChain: string;
  affectedSymbols: string[];
  direction: "positive" | "negative" | "uncertain";
  url: string | null;
  source: string;
}
```

Added to `DailyData`:

```typescript
interface DailyData {
  // ...existing fields
  marketMovers: MarketMoverItem[];
}
```

## UI Design

### Position

Between "Stock Movers" (gainers/losers) and "Investment Watchlist News" on the daily page. Both existing sections are unchanged.

### Layout

- **Header:** "Market Movers" with a TrendingUp or Globe icon, styled like other section headers
- **Conditional:** Section only renders if `marketMovers.length > 0`. Most days it won't show — silence means nothing to worry about.
- **Cards:** Each item is a tappable card (opens source URL) containing:
  - **Headline** — bold, 1-2 sentences
  - **Impact chain** — smaller muted text showing the reasoning (e.g. "OPEC production cut → oil prices ↑ → energy sector → TSLA battery costs")
  - **Affected symbols** — small colored badges for each symbol from the user's watchlist
  - **Direction indicator** — green arrow-up for positive, red arrow-down for negative, amber dash for uncertain
- **Border color:** Amber/orange left border (distinguishes from blue general news and other sections)

### Direction Colors

| Direction | Icon | Color |
|-----------|------|-------|
| positive | ↑ ArrowUp | green-500 |
| negative | ↓ ArrowDown | red-500 |
| uncertain | — Minus | amber-500 |

## Error Handling

- If Gemini returns invalid JSON, log the error and return `[]` (section doesn't show)
- If Gemini times out, return `[]` (don't block the rest of the daily page)
- If `INVESTMENT_WATCH_SYMBOLS` is empty, skip the call entirely and return `[]`
- The existing `Promise.all` wrapping means one failure doesn't break other sections

## Files Changed

| File | Change |
|------|--------|
| `app/api/daily/route.ts` | Add `fetchMarketMovers()`, add to `Promise.all`, add to response |
| `app/daily/page.tsx` | Add Market Movers section UI between stock movers and investment news |
| `types/daily.ts` (or inline) | Add `MarketMoverItem` type |

## What This Does Not Do

- No separate API route — piggybacks on the existing `/api/daily` endpoint
- No separate cache — cached alongside the rest of the daily data
- No push notifications — it's a pull model (check the daily page)
- No historical tracking — each refresh is a fresh search
- No user-configurable sensitivity threshold — Gemini decides what's significant
