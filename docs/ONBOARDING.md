# ONBOARDING.md

For a new person or a new machine. About 15 minutes. Do it in order.

## 1. Access (human, once)
- [ ] Accept the repo invite (Write access): https://github.com/VeneratedApotheosis/AirBnB-lockup/invitations
- [ ] Accept the project invite, then open the board: https://github.com/users/VeneratedApotheosis/projects/4 . A 404 means you have no access yet. Repo access alone does not give board access; ask the owner (project > ... > Settings > Manage access).
- [ ] Watch the repo (All activity).

## 2. Tools
- [ ] `git`, Node 22.12+ (`node -v`), `npm`.
- [ ] `gh` 2.60+ (`gh --version`). Needed for sub-issues and blocked-by.
- [ ] `gh auth login` (HTTPS), then **`gh auth refresh -s project`**. Check `gh auth status`: scopes must include `repo` and `project`.
- [ ] Windows: use **Git Bash**. WSL's `bash` does not see your Windows `gh` login.
- [ ] Each AI agent tool: pre-approve `git push` to `main` and `gh issue ...` commands, or agents stall.

## 3. Clone and configure
```bash
git clone https://github.com/VeneratedApotheosis/AirBnB-lockup.git
cd AirBnB-lockup
git config pull.rebase true
git config core.autocrlf false
git config core.hooksPath .githooks
git config user.name "<you>"; git config user.email "<you>"
npm ci
```
One clone or worktree per agent. Do not share `node_modules`.

## 4. Smoke test
```bash
scripts/session-start.sh       # shows your user, In progress, Todo issues, last coordination comments
npm run lint && npm run typecheck && npm test
git push --dry-run             # the pre-push hook should run
```
If `session-start.sh` says the board is unreadable: `gh auth refresh -s project`.

## 5. Read, in this order
1. `AGENTS.md`
2. `docs/COORDINATION.md` (claim, comments, push, broken main)
3. `docs/ISSUES.md` (labels, board, sub-issues, filters)
4. `docs/COMMITS.md` (commit messages)
5. `docs/ARCHITECTURE.md` (who owns which directory)

## 6. Pick an agent ID
Format `<person>-<tool>-<n>`, e.g. `ana-claude-1`. Put it in every comment and in the `Agent:` commit trailer. Set it, and your areas, in the agent's environment so scripts need no arguments:
```bash
export AGENT_ID=ana-claude-1
export AGENT_AREAS=audit,llm        # areas you own in docs/ARCHITECTURE.md
```
Agents are mostly hands-off: they follow the **Autonomous loop** in `AGENTS.md` (`session-start.sh`, `next-task.sh`, `claim.sh N -`, build, push, DONE, repeat).

## 7. Your first task, end to end
```bash
git pull --rebase
scripts/session-start.sh                          # find a Todo sub-task in YOUR area
gh issue view <N> --comments
scripts/next-task.sh                              # prints the next free task in AGENT_AREAS
scripts/claim.sh <N> - "plan" "src/audit/**" 2h  # '-' = use $AGENT_ID
# ...work, commit small, push at least every 45 min:
git add <specific paths>
git commit -m "feat(audit): normalize axe results (refs #<N>)" -m "Agent: ana-claude-1"
git pull --rebase && git push
git log origin/main -1                            # confirm
f=$(mktemp); printf 'DONE (ana-claude-1)\nWhat changed: ...\nVerify: npm test\nSHA: %s\n' "$(git rev-parse --short HEAD)" > "$f"
gh issue comment <N> --body-file "$f"
gh issue close <N>                                # or end the last commit with "closes #<N>"
```
Comment files must be UTF-8 without BOM (use `printf`/heredoc in bash). Every comment starts with a prefix word (`CLAIMED`, `PROGRESS`, `DONE`, ...); see COORDINATION section 4.

## 8. Quick reference
| Task | Command |
|---|---|
| My open issues | `gh issue list --assignee @me` |
| Move a card | `scripts/set-status.sh <N> "In progress"` (also `Todo`, `Done`) |
| Mark blocked | `gh issue edit <N> --add-blocked-by <M>` |
| Make a sub-issue | `gh issue edit <N> --parent <epic>` |
| Open the board | `gh project view 4 --owner VeneratedApotheosis --web` |
| List board items | `gh project item-list 4 --owner VeneratedApotheosis` |
