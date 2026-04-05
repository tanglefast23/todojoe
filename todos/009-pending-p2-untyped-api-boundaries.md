---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, typescript]
dependencies: []
---

# Untyped API Boundaries — request.json(), response.json(), JSON.parse()

## Problem Statement
Every `request.json()`, `response.json()`, and `JSON.parse()` call returns `any`, creating holes in the strict TypeScript configuration. No API routes define request/response type interfaces. The CoinGecko, Yahoo Finance, and Gemini API responses are all completely untyped.

## Findings

### TypeScript Reviewer
- `app/api/events/parse/route.ts` lines 8-9: Untyped body destructuring
- `app/api/search/route.ts` line 18: Untyped body
- `app/api/google/calendar/events/route.ts` lines 38-39: Untyped body
- `app/api/daily/route.ts` lines 150, 155, 249, 254: Untyped response.json()
- `lib/market-data.ts` line 73: CoinGecko response completely untyped
- `lib/groq.ts` line 181: Gemini Vision response untyped
- `app/api/daily/route.ts` line 166: JSON.parse returns any
- `lib/google/auth.ts` lines 100, 116: JSON.parse returns any

### Impact
If any external API changes its response shape, failures propagate silently as `undefined` or `NaN` through the app.

## Proposed Solutions
1. Define request body interfaces for each API route
2. Define response interfaces for all external API calls (CoinGecko, Yahoo Finance, Gemini, Groq)
3. Consider adding Zod for runtime validation at API boundaries
- **Effort**: Medium | **Risk**: Low

## Acceptance Criteria
- [ ] Every `request.json()` call has an explicit type or Zod schema
- [ ] Every external API response has a typed interface
- [ ] No `any` types flow from API boundaries into business logic

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | TypeScript Reviewer findings |
