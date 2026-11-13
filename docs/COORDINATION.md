# COORDINATION.md

Protocol for several agents pushing to one `main` from different machines. GitHub Issues is the message bus. There are no PRs. Repo files are not used for live status.

Conventions: `<N>` = issue number. Your agent ID is `<person>-<tool>-<n>` (e.g. `ana-claude-1`). Put it in every comment and in an `Agent:` commit trailer. Several agents may share one GitHub account, so the assignee is the human and the agent ID says which agent.

## 1. Session start (every session)
```bash
git pull --rebase
scripts/session-start.sh        # my issues, others' in-progress, ready work, blocked, main-broken, last 10 coordination comments
```
Then `gh issue view <N> --comments` for anything you will touch. If you already hold an open claim, resume it before taking new work.

## 2. Issue lifecycle
| State | On GitHub |
|---|---|
| Ready | open, label `status:ready`, no assignee |
| In progress | open, assigned, label `status:in-progress`, a `CLAIMED` comment |
| Blocked | open, label `status:blocked`, latest comment says by what |
| Done | closed, `DONE` comment with SHA |

**Claim** (never skip): `scripts/claim.sh <N> <agent-id> "<plan>" "<files>" [eta]`. It checks the issue is free and unblocked, assigns you, sets `status:in-progress`, posts `CLAIMED`, then re-reads comments. If another `CLAIMED` is earlier, it deletes yours and exits non-zero. Earliest `CLAIMED` comment wins. Pick other work.
- Already yours? Do not re-claim. Post `PROGRESS` and continue.
- Only claim issues in your area (`docs/ARCHITECTURE.md`) or ones assigned to you.
- One active issue per agent.

**Release**: post `UNCLAIMED` (state of work, what is left), then `gh issue edit <N> --remove-assignee @me --remove-label status:in-progress --add-label status:ready`.

**Stale**: an in-progress issue with no comment and no commit for 3 hours may be taken over. Comment `STALE? (<agent-id>) @owner`, wait 15 minutes, then post `CLAIMED (takeover)`. Inactive people's claims go stale immediately when a human says so in the pinned issue.

**Close** only when all acceptance criteria are met and the push is confirmed. Then post `DONE` and `gh issue close <N>`.

## 3. Labels
Create with `scripts/setup-labels.sh`.
- Status: `status:ready`, `status:in-progress`, `status:blocked`
- Area: `area:shared`, `area:background`, `area:content`, `area:audit`, `area:llm`, `area:patch`, `area:ui`, `area:infra`
- Type: `type:feature`, `type:bug`, `type:chore`
- Special: `main-broken`, `coordination` (the pinned announcements issue)

## 4. Issue comments as messages
Write the first word in caps, then `(<agent-id>)`, then the body. Write comment text to a file and pass `--body-file` (UTF-8 without BOM; see section 11).

| Prefix | When | Body |
|---|---|---|
| `CLAIMED` | taking an issue (use the script) | plan, files, eta |
| `PROGRESS` | pausing, changing plan, finishing a sub-step | done, next, commits pushed |
| `DECISION` | a choice others should know | choice + why |
| `INTERFACE` | changing anything in `src/shared` or a module's public API | exact change, `@owner` of each dependent |
| `QUESTION` | need an answer, not blocking | the question, `@who` |
| `BLOCKED` | cannot proceed | blocked by what; add `status:blocked` |
| `UNBLOCKED` | unblocked | remove `status:blocked` |
| `UNCLAIMED` | releasing | state + what is left |
| `HANDOFF` | stopping mid-task (section 9) | see section 9 |
| `DONE` | finished | what changed, files, interfaces changed, how to verify, SHA, follow-ups |

```bash
f=$(mktemp); printf 'PROGRESS (ana-claude-1)\nDone: alt-text pass in src/audit. Next: wire to content script.\nPushed: a1b2c3d\n' > "$f"
gh issue comment 12 --body-file "$f"
```
```bash
gh issue edit 12 --add-label status:blocked --remove-label status:in-progress
```
New work or a bug found: search first (`gh issue list --state all --search "<words>"`), then `gh issue create --template Task` (or `Bug`), link the parent. Opening is not claiming.

## 5. Commits
`type(scope): summary (refs #N)`. Types: `feat fix refactor test docs chore`. Scope = area (`audit`, `llm`, ...). Final commit of an issue may say `closes #N`. Add the trailer `Agent: <agent-id>`.
- One logical change per commit. Commit and push at least every 45 minutes of work.
- `chore`/`docs` commits with no issue are fine; everything else needs `refs #N`.
- Stage specific paths. Never `git add .` without reading `git status`.

## 6. Pushing to main safely
```bash
git pull --rebase
npm run lint && npm run typecheck && npm test     # the pre-push hook also runs these
git push
git log origin/main -1                            # confirm your commit is there
```
- Rejected push (non-fast-forward): `git pull --rebase`, re-run checks, push again. Repeat. Never `--force`.
- Rebase conflict: resolve, `git add`, `git rebase --continue`. For `index.ts`-style barrel files and the lockfile, keep both sides' additions (lockfile: take main's, re-run `npm install`). In a file you do not own: keep the owner's version and comment on the issue. If unsure: `git rebase --abort` and ask.
- After a conflict, check `git log -1 --format=%B` kept your message and trailer.
- Adding a dependency: post on the `coordination` issue first.
- One clone or worktree per agent. Never run two agents in one folder. Do not share `node_modules` between worktrees; run `npm ci` in each.

## 7. Hot files (announce before editing)
`manifest`, `package.json`, lockfile, `src/shared/**`, any barrel `index.ts`, `.github/**`, `docs/**`. Use `INTERFACE` for `src/shared`.

## 8. When main is broken
CI red on `main` or a pull produces a failing build:
1. The author of the last commit fixes it first, before new work. If unreachable for 15 minutes, any agent may.
2. Fast path: revert the offending commit (`git revert <sha>`), push (`--no-verify` is allowed only for this), then fix forward.
3. Announce: open an issue labeled `main-broken` (title: `main red: <what>`), comment the fix SHA, close it when CI is green. The optional `ci-failure-issue.yml.example` does the opening automatically.
4. While `main-broken` is open, others keep working but do not push unrelated changes on top.

## 9. Handoff (stopping mid-task)
Push a WIP commit first (it must pass the hook; use `wip:` type only for code that still passes checks). Then comment:
```
HANDOFF (<agent-id>)
State: <what works, what does not>
Last commit: <sha>
Next steps: 1) ... 2) ...
Files touched: <paths>
Gotchas: <anything surprising, env vars, commands>
Open questions: <or none>
```
Then release the issue (section 2). A new agent on another machine must be able to continue from the issue alone.

## 10. Escalation
- Unclear spec or product decision: `QUESTION` comment tagging the human owner, then work on another issue. Do not guess.
- Blocked by another agent's area: `BLOCKED` + `INTERFACE`/`QUESTION` on their issue.
- Cross-cutting announcement (pull now, risky push in 10 min, dependency added): one line on the `coordination` issue.
- Humans sync every ~4 hours: check the board, re-pick work.

## 11. Windows and `gh` gotchas
- Comment files must be UTF-8 **without BOM** or prefix searches break. In bash use `printf`/heredoc. In PowerShell 5.1 use `[IO.File]::WriteAllText($f,$text,(New-Object Text.UTF8Encoding $false))`.
- Use `--body-file`, not long inline `--body` strings.
- Keep `--jq` expressions in bash; PowerShell 5.1 quoting breaks them.
- Set `git config core.autocrlf false`; `.gitattributes` forces LF.
