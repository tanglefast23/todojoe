---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, data-integrity]
dependencies: []
---

# Non-Atomic Sync Pattern + No Rollback on Failed Optimistic Updates

## Problem Statement
Two critical data integrity issues:

1. **`syncTasks` uses delete-all/insert-all** — Two sequential HTTP requests (DELETE all, then INSERT all) that are NOT wrapped in a transaction. If the network drops between them, all cloud data is permanently lost.

2. **No rollback on failed optimistic updates** — All CRUD operations update local Zustand state immediately and fire-and-forget the Supabase write. When Supabase fails, local state diverges permanently from cloud state with only a `console.error`.

## Findings

### Data Integrity Guardian
- **Finding 1 (CRITICAL)**: `lib/supabase/queries/tasks.ts` lines 146-173 — `syncTasks` deletes all rows then inserts replacements in two separate HTTP requests
- **Finding 2 (CRITICAL)**: `stores/tasksStore.ts` lines 58-143 and `stores/scheduledEventsStore.ts` lines 54-141 — All actions use fire-and-forget `.catch()` that only logs
- **Finding 9 (MODERATE)**: `retryWithBackoff` returns `undefined` on final failure instead of throwing, triggering false "recovery mode" that can overwrite good cloud data

### Specific Failure Scenarios
- DELETE succeeds, INSERT fails (429 rate limit, network timeout) → all tasks permanently lost
- User closes tab between DELETE and INSERT → data destroyed
- Failed add: task exists locally but never reaches cloud → vanishes on next `performInitialLoad`
- Failed delete: task removed locally but persists in cloud → reappears on next sync

## Proposed Solutions

### Option A: Add Rollback + Remove syncTasks (Recommended)
1. Delete the `syncTasks` function entirely (it appears unused)
2. Add rollback to all optimistic updates:
```typescript
deleteTask: (id) => {
  const previousTasks = get().tasks;
  set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  deleteTaskFromSupabase(id).catch((error) => {
    console.error("[Store] Reverting delete:", error);
    set({ tasks: previousTasks });
  });
},
```
3. Fix `retryWithBackoff` to throw on final failure
- **Effort**: Medium
- **Risk**: Low

### Option B: Atomic RPC + Rollback
Replace sync with a Supabase RPC function that performs operations inside a PostgreSQL transaction.
- **Effort**: Large
- **Risk**: Medium

## Acceptance Criteria
- [ ] `syncTasks` delete-all/insert-all function is removed
- [ ] All optimistic updates revert local state on Supabase failure
- [ ] `retryWithBackoff` throws on final failure instead of returning `undefined`
- [ ] User sees feedback when sync fails (toast notification)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Data Integrity Guardian findings 1, 2, 9 |
