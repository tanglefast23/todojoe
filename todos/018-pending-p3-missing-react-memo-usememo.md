---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, performance]
dependencies: []
---

# Missing React.memo and useMemo on List Components

## Problem Statement
Neither `TaskItem` nor `ScheduledEventItem` is wrapped in `React.memo`. A single checkbox toggle causes ALL items to re-render. Calendar page sorts combined array on every render without `useMemo`.

## Findings
- `components/tasks/TaskItem.tsx`: Not memoized, each render runs 2x `formatDistanceToNow`
- `components/calendar/ScheduledEventItem.tsx`: Not memoized
- `app/calendar/page.tsx` lines 49-51: Array sort on every render without `useMemo`
- `app/gmail/page.tsx` lines 160-228: 50 email cards rendered inline without memoization

## Proposed Solutions
1. Wrap `TaskItem` and `ScheduledEventItem` in `React.memo`
2. Wrap calendar `allEvents` sort in `useMemo`
3. Extract Gmail email card into separate memoized component
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] List item components wrapped in React.memo
- [ ] Expensive computations wrapped in useMemo

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Performance Oracle OPT-2, OPT-3, OPT-10 |
