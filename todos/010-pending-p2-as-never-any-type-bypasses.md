---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, typescript]
dependencies: []
---

# `as never` and `any` Type Bypasses in Supabase Queries

## Problem Statement
Seven `as never` casts in Supabase query files completely bypass type checking (equivalent to `as any`). Additionally, `yahoo-finance2` quote results use `any` with an eslint-disable comment. Database types use `string` instead of union types for enum columns, forcing additional type assertions.

## Findings

### TypeScript Reviewer
- `lib/supabase/queries/tasks.ts` lines 76, 101, 137, 166: `as never` on insert/update/upsert
- `lib/supabase/queries/scheduled-events.ts` lines 90, 114, 150: `as never` on insert/update/upsert
- `lib/market-data.ts` line 118: `const quote: any` with eslint-disable
- `types/database.ts`: `priority: string` should be `"regular" | "urgent"`, `status: string` should be `"pending" | "completed"`

### Root Cause
Generated Supabase types use `string` for enum columns. The converter functions return camelCase objects that don't match the snake_case Insert/Update types.

## Proposed Solutions
1. Regenerate database types with `supabase gen types typescript` after adding proper CHECK constraints
2. Manually narrow database types to match app types
3. Properly type the converter function return types to match Insert/Update types
4. Use yahoo-finance2's exported `Quote` type instead of `any`
- **Effort**: Medium | **Risk**: Low

## Acceptance Criteria
- [ ] Zero `as never` casts in Supabase query files
- [ ] Zero `any` types on external API responses
- [ ] Database type enum columns use union types

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | TypeScript Reviewer findings |
