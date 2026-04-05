---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, security]
dependencies: []
---

# Missing Security Headers + Health Endpoint Leaks Credentials

## Problem Statement
1. **No security headers** configured in `next.config.ts` — missing CSP, X-Frame-Options, HSTS, Referrer-Policy
2. **Health endpoint** at `/api/google/health` is unauthenticated and leaks: whether each credential is configured, first 20 characters of Client ID, full error stack traces

## Findings
- `next.config.ts` lines 1-54: Only image remote patterns, no headers()
- `app/api/google/health/route.ts` lines 7-12: `clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20)`
- Line 39: `errorDetails: error` — raw error object exposure

## Proposed Solutions
1. Add `headers()` function to `next.config.ts` with all standard security headers
2. Remove or gate health endpoint behind admin auth
3. Remove `clientIdPrefix` and `errorDetails` from response
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy headers set
- [ ] Health endpoint does not leak credential metadata

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel findings 6, 11 |
