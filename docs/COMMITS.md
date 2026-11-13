# COMMITS.md

Commit message rules, based on [Conventional Commits](https://www.conventionalcommits.org/). Part of the protocol in `docs/COORDINATION.md` section 5.

There are no PRs and no squash here. Every commit lands on `main` as written, so **each commit message is the project history**. Write it for the next agent who reads `git log`.

## 1. Format
```
<type>(<scope>): <summary> (refs #<N>)

<optional body: what and why>

<optional footers>
Agent: <agent-id>
```
Example: `feat(audit): normalize axe violations (refs #1)`

## 2. Types
| Type | Use for | Issue label it usually matches |
|---|---|---|
| `feat` | New user-facing behavior | `type: feature` |
| `fix` | Bug fix | `type: bug` |
| `refactor` | Restructure, same behavior (includes perf) | `type: refactor` |
| `test` | Add or fix tests only | `type: test` |
| `docs` | Documentation only | `type: docs` |
| `chore` | Build, deps, CI, config, tooling, formatting | `type: chore` |
| `wip` | Handoff snapshot (`docs/COORDINATION.md` section 9). Must still pass lint, typecheck, test | n/a |

`style`, `perf`, `build`, `ops` are not used here. Formatting, build and CI changes are `chore`; performance work is `refactor`.

## 3. Scope
The area of the files you changed, without the `area:` prefix:

`shared`, `background`, `content`, `audit`, `llm`, `patch`, `ui`, `tests`, `infra`

- Scope is required for code changes. It may be omitted for repo-wide `docs`/`chore`.
- A commit touches one area. Two areas means two commits (and, per ownership rules, usually two issues).
- Lowercase, no issue numbers in the scope.

## 4. Rules
- Summary: imperative, present tense, lowercase first letter, no period, about 72 characters or fewer. "add", not "added".
- `refs #N` in the subject for every `feat`, `fix`, `refactor`, `test`. Optional for `chore` and `docs` without an issue.
- Final commit of an issue: `closes #N` (in the body or subject). It closes the issue when pushed to `main`. One keyword per issue: `closes #12, closes #13` (not `closes #12, #13`).
- One logical change per commit. Commit and push at least every 45 minutes.
- Add the trailer `Agent: <agent-id>` (e.g. `Agent: ana-claude-1`) to every commit.
- Body explains why, not a diff recap. Skip it for small changes.
- Stage specific paths. Never `git add .` without reading `git status`.

## 5. Breaking changes
A change to `src/shared` or any module's public API that dependents must adapt to:
- Post `INTERFACE` on the dependents' issues first (`docs/COORDINATION.md` section 4).
- Land it as its own small commit, with `!` before the colon and a footer:
```
feat(shared)!: rename Violation.help to description (refs #12)

BREAKING CHANGE: Violation.help is now Violation.description.
Agent: ana-claude-1
```

## 6. Examples
```
feat(audit): flag images with missing alt text (refs #1)
fix(patch): skip revert when the site changed the attribute (refs #3)
refactor(llm): extract response validation (refs #2)
test(patch): cover repeated apply (refs #3)
docs: explain scoping rules in AGENTS.md
chore(infra): drop --if-present from CI
wip(ui): popup scan view, apply not wired (refs #4)
feat(ui): wire apply and undo buttons (closes #4)
```

## 7. How to write one
Multi-line messages: use a file or two `-m` flags, not `\n` inside quotes.
```bash
git commit -m "fix(content): re-resolve target after SPA re-render (refs #7)" \
           -m "Agent: ana-claude-1"
```

## 8. Enforcement and mistakes
- `.githooks/commit-msg` only warns (it never blocks): bad format, or a missing `refs #N`. Enable with `git config core.hooksPath .githooks`.
- Wrong message, **not yet pushed**: `git commit --amend`.
- Wrong message, **already pushed**: never rewrite `main`. Leave it. Add a clarifying line in the next commit or an issue comment.
- Check the last commit after a rebase conflict: `git log -1 --format=%B` should keep your message and trailer.
