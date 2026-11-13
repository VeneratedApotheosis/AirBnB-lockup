# AGENTS.md

Read this first, then `docs/COORDINATION.md`. Every agent on every machine follows both. New to the repo or to `gh`/Projects? Do `docs/ONBOARDING.md`.

## Project
Chrome MV3 extension that audits the current page for accessibility issues with axe-core plus an LLM, then patches the page in real time. 5-day hackathon. 4 people, 1-2 agents each, separate machines. State is shared only through git (`main`), GitHub Issues and the project board (https://github.com/users/VeneratedApotheosis/projects/4).

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

## Autonomous loop
Humans are mostly hands-off. You pick, claim, build, push and close work yourself. Do not wait for a human to assign anything.

Environment (set once per agent): `AGENT_ID=<person>-<tool>-<n>`, `AGENT_AREAS=<area,area>` (your owner's areas from `docs/ARCHITECTURE.md`). Use Git Bash on Windows.

```
1. git pull --rebase && scripts/session-start.sh
2. Holding an open claim (assigned to me, In progress)? Resume it. Else:
   scripts/next-task.sh            # prints '#N title' or exits 1
3. gh issue view N --comments      # read the whole issue and any INTERFACE/DECISION comments
3b. Scope check (see "Scoping" below). Unclear? Ask first, then claim.
4. scripts/claim.sh N - "<plan>" "<files>" <eta>     # non-zero exit = pick another, back to 2
5. Build. Commit small, push at least every 45 min (pre-push hook must pass).
6. Meet every Done-when item, tick the boxes, post DONE with the SHA, close the issue.
7. Back to 1. No free task: post one PROGRESS line on the coordination issue and stop.
```

Decide for yourself on routine implementation choices (naming, file layout, test cases, which refactor inside your files). Scope is different: see below.
- Spec unclear or product call needed: ask (see Scoping). Do not guess on `src/shared`.
- Needs another area's code: set "blocked by", post `INTERFACE`/`BLOCKED` on their issue, take other work.
- Same check fails 3 times: post `BLOCKED` with the error output, release the claim (`UNCLAIMED`), move on.
- Never bypass the pre-push hook, force-push, edit outside your area, or work an issue you did not claim.
- Need a new dependency, a hot-file edit or a new issue: follow `docs/COORDINATION.md` sections 6-7, then proceed.
- Before stopping for any reason with work in flight, push and post `HANDOFF` (COORDINATION section 9).

## Scoping (be careful; ask when unsure)
The issue's Goal, Files and Done-when define the scope. Nothing else is in scope. A wrong guess costs more than a question, because there is no PR review.

**Check before you claim.** Re-read the issue and confirm all of these. If any is "no" or "not sure", it is a scoping question:
- Every Done-when item is testable and I know how I would verify it.
- I know exactly which files I will change, and they are all in my area (or the issue says otherwise).
- It fits in 1-3 hours. If not, it needs splitting.
- No product or design decision is hidden in it (which provider, what UX, what counts as "weak evidence", which permission, what to store).
- It does not require changing `src/shared`, the manifest, `package.json` or another area's API.
- Its dependencies are closed, or I can build against a stub the issue names.

**Ask who, how.**
1. Human is in the session (interactive tool): ask them directly. Batch all questions into one message with a recommended default for each. Wait for answers.
2. No human reachable (unattended): post `QUESTION (<agent-id>)` on the issue with the question, your recommended default, and `@owner`. Release the claim if you already took it, and take other work. Do not proceed on a guess, and do not sit idle: pick the next free task.
3. Once answered, record it as a `DECISION` comment so the next agent sees it.

**While working.**
- Do only what the issue asks. No drive-by refactors, renames, formatting sweeps, extra features, or "while I'm here" fixes.
- Found a bug, a missing piece or an idea outside the scope: search for an existing issue, else open a new one (`docs/ISSUES.md` section 3) and link it. Do not fix it inline.
- Scope turns out bigger than the issue (more files, other areas, over 3 hours): stop, post `QUESTION` or `PROGRESS` with the proposed split, and finish only the agreed part.
- An acceptance criterion looks wrong or impossible: do not quietly reinterpret it. Ask, then record a `DECISION`.
- Cutting scope to finish faster is also a scope change. Say so on the issue; never close with Done-when items unmet.
- Do not widen patch capabilities, permissions, or what page data is sent to a model beyond what the issue and `docs/ARCHITECTURE.md` allow. Those are always questions.

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
5. No claim, no work. Claim a sub-task (never an epic) with `scripts/claim.sh` before writing code. Status lives on the board, not in labels.
6. One active issue per agent.
7. If `main` is red, fixing it comes before new work. See `docs/COORDINATION.md` section 8.
8. Never commit `.env*`, API keys, tokens or personal data.
9. Never use `git add .` blindly; stage specific paths.

## Pointers
- Protocol, comment formats, git rules: `docs/COORDINATION.md`
- Issues, labels, board, sub-issues, filters: `docs/ISSUES.md`
- Setup for a new person or machine: `docs/ONBOARDING.md`
- Modules, owners, contracts, open decisions: `docs/ARCHITECTURE.md`
- Why these rules: `docs/reference-analysis.md`
