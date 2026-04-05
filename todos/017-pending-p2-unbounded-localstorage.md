---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, performance, data-integrity]
dependencies: []
---

# Unbounded localStorage Growth — Search History + Supabase Queries

## Problem Statement
1. **Search history** grows without limit — every AI response (500B-2KB) prepended to array with no cap. After 500 searches, exceeds 1MB. Browsers impose 5-10MB quota; once exceeded, persist silently fails.
2. **Supabase queries** have no `.limit()` — `fetchAllTasks` and `fetchAllScheduledEvents` return every record ever created. After a year of use (~1,500 tasks), initial load parses massive JSON.

## Findings
- `stores/searchStore.ts` lines 22-31: No `.slice()` or max size on results array
- `lib/supabase/queries/tasks.ts` lines 55-58: No `.limit()` clause
- `lib/supabase/queries/scheduled-events.ts` lines 69-73: No `.limit()` clause

## Proposed Solutions
1. Cap search history at 50 results: add `.slice(0, 50)` after spread
2. Add `.limit(500)` to Supabase queries as safety ceiling
3. Filter old completed records: `.or('status.eq.pending,completed_at.gte.${thirtyDaysAgo}')`
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] Search history capped at 50 entries
- [ ] Supabase queries have reasonable limits

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Performance Oracle CRITICAL-4 + OPT-11 |
