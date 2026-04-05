---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, typescript]
dependencies: []
---

# Minor TypeScript Improvements

## Problem Statement
Collection of smaller TypeScript issues that improve code quality.

## Findings

### TypeScript Reviewer
1. **Fragile `setSettings` type** (`settingsStore.ts` line 40): Uses giant `Omit` union — add action type to separate data from actions
2. **`usePrivacyMode` is a store** (`hooks/usePrivacyMode.ts`): Zustand store in hooks/ directory — move to `stores/privacyStore.ts`
3. **Unused `completedBy` parameter** (`tasksStore.ts` line 37, `scheduledEventsStore.ts` line 36): Declared in interface but never used
4. **No explicit return types on hooks** (`useMobileMode.ts` line 12, `getCalendarClient`, `getGmailClient`)
5. **`extractBody` inline type duplication** (`lib/google/gmail.ts` line 58, 75): Extract `EmailPart` interface
6. **Non-null assertions on server env vars** (`lib/supabase/server.ts` lines 12-13): Use same guard pattern as `client.ts`
7. **Unused `Input` import** (`components/tasks/AddTaskForm.tsx` line 4) and unused `inputRef`
8. **`POST /api/search`** is 195 lines — exceeds 50-line function limit from CLAUDE.md
9. **`useVirtualScroll` `overscan` parameter** accepted but never used

## Proposed Solutions
Address each individually — all are small, low-risk changes.
- **Effort**: Small per item | **Risk**: Low

## Acceptance Criteria
- [ ] settingsStore uses separate data/action types
- [ ] usePrivacyMode moved to stores/
- [ ] Dead parameters/imports removed
- [ ] Return types added to public hooks

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | TypeScript Reviewer findings |
