#!/usr/bin/env bash
# Run at the start of every agent session (after `git pull --rebase`). Read-only.
# Status comes from the board (Project #4), not labels. See docs/ISSUES.md.
set -uo pipefail
. "$(dirname "$0")/lib.sh"

me=$(gh api user --jq .login)
git fetch -q 2>/dev/null; echo "== git: $(git status -sb | head -n1)"
echo "== gh user: $me (your agent ID goes in every comment)"
echo "== board: https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"

fmt='.[]|"#\(.number) [\(.assignees|map(.login)|join(","))] \(.title)"'
board() { # <jq filter on .items[]>
  gh project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --limit 200 \
    --jq ".items[]|select(.content.type==\"Issue\")|select($1)|\"#\\(.content.number) [\\(.assignees // [] | join(\",\"))] \\(.title)\"" 2>/dev/null \
    || echo "(board unreadable: run 'gh auth refresh -s project')"
}

echo; echo "== assigned to me (resume these first)"
gh issue list --assignee "$me" --state open --json number,title,assignees --jq "$fmt"
echo; echo "== In progress (everyone)"
board '.status=="In progress"'
echo; echo "== Todo and unassigned (free to claim; pick sub-tasks, not epics)"
board '.status=="Todo" and ((.assignees // [])|length)==0'
echo; echo "== blocked (native blocked-by)"
gh issue list --state open --search "is:blocked" --json number,title,assignees --jq "$fmt"
echo; echo "== MAIN BROKEN (fix before new work)"
gh issue list --label main-broken --state open --json number,title,assignees --jq "$fmt"

n=$(gh issue list --label coordination --state open --limit 1 --json number --jq '.[0].number // empty')
if [ -n "$n" ]; then
  echo; echo "== coordination issue #$n: roster in the body, last 10 comments below"
  gh issue view "$n" --json comments --jq '.comments[-10:][]|"\(.createdAt[0:16]) \(.body|split("\n")[0])"'
else
  echo; echo "== no open issue labeled 'coordination' yet (ask a human to create and pin it)"
fi
