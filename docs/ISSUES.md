# ISSUES.md

How work is tracked: issues, labels, the project board, sub-issues. The agent protocol (claim, comments, push) is in `docs/COORDINATION.md`.

Board: https://github.com/users/VeneratedApotheosis/projects/4 (use it instead of the raw Issues tab; it shows status and hierarchy).

## 1. The pieces
| Thing | Answers | Where it lives |
|---|---|---|
| Status | Where is it in its life? | Board field: `Todo`, `In progress`, `Done`. Never a label. |
| Type label | What kind of work? | Exactly one `type: ...` |
| Area label | Which part of the code? | At least one `area: ...` (matches `docs/ARCHITECTURE.md`). Epics and the `coordination` issue are exempt |
| Milestone | When? | One only: `MVP` (we build in about a day, so no per-day milestones) |
| Parent | What does it belong to? | Native sub-issue link |
| Blocked | Is it waiting? | Native "blocked by" relationship. No label. |
| Assignee | Who has it? | Set by `scripts/claim.sh`. Empty until claimed. |

Labels (created by `scripts/setup-labels.sh`):
- Type: `type: epic`, `type: feature`, `type: bug`, `type: refactor`, `type: test`, `type: docs`, `type: chore`
- Area: `area: shared`, `area: background`, `area: content`, `area: audit`, `area: llm`, `area: patch`, `area: ui`, `area: tests`, `area: infra`
- Special: `main-broken`, `coordination`

Board Status changes: `claim.sh` sets `In progress`; closing the issue sets `Done` (board workflow); release with `scripts/set-status.sh <N> Todo`. `Priority`, `Size`, `Estimate` fields are optional.

## 2. Hierarchy
```
Epic       "MVP: scan -> suggest -> apply -> rescan -> undo"   (type: epic, never claimed)
 |- Task/sub-task  "Normalize axe-core findings ..."            (1-3 hours, one area, claimable)
 '- ...
```
- Three levels max. Agents claim only the leaf issues (1-3 hours, one area).
- Epics close by hand after the last child closes.
- A leaf that touches two areas gets split into two issues, one per owner.

## 3. Creating an issue
Search first: `gh issue list --state all --search "<words>"`. Then:
```bash
f=$(mktemp); cat > "$f" <<'EOF'
## Goal
...
## Done when
- [ ] ...
## How to verify
...
EOF
gh issue create --title "Verb-first title" --body-file "$f" \
  --label "type: feature" --label "area: audit" --milestone MVP --parent <epic-number>
```
- Title starts with a verb. No ID prefixes.
- Use the Task or Bug template for the headings (`--template` or the web form). Templates do not set type, area, milestone or parent: add them.
- Blocked by another issue: `--blocked-by <N>` at creation, or `gh issue edit <M> --add-blocked-by <N>`.
- Attach later: `gh issue edit <N> --parent <epic>`; `--milestone MVP`; `--add-label "area: llm"`.
- New issues join the board automatically (Auto-add workflow). If not: `gh project item-add 4 --owner VeneratedApotheosis --url <issue-url>`.
- Opening an issue is not claiming it.
- Write it so an agent can scope it without guessing: a one-sentence Goal, exact files, testable Done-when items, a verify command, and the decisions already made. Anything undecided goes in a "Open questions" line, not left implied. Agents are told to ask when scope is unclear (`AGENTS.md`, Scoping).

## 4. Done-when checkboxes
`- [ ]` lines are a self-check. Tick them (edit the issue) before the `DONE` comment. Ticking does not close the issue and closing does not tick them.

## 5. Closing
Final commit says `closes #N`, or `gh issue close <N>`. Close as **not planned** (with a comment saying why) for duplicates and dropped work.

## 6. Finding things
Paste into the Issues search box, or use with `gh issue list --search "..."`.

| You want | Search |
|---|---|
| Free work | board view `Todo` with no assignee, or `scripts/session-start.sh` |
| Mine | `is:open assignee:@me` |
| One area | `is:open label:"area: audit"` |
| Blocked | `is:issue is:open is:blocked` |
| Blocking others | `is:issue is:open is:blocking` |
| Epics | `is:issue label:"type: epic"` |
| Children of an epic | `is:issue parent-issue:VeneratedApotheosis/AirBnB-lockup#<N>` |
| Top-level only | `is:issue no:parent-issue` |

## 7. What not to do
- No status labels, no `blocked` label, no priority labels.
- No PRs. Do not use the `In review` idea; the board has no such column.
- Do not rename board Status options; the scripts match `Todo`, `In progress`, `Done` exactly.
