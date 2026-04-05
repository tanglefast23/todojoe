---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance]
dependencies: []
---

# Gmail N+1 API Pattern — 50 HTTP Requests per Inbox Load

## Problem Statement
`getPrimaryInboxEmails` calls `messages.list` once for 50 IDs, then fires a separate `messages.get` for each one via `Promise.all`. Each visit to the Gmail page fires 51 Gmail API calls (250 quota units — exactly the per-second rate limit).

## Findings
- `lib/google/gmail.ts` lines 128-161: Individual `messages.get` per email ID
- Same pattern duplicated in `searchEmails` at lines 263-296
- At current volume (50 emails), already hitting rate limit ceiling

## Proposed Solutions
1. Batch into groups of 10 with sequential processing
2. Use Google's HTTP batch endpoint
3. Reduce `maxResults` to 20 for primary inbox
- **Effort**: Medium | **Estimated saving**: 2-4 seconds per load

## Acceptance Criteria
- [ ] Gmail page load uses <= 10 API calls instead of 51
- [ ] No rate limiting errors from Gmail API

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Performance Oracle CRITICAL-1 |
