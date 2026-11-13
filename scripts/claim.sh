#!/usr/bin/env bash
# Claim an issue safely. Usage: scripts/claim.sh <issue> <agent-id|-> "<plan>" "<files>" [eta]
# Pass `-` as agent-id to use $AGENT_ID (set it once per agent environment).
# Set TAKEOVER=1 to take over a stale claim (see docs/COORDINATION.md section 2).
# Exit 0 = you own it. Non-zero = do not start work.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

issue="${1:?issue number}"; agent="${2:?agent id}"; plan="${3:?plan}"; files="${4:?files}"; eta="${5:-unknown}"
[ "$agent" = "-" ] && agent="${AGENT_ID:?set AGENT_ID or pass an agent id}"
me=$(gh api user --jq .login)

info=$(gh issue view "$issue" --json state,labels,assignees \
  --jq '[.state, (.labels|map(.name)|join(",")), (.assignees|map(.login)|join(","))]|join("|")')
IFS='|' read -r state labels assignees <<<"$info"

[ "$state" = "OPEN" ] || { echo "#$issue is $state"; exit 1; }
case ",$labels," in *,"type: epic",*|*,coordination,*) echo "#$issue is a container/announcement issue. Claim a sub-task."; exit 1 ;; esac
nb=$(open_blockers "$issue")
[ "${nb:-0}" = "0" ] || { echo "#$issue is blocked by $nb open issue(s). See its Relationships."; exit 1; }

last=$(gh issue view "$issue" --json comments \
  --jq '[.comments[]|select(.body|test("^\\s*(CLAIMED|UNCLAIMED|DONE)"))|.body|split("\n")[0]]|last // ""')
case "$last" in
  DONE*) echo "#$issue already has a DONE comment"; exit 1 ;;
  CLAIMED*)
    if [[ "$last" == *"$agent"* ]]; then echo "Already claimed by $agent. Resume with PROGRESS; do not re-claim."; exit 0; fi
    if [ "${TAKEOVER:-0}" != "1" ]; then echo "Already claimed: $last"; exit 1; fi ;;
esac
if [ "${TAKEOVER:-0}" != "1" ] && [ -n "$assignees" ] && [[ ",$assignees," != *",$me,"* ]]; then
  echo "#$issue is assigned to $assignees"; exit 1
fi

tag="CLAIMED"; [ "${TAKEOVER:-0}" = "1" ] && tag="CLAIMED (takeover)"
body=$(mktemp)
printf '%s by %s / %s\nPlan: %s\nFiles I expect to touch: %s\nETA: %s\n' "$tag" "$me" "$agent" "$plan" "$files" "$eta" > "$body"

gh issue edit "$issue" --add-assignee "$me" >/dev/null 2>&1 || echo "warning: could not assign (permissions?). A comment-only claim still counts."
set_status "$issue" "In progress" || echo "warning: could not move the board card (gh auth refresh -s project?). Move it by hand."
url=$(gh issue comment "$issue" --body-file "$body")
id="${url##*issuecomment-}"

# Re-check: the earliest CLAIMED after the last UNCLAIMED wins. A takeover resets the winner.
winner=""
while IFS='|' read -r cid line; do
  case "$line" in
    UNCLAIMED*) winner="" ;;
    "CLAIMED (takeover)"*) winner="$cid|$line" ;;
    CLAIMED*) [ -z "$winner" ] && winner="$cid|$line" ;;
  esac
done < <(gh api "repos/{owner}/{repo}/issues/$issue/comments" --paginate \
  --jq '.[]|select(.body|test("^\\s*(CLAIMED|UNCLAIMED)"))|"\(.id)|\(.body|split("\n")[0])"')

if [ "${winner%%|*}" != "$id" ]; then
  gh api -X DELETE "repos/{owner}/{repo}/issues/comments/$id" >/dev/null
  case "$winner" in *"by $me /"*) ;; *) gh issue edit "$issue" --remove-assignee "$me" >/dev/null 2>&1 || true ;; esac
  echo "Lost the claim race on #$issue to: ${winner#*|}. Pick other work."
  exit 1
fi
echo "Claimed #$issue as $agent. Now create your worktree/branch state and start."
