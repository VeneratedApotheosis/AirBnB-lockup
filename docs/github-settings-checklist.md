# GitHub and machine settings checklist (do by hand)

## Repo (owner, once, before day 1)
- [ ] **Collaborators:** Settings > Collaborators > add all 4 with **Write** access. Without it agents cannot self-assign (reference repo #4) or push. Everyone accepts the invite.
- [ ] **Actions:** Settings > Actions > General > allow actions; workflow permissions: read and write (needed only if you enable `ci-failure-issue.yml.example`, which needs `issues: write`).
- [ ] **No force-push on main, no PR requirement:** Settings > Rules > Rulesets > New branch ruleset, target `main`, enforcement Active. Enable **Block force pushes** and **Restrict deletions**. Leave **Require a pull request** and **Require status checks** OFF (they would block direct pushes).
- [ ] **Issues:** enabled. Keep blank issues enabled (templates are in `.github/ISSUE_TEMPLATE`).
- [ ] **Labels:** from a clone, `scripts/setup-labels.sh`.
- [ ] **Pinned issue:** create `Coordination`, label `coordination`, pin it. Put in the body: roster (human, handle, area, agent IDs), the wave plan, and the rule "read the last 10 comments". Keep the roster here, not in the repo.
- [ ] **Optional CI alert:** rename `.github/workflows/ci-failure-issue.yml.example` to `ci-failure-issue.yml`.
- [ ] **Notifications:** watch the repo (All activity) so humans see `main-broken` and `BLOCKED` comments.
- [ ] **Secrets:** none needed for CI yet. Never add API keys to the repo; the extension takes the key in its options page.
- [ ] Replace every `@TODO-*` in `docs/ARCHITECTURE.md` with real handles.

## Each machine (every person, every agent environment)
- [ ] `gh auth login` (HTTPS, authorize with `repo` scope). Check: `gh auth status` and `gh api user --jq .login`.
- [ ] `git clone <repo>`; one clone or worktree per agent.
- [ ] `git config pull.rebase true`
- [ ] `git config core.autocrlf false`
- [ ] `git config user.name` / `user.email` set; commits need the `Agent:` trailer (agent adds it).
- [ ] `git config core.hooksPath .githooks` (enables `pre-push` and `commit-msg`).
- [ ] On macOS/Linux: `chmod +x .githooks/* scripts/*.sh` and commit the mode (`git update-index --chmod=+x ...`) once. On Windows use Git Bash for the scripts.
- [ ] `npm ci` (Node 22). Do not share `node_modules` between worktrees.
- [ ] Tell each agent tool to pre-approve `git push` to `main` and `gh issue` commands. Otherwise agents stall waiting for approval (reference issue #3).
- [ ] Smoke test: `scripts/session-start.sh` runs; `git push --dry-run` triggers the hook.
