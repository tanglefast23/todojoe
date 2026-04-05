---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, quality, patterns]
dependencies: []
---

# Significant Code Duplication Across 6 Patterns

## Problem Statement
Multiple patterns of duplicated code across the codebase increase maintenance burden and risk of divergent behavior.

## Findings

### Pattern Recognition Specialist
1. **`generateId()`** — Identical 10-line UUID function in `tasksStore.ts` (lines 18-27) and `scheduledEventsStore.ts` (lines 17-26)
2. **`formatCryptoPrice()`** — Two implementations with DIFFERENT thresholds/behavior in `market-data.ts` (lines 173-187) and `formatters.ts` (lines 19-30)
3. **Long-press/delete-confirm logic** — ~25 lines duplicated in `TaskItem.tsx` (lines 46-67) and `ScheduledEventItem.tsx` (lines 42-63). A `LongPressButton` component already exists but is NOT used by either.
4. **Gemini API calls** — Raw fetch to Gemini duplicated in 4 locations: `gemini.ts`, `groq.ts` line 148, `daily/route.ts` lines 124 and 223
5. **`queryGroq` / `queryGemini`** — Nearly identical ~40-line functions with same parameter signatures, context building, error handling. Only the API endpoint differs.
6. **DailyData interfaces** — 50 lines of types duplicated between `daily/route.ts` and `daily/page.tsx`

## Proposed Solutions
1. Extract `generateId()` to `lib/id.ts`
2. Consolidate `formatCryptoPrice` — keep one version
3. Use existing `LongPressButton` component or extract `useLongPress` hook
4. Create single `callGemini()` utility in `lib/google/gemini.ts`
5. Abstract AI query into pluggable backend pattern
6. Move DailyData types to `types/daily.ts`
- **Effort**: Medium | **Risk**: Low

## Acceptance Criteria
- [ ] Zero duplicated utility functions
- [ ] Single source of truth for all shared types
- [ ] Gemini API called from one utility function

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Pattern Recognition Specialist findings |
