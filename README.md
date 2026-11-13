# Website Accessibility Fixer

A consumer-facing Chrome extension for reviewing accessibility fixes on the current page.

## Run the scaffold

1. Install Node.js, then run `npm ci`, `npm run typecheck`, and `npm run build`.
2. Open `chrome://extensions`, enable Developer mode, and load `dist/` as an unpacked extension.
3. Run `npm run demo` and open `http://127.0.0.1:4173/`. The fixture has an unlabeled search button, an image missing alt text, and a skipped heading level.
4. Open the extension and choose **Scan this page**. The scaffold routes the request to the active document and reports that the audit is still being built.

## Integration

The shared types are in [src/shared/contracts.ts](src/shared/contracts.ts). The popup sends typed requests to the background worker, which routes page operations to the top-level document. The content script owns document-local scan and undo state. A new scan replaces the candidate registry, while undo history must survive rescans. Candidate IDs must be unique to their scan, and stale scan IDs or disconnected targets must be rejected.

| Workstream | Files | Entry points |
| --- | --- | --- |
| Popup and settings | `extension/popup.*`, `src/popup/` | `sendRequest` |
| Audit | `src/audit/` | `scanPage`, `resolveCandidate` |
| Suggestions | `src/suggestions/`, optional `server/` | `suggest` |
| Remediation | `src/remediation/` | `applyFixes`, `undoFixes`, `setPageProfile` |

First integration milestone: scan the fixture, review a mock proposal to name the search button, apply it, rescan, and undo. Heading proposals are review-only. Use the issue for your workstream to propose shared interface changes and link your PR.
