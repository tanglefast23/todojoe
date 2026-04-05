---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, performance]
dependencies: []
---

# 26 Sequential Yahoo Finance API Calls per Daily Briefing

## Problem Statement
The daily route defines 22 stock + 4 commodity symbols, each getting its own `yahooFinance.quote()` call via `Promise.all`. Combined with CoinGecko and 2 Gemini calls, each `/api/daily` GET fires 29 outbound HTTP requests with zero server-side caching.

## Findings
- `lib/market-data.ts` lines 110-137: Individual quote per symbol
- `app/api/daily/route.ts` lines 12-16: 22 stock + 4 commodity symbols hardcoded

## Proposed Solutions
1. Check if yahoo-finance2 v3 accepts symbol arrays (reducing 26 calls to 1-2)
2. Add server-side in-memory cache with 5-minute TTL
- **Effort**: Small-Medium | **Estimated saving**: 1-3 seconds + reduced API load

## Acceptance Criteria
- [ ] Stock/commodity data fetched in batches, not individually
- [ ] Daily route has server-side caching

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Performance Oracle CRITICAL-3 |
