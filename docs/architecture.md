# ARCHITECTURE.md

Goal: four people and their agents build in parallel with almost no shared files. With no PR review, directory ownership is the main collision guard.

## Data flow
```
popup/side panel (ui) --msg--> background --msg--> content script
                                  |                    |-- audit (axe-core) -> Violation[]
                                  |-- llm (violation -> Patch[], Zod-validated)
                                  '-- storage (settings, API key, per-site patches)
content script <--Patch[]-- background ; content applies/reverts via patch engine
```
LLM calls run in the background service worker only (keeps the API key out of page context and avoids page CORS).

## Modules and owners
TODO (human): replace `@TODO` with a GitHub handle per area before day 1.

| Area (label) | Directory | Owner | Responsibility |
|---|---|---|---|
| `area:shared` | `src/shared/**` | @TODO-lead | Types, Zod schemas, message protocol. Change only via `INTERFACE` comment + OK. |
| `area:infra` | `manifest*`, `vite.config.*`, `package.json`, lockfile, `.github/**`, `scripts/**`, `.githooks/**`, `docs/**` | @TODO-lead | Build, CI, manifest, permissions. |
| `area:background` | `src/background/**` | @TODO-A | Service worker, message routing, storage, orchestration. |
| `area:content` | `src/content/**` | @TODO-B | Inject audit, receive and apply patches, MutationObserver. |
| `area:audit` | `src/audit/**` | @TODO-B | Run axe-core, normalize to `Violation`. Pure. |
| `area:llm` | `src/llm/**` | @TODO-C | Provider client, prompts, Zod validation, retry-once. |
| `area:patch` | `src/patch/**` | @TODO-C | `Patch` model, safe apply/revert, conflict handling. Pure where possible. |
| `area:ui` | `src/ui/**` | @TODO-D | Popup/side panel/options views. Props-only components; no `chrome.*` in components. |
| tests | `tests/**`, `e2e/**` | @TODO-D | Fixtures with known defects, Playwright extension tests. |

Rules:
- One owner per path. Others read, import, or open an issue; they do not edit.
- A change that crosses two areas is split into two issues, one per owner.
- `src/audit` and `src/patch` never import `chrome.*`, so they are testable without a browser.

## Contracts (live in `src/shared`; types sketched here, schemas are the truth)
```ts
type Violation = { id: string; ruleId: string; impact: "minor"|"moderate"|"serious"|"critical";
  selector: string; html: string; help: string; wcag: string[] };
type Patch = { id: string; violationId: string; selector: string;
  op: "setAttribute"|"removeAttribute"|"setText"|"addClass"|"insertAfter";
  name?: string; value?: string; confidence: number; rationale: string };
type PatchSet = { url: string; patches: Patch[]; model: string; createdAt: string };
```
Messages (one discriminated union, `type` field): `AUDIT_REQUEST`, `AUDIT_RESULT`, `PATCH_REQUEST`, `PATCH_APPLY`, `PATCH_REVERT`, `SETTINGS_GET/SET`. Request/response shapes are defined once in `src/shared/messages.ts`.

Safety constraints for patches: no script/event-handler attributes, no `innerHTML` from LLM text, selector must match at apply time or the patch is skipped and reported.

## Open decisions (TODO: human)
1. Bundler and MV3 tooling: Vite + `@crxjs/vite-plugin` or plain Vite multi-entry?
2. UI: React or vanilla? Popup or side panel?
3. LLM provider/model and who pays; key entered by the user in options?
4. Permissions: `activeTab` + on-demand injection (safer) or `<all_urls>` (auto-patch on load)?
5. Patch persistence: per-origin storage and re-apply on navigation, or session-only?
6. Real-time: re-audit on DOM mutation (debounce window) or manual trigger only?
7. Which a11y rule categories to target first (alt text, labels, contrast, landmarks)?
8. Browsers: Chrome only for the demo?
9. Which agent tools each person runs (adds tool-specific pointer files if needed).

## Interface change protocol
Post `INTERFACE (<agent-id>)` on the dependents' issues, tag their owners, wait for OK on `src/shared`, land the contract change in its own small commit first, then dependents build on it.
