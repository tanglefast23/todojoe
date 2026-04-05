---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, quality, performance]
dependencies: []
---

# Dead Code and ~10 Unused npm Dependencies

## Problem Statement
Multiple dead code files and ~10 unused npm dependencies from the Investment Tracker fork bloat the bundle and add confusion.

## Findings

### Dead Code
- `lib/google/gemini.ts`: Entire file unused — superseded by `lib/groq.ts`
- `lib/supabase/queries/tasks.ts` lines 146-173: `syncTasks()` unused (disabled per comment)
- `lib/supabase/sync/syncFunctions.ts` lines 23-35: `createSyncTasksToSupabase` exported but never called
- `hooks/useVirtualScroll.ts`: Imported by nothing, TODO says "not implemented"
- `stores/tasksStore.ts` lines 46-48: `getPendingTasks()`/`getCompletedTasks()` likely unused
- `components/layout/Sidebar.tsx`: May be vestigial (MobileAwareLayout doesn't render it)
- `lib/decimal.ts`, `lib/crypto.ts`: Likely inherited from Investment Tracker

### Unused npm Dependencies (~5MB+)
`axios`, `bcryptjs`, `recharts`, `react-grid-layout`, `lightweight-charts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `decimal.js`, `zundo`

### Other
- 132 `console.*` calls across 25 files — structured logger exists at `lib/logger.ts` but is unused
- `lib/logger.ts` line 112: `export default logger` violates named-export convention

## Proposed Solutions
1. Delete dead code files
2. `pnpm remove` unused dependencies
3. Replace `console.*` with structured logger in stores/sync code
- **Effort**: Small-Medium | **Risk**: Low

## Acceptance Criteria
- [ ] No dead code files remain
- [ ] Unused dependencies removed
- [ ] Console calls replaced with logger in non-API code

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Pattern Recognition + Performance Oracle findings |
