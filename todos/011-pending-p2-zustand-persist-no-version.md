---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, data-integrity]
dependencies: []
---

# Zustand Persist Without Version or Migrate

## Problem Statement
All four Zustand stores use `persist` middleware with only a `name` key — no `version` or `migrate` options. If the store shape changes (fields added/renamed/removed), persisted localStorage data is deserialized into an incompatible structure. Zustand persist does not validate shapes.

## Findings

### Data Integrity Guardian
- `stores/tasksStore.ts` lines 207-208
- `stores/scheduledEventsStore.ts` lines 163-164
- `stores/settingsStore.ts` lines 86-87
- `stores/searchStore.ts` lines 41-42
- Example: `attachmentUrl` field was added to tasks. Pre-existing persisted tasks have `attachmentUrl: undefined` instead of `null`.

## Proposed Solutions
Add `version` and `migrate` to all persist configurations.
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] All 4 stores specify `version` in persist config
- [ ] Migration functions handle schema changes gracefully
- [ ] Stale localStorage data is upgraded on load

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Data Integrity Guardian finding 7 |
