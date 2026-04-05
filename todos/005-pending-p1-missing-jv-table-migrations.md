---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, data-integrity, security]
dependencies: []
---

# Missing DDL for jv_tasks and jv_scheduled_events Tables

## Problem Statement
The application queries `jv_tasks` and `jv_scheduled_events` exclusively, but no migration file anywhere in the project creates these tables. They were created manually in the Supabase dashboard with no version-controlled DDL. There is no record of constraints, indexes, or RLS policies.

## Findings

### Data Integrity Guardian
- No file in `lib/supabase/migrations/` contains `CREATE TABLE jv_tasks` or `CREATE TABLE jv_scheduled_events`
- TypeScript types in `types/database.ts` define both tables (lines 121, 169) with comment: "Using dedicated jv_ prefixed tables"
- Migration `004_todo_app_tables.sql` only creates un-prefixed `tasks` table
- Without migration files: no disaster recovery script, no constraint verification, no RLS audit possible

## Proposed Solutions

### Option A: Create Migration File (Recommended)
Create `frontend/lib/supabase/migrations/010_jv_tables.sql` with full DDL for both tables including constraints, indexes, and RLS policies.
- **Effort**: Medium
- **Risk**: Low (IF NOT EXISTS guards)

## Acceptance Criteria
- [ ] Migration file exists with CREATE TABLE for `jv_tasks` and `jv_scheduled_events`
- [ ] CHECK constraints on `priority`, `status`, `source` columns
- [ ] Indexes on `created_at` and `scheduled_at` columns
- [ ] RLS policies defined
- [ ] `updated_at` trigger configured

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Data Integrity Guardian finding 3 |
