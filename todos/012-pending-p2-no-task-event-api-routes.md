---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture, agent-native]
dependencies: []
---

# No Task/Event API Routes — 14 Features Are UI-Only

## Problem Statement
Tasks and scheduled events are managed entirely through Zustand client-side stores. There are ZERO API routes for task or event CRUD. An agent (or external integration) cannot create, read, update, delete, or complete a task programmatically. 14 of 26 user capabilities have no API equivalent.

Additionally, Google Calendar update/delete functions exist in `lib/google/calendar.ts` but have no API route wrappers.

## Findings

### Agent-Native Reviewer
- **12/26 capabilities are agent-accessible** (46%)
- Missing: Task CRUD, Event CRUD, Task attachments, Settings, Data export/import
- The Supabase query layer (`lib/supabase/queries/tasks.ts`, `scheduled-events.ts`) already has full CRUD functions — they just need API route wrappers
- `lib/google/calendar.ts` has `updateCalendarEvent` (line 114) and `deleteCalendarEvent` (line 168) but no routes expose them

## Proposed Solutions
Create REST API routes that wrap existing Supabase query functions:
- `GET/POST /api/tasks` + `PATCH/DELETE /api/tasks/[id]`
- `GET/POST /api/events` + `PATCH/DELETE /api/events/[id]`
- `POST/DELETE /api/tasks/[id]/attachment`
- `PATCH/DELETE /api/google/calendar/events/[eventId]`
- **Effort**: Medium | **Risk**: Low

## Acceptance Criteria
- [ ] All task CRUD operations available via API
- [ ] All event CRUD operations available via API
- [ ] Calendar event update/delete exposed via API
- [ ] Consistent error response format across all routes

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Agent-Native Reviewer findings |
