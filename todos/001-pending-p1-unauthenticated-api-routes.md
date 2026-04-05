---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security]
dependencies: []
---

# Unauthenticated API Routes — Complete Public Access

## Problem Statement
Every API route in the application is completely unauthenticated. There is no `middleware.ts` anywhere in the project. Anyone who discovers the Vercel deployment URL can call all endpoints directly — reading emails, creating calendar events, triggering AI searches, and consuming API billing.

## Findings

### Security Sentinel
- **No middleware.ts exists** — confirmed by glob search (only node_modules matches)
- The `isGoogleConfigured()` check in route handlers only verifies server-side credentials exist; it does NOT authenticate the incoming request
- **11 endpoints** are fully exposed: Gmail read/delete/archive, Calendar read/create, Search, Events parse, Daily briefing, Health

### Attack Scenario
An attacker navigates to `https://[vercel-url]/api/google/gmail/messages` and receives all primary inbox emails in JSON. They can then `DELETE /api/google/gmail/message/[id]` to destroy evidence.

### Evidence Locations
- `frontend/app/api/google/gmail/messages/route.ts` line 5
- `frontend/app/api/google/gmail/message/[id]/route.ts` lines 5, 40, 65
- `frontend/app/api/google/calendar/events/route.ts` lines 5, 29
- `frontend/app/api/search/route.ts` line 16
- `frontend/app/api/events/parse/route.ts` line 6
- `frontend/app/api/daily/route.ts` line 286

## Proposed Solutions

### Option A: Shared Secret Header (Quick Stopgap)
Create `middleware.ts` that checks `X-API-Key` header against an environment variable for all `/api/*` routes.
- **Pros**: Fast to implement, immediately blocks unauthorized access
- **Cons**: Not a full auth solution, secret must be embedded in client
- **Effort**: Small
- **Risk**: Low

### Option B: Supabase Auth with Session Cookies (Recommended)
Implement Supabase Auth with session-based authentication. Validate `supabase.auth.getUser()` at the start of each route handler.
- **Pros**: Proper auth, integrates with existing Supabase setup, supports multi-user
- **Cons**: More work, requires UI for login
- **Effort**: Large
- **Risk**: Medium

## Recommended Action
<!-- Fill during triage -->

## Technical Details
- **Affected files**: All files in `frontend/app/api/`
- **New file needed**: `frontend/middleware.ts`

## Acceptance Criteria
- [ ] All `/api/*` routes reject unauthenticated requests with 401
- [ ] A valid authentication mechanism is enforced
- [ ] Health endpoint may remain public

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel agent finding |
