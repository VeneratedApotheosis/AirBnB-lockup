#!/usr/bin/env bash
# Run at the start of every agent session (after `git pull --rebase`). Read-only.
set -uo pipefail

me=$(gh api user --jq .login)
git fetch -q 2>/dev/null; echo "== git: $(git status -sb | head -n1)"
echo "== gh user: $me (your agent ID goes in every comment)"

fmt='.[]|"#\(.number) [\(.assignees|map(.login)|join(","))] \(.title)"'

echo; echo "== assigned to me (resume these first)"
gh issue list --assignee "$me" --state open --json number,title,assignees --jq "$fmt"
echo; echo "== in progress (everyone)"
gh issue list --label status:in-progress --state open --json number,title,assignees --jq "$fmt"
echo; echo "== ready and unassigned"
gh issue list --label status:ready --state open --search "no:assignee" --json number,title,assignees --jq "$fmt"
echo; echo "== blocked"
gh issue list --label status:blocked --state open --json number,title,assignees --jq "$fmt"
echo; echo "== MAIN BROKEN (fix before new work)"
gh issue list --label main-broken --state open --json number,title,assignees --jq "$fmt"

n=$(gh issue list --label coordination --state open --limit 1 --json number --jq '.[0].number // empty')
if [ -n "$n" ]; then
  echo; echo "== coordination issue #$n: roster/waves in the body, last 10 comments below"
  gh issue view "$n" --json comments --jq '.comments[-10:][]|"\(.createdAt[0:16]) \(.body|split("\n")[0])"'
else
  echo; echo "== no open issue labeled 'coordination' yet (ask a human to create and pin it)"
fi
