---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, security]
dependencies: ["001"]
---

# No Rate Limiting on Any Endpoint

## Problem Statement
No rate limiting library is installed. Combined with no authentication (#001), any attacker can make unlimited requests to drain Groq and Gemini API billing. The AI-powered endpoints (`/api/search`, `/api/events/parse`, `/api/daily`) are particularly expensive.

## Findings
- No `@upstash/ratelimit` or equivalent in `package.json`
- `error-display.tsx` references "rate_limit" as a UI label, not enforcement

## Proposed Solutions
Add `@upstash/ratelimit` with Redis-backed rate limiter, or use Vercel's built-in edge rate limiting. Apply per-IP limits on AI-powered endpoints.
- **Effort**: Medium | **Risk**: Low

## Acceptance Criteria
- [ ] AI endpoints limited to reasonable requests per minute
- [ ] Rate limit exceeded returns 429 with Retry-After header

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel finding 8 |
