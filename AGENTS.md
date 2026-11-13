# AGENTS.md

Read this first, then `docs/COORDINATION.md`. Every agent on every machine follows both.

## Project
Chrome MV3 extension that audits the current page for accessibility issues with axe-core plus an LLM, then patches the page in real time. 5-day hackathon. 4 people, 1-2 agents each, separate machines. State is shared only through git (`main`) and GitHub Issues.

## Stack (TODO: confirm in `docs/ARCHITECTURE.md` open decisions)
TypeScript, Vite build, axe-core, Zod for all LLM I/O, Vitest (unit), Playwright (extension e2e), ESLint. Node 22, npm.

## Layout
```
src/shared/      contracts: types, Zod schemas, message protocol (owner: lead)
src/background/  MV3 service worker: routing, LLM calls, storage
src/content/     content script: run audit, apply/revert patches, DOM observer
src/audit/       axe-core runner + result normalization (pure)
src/llm/         LLM client, prompts, response validation
src/patch/       patch model + safe DOM patch engine (pure where possible)
src/ui/          popup / side panel / options
tests/fixtures/  static pages with known a11y defects
e2e/             Playwright extension tests
docs/            COORDINATION.md, ARCHITECTURE.md
scripts/         session-start.sh, claim.sh, setup-labels.sh
```
Ownership per directory is in `docs/ARCHITECTURE.md`.

## Commands (TODO: wire up real scripts; the pre-push hook runs the first three)
```
npm ci
npm run lint
npm run typecheck
npm test            # vitest
npm run build       # outputs dist/ to load unpacked in chrome://extensions
npm run e2e         # playwright (slow; not run per push)
```

## Conventions
- TypeScript strict. No `any` without a one-line comment why.
- Validate every LLM response with Zod. Invalid: retry once, then surface an error. Never apply an unvalidated patch.
- Patches are declarative data (target selector + operation), never LLM-written JavaScript. MV3 forbids remote code.
- Pure logic in `audit/` and `patch/` takes inputs and returns outputs; no `chrome.*` calls there.
- Import shared types from `src/shared`. Never copy them.
- Small files, small functions, match existing style. Add or update tests for logic you change.
- No secrets in the repo. API keys are entered by the user in the options page and stored in `chrome.storage.local`.

## Definition of done
- Acceptance criteria in the issue are all met.
- `lint`, `typecheck`, `test` pass locally.
- Pushed to `main` and the push confirmed (`git log origin/main -1` shows your commit).
- `DONE` comment posted on the issue with the commit SHA, then the issue closed.

## Hard rules
1. Never force-push. Never rewrite pushed history.
2. Never push code that fails lint, typecheck or tests. The pre-push hook enforces this; do not bypass it except to revert a broken `main` (and say so on the issue).
3. Never edit files outside your claimed area without first commenting on the issue (`INTERFACE` or `QUESTION`). Tiny fixes in another area: comment first, then proceed unless the owner objects within the hour.
4. Start every session with `git pull --rebase` and `scripts/session-start.sh`.
5. No claim, no work. Claim with `scripts/claim.sh` before writing code.
6. One active issue per agent.
7. If `main` is red, fixing it comes before new work. See `docs/COORDINATION.md` section 8.
8. Never commit `.env*`, API keys, tokens or personal data.
9. Never use `git add .` blindly; stage specific paths.

## Pointers
- Protocol, comment formats, git rules: `docs/COORDINATION.md`
- Modules, owners, contracts, open decisions: `docs/ARCHITECTURE.md`
- Why these rules: `docs/reference-analysis.md`
