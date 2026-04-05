---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, data-integrity]
dependencies: []
---

# Supabase Row Level Security Disabled — Full Public Write Access

## Problem Statement
RLS is explicitly disabled on all tables with `GRANT ALL ... TO anon`. The Supabase anon key is embedded in the client-side JavaScript bundle (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Anyone can extract it from browser DevTools and directly read, write, modify, or delete ALL data via the Supabase REST API.

Additionally, the `jv_tasks` and `jv_scheduled_events` tables have NO migration files and therefore likely have no RLS policies at all.

## Findings

### Security Sentinel
- Migration `004_todo_app_tables.sql` lines 71-83: Explicitly disables RLS and grants ALL to anon on 5 tables
- `todo_owners` table (migration 006, line 20-21): RLS enabled but with `USING (true) WITH CHECK (true)` — fully permissive
- Anon key exposed in `frontend/lib/supabase/client.ts` line 8

### Data Integrity Guardian
- `jv_tasks` and `jv_scheduled_events` — no migration files exist anywhere in the project
- These tables were created manually in the Supabase dashboard with no version-controlled DDL
- No record of constraints (CHECK, NOT NULL, defaults, indexes)

### Attack Scenario
```bash
curl 'https://[project].supabase.co/rest/v1/jv_tasks?select=*' \
  -H 'apikey: [anon_key_from_bundle]'
```
Returns all tasks. Attacker can also INSERT, UPDATE, DELETE any row.

## Proposed Solutions

### Option A: Enable RLS with Permissive Policies (Quick)
Enable RLS on all tables. Since this is a personal/household app without per-user auth, create policies that require authenticated role.
- **Effort**: Small
- **Risk**: Low

### Option B: Full Auth-Based RLS (Recommended)
Enable RLS with policies based on `auth.uid()`. Requires implementing Supabase Auth first (depends on #001).
- **Effort**: Large (depends on auth implementation)
- **Risk**: Medium

## Acceptance Criteria
- [ ] RLS is enabled on `jv_tasks`, `jv_scheduled_events`, and all other tables
- [ ] Anon role cannot read or write data without proper authorization
- [ ] Migration files exist for all `jv_` prefixed tables with proper constraints

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel + Data Integrity Guardian |
