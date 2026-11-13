# GitHub and machine settings checklist (do by hand)

## Repo (owner, once, before day 1)
- [ ] **Collaborators:** Settings > Collaborators > add all 4 with **Write** access. Without it agents cannot self-assign (reference repo #4) or push. Everyone accepts the invite.
- [ ] **Actions:** Settings > Actions > General > allow actions; workflow permissions: read and write (needed only if you enable `ci-failure-issue.yml.example`, which needs `issues: write`).
- [ ] **No force-push on main, no PR requirement:** Settings > Rules > Rulesets > New branch ruleset, target `main`, enforcement Active. Enable **Block force pushes** and **Restrict deletions**. Leave **Require a pull request** and **Require status checks** OFF (they would block direct pushes).
- [ ] **Issues:** enabled. Keep blank issues enabled (templates are in `.github/ISSUE_TEMPLATE`).
- [ ] **Labels and milestone:** from a clone, `scripts/setup-labels.sh` (creates `type: *`, `area: *`, `main-broken`, `coordination`, milestone `MVP`). Optional: delete GitHub's default labels (`bug`, `enhancement`, ...) so only ours remain.
- [ ] **Project board** (https://github.com/users/VeneratedApotheosis/projects/4):
  - [ ] Invite the 3 teammates: project > ... > Settings > Manage access (role Write). Repo access alone does not let them edit the board. They accept the invite.
  - [ ] Link the project to the repo (repo > Projects tab > Link a project).
  - [ ] Workflows (project > ... > Workflows): **Auto-add to project** with filter `is:issue is:open` for this repo; **Item added to project** sets Status `Todo`; **Item closed** sets Status `Done`. Turn **Pull request merged** off or leave it (no PRs here).
  - [ ] Status options are `Todo`, `In progress`, `Done`. Scripts match these names exactly; do not rename them. `Priority`, `Size`, `Estimate` fields are optional.
  - [ ] Views: Board (group by Status), Hierarchy (table grouped by Parent issue), By area (table grouped by label). Filter each with `is:issue`.
  - [ ] Add the Labels, Parent issue and Sub-issues progress columns to the table views.
- [ ] **Pinned issue:** create `Coordination`, label `coordination`, pin it. Put in the body: roster (human, handle, area, agent IDs), the wave plan, and the rule "read the last 10 comments". Keep the roster here, not in the repo.
- [ ] **Optional CI alert:** rename `.github/workflows/ci-failure-issue.yml.example` to `ci-failure-issue.yml`.
- [ ] **Notifications:** watch the repo (All activity) so humans see `main-broken` and `BLOCKED` comments.
- [ ] **Secrets:** none needed for CI yet. Never add API keys to the repo; the extension takes the key in its options page.
- [ ] Replace every `@TODO-*` in `docs/ARCHITECTURE.md` with real handles.

## Each machine (every person, every agent environment)
- [ ] `gh auth login` (HTTPS), then `gh auth refresh -s project` (the scripts move board cards; without the `project` scope they warn and you move cards by hand). Check: `gh auth status` shows `project` and `repo` scopes. `gh` 2.60+ is needed for `--parent` / `--add-blocked-by`; check `gh --version`.
- [ ] Windows: run the scripts from **Git Bash**, not WSL's `bash` (WSL does not see your Windows `gh` login).
- [ ] `git clone <repo>`; one clone or worktree per agent.
- [ ] `git config pull.rebase true`
- [ ] `git config core.autocrlf false`
- [ ] `git config user.name` / `user.email` set; commits need the `Agent:` trailer (agent adds it).
- [ ] `git config core.hooksPath .githooks` (enables `pre-push` and `commit-msg`).
- [ ] Executable bits are stored in git (`git ls-files -s scripts .githooks` shows `100755`). If not: `chmod +x .githooks/* scripts/*.sh` and `git update-index --chmod=+x .githooks/* scripts/*.sh`.
- [ ] `npm ci` (Node 22). Do not share `node_modules` between worktrees.
- [ ] Tell each agent tool to pre-approve `git push` to `main` and `gh issue` commands. Otherwise agents stall waiting for approval (reference issue #3).
- [ ] Smoke test: `scripts/session-start.sh` lists the Todo issues and the board URL; `git push --dry-run` triggers the hook.
- [ ] Read `docs/ONBOARDING.md` and `docs/ISSUES.md`.
