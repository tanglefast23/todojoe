---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, security]
dependencies: ["001"]
---

# CSRF Protection, Legacy SHA-256, Verbose Logging

## Problem Statement
Three lower-priority security items to address after critical issues are resolved.

## Findings

### Security Sentinel
1. **No CSRF protection**: No CSRF tokens, no Origin header validation. Currently moot due to no auth, but will become exploitable once auth is added. Fix: Set `SameSite: Lax` on session cookies, verify Origin header.
2. **Legacy SHA-256 fallback** (`lib/crypto.ts` lines 23-28): Unsalted SHA-256 hash used as fallback for password verification. `needsHashUpgrade()` exists but is never called automatically. Fix: Add auto-rehashing on legacy hash match.
3. **Verbose logging**: Extensive `console.error`/`console.log` across production code logging full error objects, search queries, and API responses. Fix: Structured logging with production log level.
4. **Gemini API key in URL params** (`daily/route.ts` lines 123-124, `gemini.ts` line 59, `groq.ts` line 148): API keys in URLs get logged in server/proxy access logs.
5. **OAuth tokens on filesystem** (`lib/google/auth.ts` lines 133-134): `token.json` written in plaintext during local dev.

## Proposed Solutions
Address after P1/P2 items are resolved.
- **Effort**: Medium total | **Risk**: Low

## Acceptance Criteria
- [ ] CSRF protection implemented when auth is added
- [ ] Legacy SHA-256 auto-rehashes to bcrypt on match
- [ ] Production logging uses structured logger with appropriate levels

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel findings 5, 10, 12, 14, 16 |
