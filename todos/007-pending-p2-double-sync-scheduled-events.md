---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, data-integrity]
dependencies: []
---

# Double Sync on Every Scheduled Event Mutation

## Problem Statement
Every scheduled event action (add, complete, uncomplete, delete) triggers TWO Supabase writes: an immediate targeted write from the store action, PLUS a debounced bulk upsert of ALL events 1 second later from `useSupabaseSync`. This doubles API usage and creates race conditions with deletes.

The identical problem was already fixed for tasks (lines 150-156 of `useSupabaseSync.ts` document it was disabled), but the same fix was never applied to scheduled events.

## Findings
- `stores/scheduledEventsStore.ts` lines 74-77: Immediate upsert in store action
- `hooks/useSupabaseSync.ts` lines 161-164: Bulk upsert useEffect on array change
- Task sync already disabled at lines 150-156 with comment explaining why

## Proposed Solutions
Comment out or delete the scheduled events `useEffect` at lines 161-164 of `useSupabaseSync.ts`, matching the existing pattern for tasks.
- **Effort**: Small (4-line change) | **Risk**: Low

## Acceptance Criteria
- [ ] Scheduled event mutations trigger exactly one Supabase write
- [ ] No duplicate API calls visible in network tab

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Performance Oracle + Data Integrity Guardian |
