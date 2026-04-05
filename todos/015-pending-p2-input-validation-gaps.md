---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, security]
dependencies: []
---

# Input Validation Gaps — calendarId, Gmail Query, File Upload

## Problem Statement
Multiple input validation issues across API routes and file upload.

## Findings

### Security Sentinel
1. **calendarId** (`app/api/google/calendar/events/route.ts` lines 14-16): User-controlled with no validation, passed directly to Google API. `maxEvents` has no upper bound.
2. **Gmail query injection** (`app/api/search/route.ts` lines 151-155, `lib/google/gmail.ts` lines 247-255): User input flows to Gmail search query. Gmail operators like `in:trash`, `has:attachment filename:*.pdf` could be injected.
3. **File upload** (`components/tasks/TaskAttachmentUpload.tsx` lines 30-33): MIME type validation is client-side only (trivially bypassed). File extension from user-provided filename is unsanitized.

## Proposed Solutions
1. Validate `calendarId` against whitelist, clamp `maxEvents` to 1-100
2. Strip Gmail search operators from extracted terms before constructing query
3. Configure Supabase Storage bucket policies for server-side MIME type restriction
- **Effort**: Small-Medium | **Risk**: Low

## Acceptance Criteria
- [ ] calendarId validated, maxEvents bounded
- [ ] Gmail query injection mitigated
- [ ] File upload validated server-side

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel findings 7, 9, 13 |
