# Reference analysis: Paper-Trail (multi-agent, trunk-based, issues as message bus)

Method: read `AGENTS.md`, `COORDINATION.md`, `.github/`, 190 commits (`git log`, 2026-10-17 13:06 to 2026-10-18 11:08 PT), and all 150 issues with 595 comments via `gh` (2026-10-18). "inferred" = my reading, with a confidence level. "session" = observed in the orchestrating session, not visible in the repo.

## Summary
- 4 people, ~10 agent identities (pi, Codex, Devin, Paper) pushed straight to `main`. Trunk-based. 190 commits in ~30h, 155 on day one. 3 merge commits, 0 reverts.
- GitHub Issues is the only status board. Protocol: `CLAIMED` comment + assignee, `PROGRESS`/`DECISION`/`INTERFACE`/`BLOCKED` comments, `DONE` handoff with SHA, then close (`COORDINATION.md` §2-§6).
- Ownership is by file/directory, one owner each. Cross-owner changes go through an `INTERFACE` comment and the owner's OK (§0, §10).
- Agent identity = `<person>-<tool>-<n>` in every comment and an `Agent:` commit trailer (175/190 commits).
- A pinned issue (#28, 58 comments) carries announcements ("pull now").
- The protocol was followed for lifecycle events (121 `CLAIMED`, 113 `DONE`) but not for progress/release (17 `PROGRESS`, 3 `BLOCKED`, 0 `UNCLAIMED`).
- CI existed but nobody was alerted: 57 of the last 100 runs failed, longest red streak 47 runs.

## What works

| # | Practice | Evidence | Why it likely helped |
|---|---|---|---|
| W1 | Issue lifecycle with claim and DONE | 115 issues have `CLAIMED`, 112 have `DONE`; `COORDINATION.md` §4, §6 | Any agent can rebuild state from `gh` alone, no shared filesystem needed. |
| W2 | Agent ID in comments + `Agent:` trailer | 175/190 commits; §1 ("Several agents can post from the same GitHub account") | Attribution when agents share one account. |
| W3 | `INTERFACE` comments for cross-owner changes | 64 uses; #84 (kenan-pi-1 integrated after chelsea-codex-1's INTERFACE) | Contract changes visible to dependents before code lands. |
| W4 | One owner per file/dir, props-only views | Ownership table §0; 3 merges, 0 reverts in 190 commits | Collisions avoided without PR review (inferred, medium). |
| W5 | Small commits straight to `main` | median 4 files/commit, p90 18 | Rebases stay trivial; breakage localized. |
| W6 | DONE handoff with real SHA + "verify push landed" | §6; 112 DONE | Prevents closing issues whose code never reached `main`. |
| W7 | Task template: Goal, files, acceptance criteria, deps, estimate | `.github/ISSUE_TEMPLATE/task.md` | Issues were claimable without a conversation. |
| W8 | Pinned announcement issue | #28; first comment "Shared contracts landed on main (#29), pull now" | One place for "pull now" broadcasts. |
| W9 | Documented tool gotchas (BOM in comment files, `--jq` quoting) | §13 | Comments stayed greppable by prefix. |

## What doesn't work / caused problems

| # | Problem | Evidence | Failure mode | Likely cause |
|---|---|---|---|---|
| P1 | CI red for long stretches, unnoticed | `gh run list`: 57/100 failed, 47 consecutive; #149 (opened by Devin) cites lockfile out of sync + 3 stale e2e specs; workaround commit `3d22898` | Broken `main` nobody owns | No alerting in `ci.yml`; e2e coupled to UI owned by others; no "fix main first" rule. |
| P2 | Rules file churn from roster changes | `COORDINATION.md` edited 18x in ~30h (`git log`); 24 issues mention stale/takeover | Doc drift, stale claims | Roster (who is active) lives in the rules file. |
| P3 | Progress/handoff protocol skipped | 17 `PROGRESS`, 3 `BLOCKED`, 0 `UNCLAIMED` vs a 2h `PROGRESS` rule (§5) | Context loss when an agent dies mid-task (inferred, medium; session: workers were killed) | Clock-based cadence is easy to forget. |
| P4 | Claim re-posting noise | #40 has 4 `CLAIMED` comments (same agent resuming), #94 has 2 | Noise, ambiguity about who holds it | No "resume" path distinct from "claim". |
| P5 | Permission failures on assignment | #4: "rejected the mandatory assignment step ... permissions" | Agent could not claim; workaround rule "comment-only claim counts" | Collaborator access not set up first. |
| P6 | Tool approval blocked direct push | #3: "automatic approval review rejected direct push" | Agent stalled until a human approved | Agent tooling defaults; later fixed by AGENTS.md rule 7. |
| P7 | Missing issue refs and merge commits | 47/190 commits without `#N`; merges `f591f80`, `7408870`, `98706b2` | Hard to trace commits; noisy history | `pull.rebase` not set on some machines (inferred, high). |
| P8 | Cross-owner edits slow | #40 needed "three test-assertion approvals" in another owner's test file | Waiting on a human mid-task | Strict ownership + no fast path for tiny edits. |
| P9 | Destructive worktree footgun | §8 warning: removing a worktree with a `node_modules` junction deletes the main checkout's deps | Lost deps, wasted time | Shared `node_modules` junction across worktrees. |
| P10 | Doc sprawl | Root has plan.md, scope_features.md, deepdive_S14.md, ISSUE_PLAN.md, ISSUE_DRAFTS_FRONTEND.md; AGENTS.md: "the issue's acceptance criteria win" | Spec drift | Planning docs not maintained once issues exist. |
| P11 | Push races | session: `! [rejected] HEAD -> main (non-fast-forward)` when another orchestrator pushed first | Retry loop, re-run checks | Several writers on one branch (expected; mitigated by rebase + hook). |

## Unknowns
- Force-pushes: no evidence either way (no reflog from other machines; I did not query the events API).
- Number of rejected pushes and silent rebase conflicts: not recorded anywhere.
- Real timing of the red CI streak (my run sort failed); only counts are reliable.
- Whether any agent skipped `COORDINATION.md` outright (all four people's agents did use `CLAIMED`, so likely no).
- Devin/Paper/Codex session logs and out-of-band chat between humans.
- Issue edit history (relabels, body edits).

## Recommendations for our setup (direct pushes to `main`, issues as bus, multiple computers, 5 days)

| Practice | Verdict | Reason |
|---|---|---|
| Issues as only status board; `CLAIMED`/`DONE` comments | ADOPT | W1; works across machines. |
| Claim = assignee + comment + re-check (earliest wins) | ADAPT | Add `status:in-progress` label and `scripts/claim.sh` that does the re-check; claim once, then resume without re-claiming (P4). |
| Agent ID in comments + `Agent:` trailer | ADOPT | W2. |
| `INTERFACE` comment before changing shared contracts | ADOPT | W3; our only protection without PR review. |
| One owner per directory | ADOPT | W4; put it in `docs/ARCHITECTURE.md`. Add a fast path: tiny edits in another area are allowed after a comment (P8). |
| Roster in rules file | AVOID | P2. Keep roster in the pinned issue body. |
| Pinned announcement issue | ADAPT | Label `coordination`; read only the latest ~10 comments; short messages. |
| `PROGRESS` every ~2h | ADAPT | Event-based: post when pausing, changing plan, or finishing a sub-step; always push a WIP commit first (P3). |
| Stale claim after 4h | ADAPT | 3h with no comment/commit (agents die; 5-day event). |
| Worktrees per local agent | ADAPT | One clone or worktree per agent. AVOID `node_modules` junctions (P9); run `npm ci` per worktree. |
| Commit format `#N summary` | ADAPT | `type(scope): summary (refs #N)`; warn-only `commit-msg` hook (P7). |
| `git pull --rebase` before push | ADOPT | Plus `git config pull.rebase true` on every machine (P7). |
| Small commits, never force-push | ADOPT | W5. Enforce no force-push via a ruleset. |
| CI on push | ADAPT | Keep it fast (lint, typecheck, unit); add auto-issue on failure and a "fix main first" rule (P1). Skip slow e2e on every push. |
| PR-era leftovers (`pull_request` trigger, short-lived branches, PR gates) | AVOID | The closest equivalents are pre-push hook + CI on push + `main-broken` protocol. |
| DONE handoff with SHA, verify push landed | ADOPT | W6. |
| Task template with files/AC/deps | ADOPT | W7; add a bug template. |
| BOM/quoting gotchas | ADOPT | W9; scripts use `--body-file` and bash. |
| Many planning docs | AVOID | P10. Issues + `docs/ARCHITECTURE.md` only. |
| Bot/permission setup | ADAPT | Give all 4 write access before day 1 (P5); tell agents tool approvals are pre-granted (P6). |
