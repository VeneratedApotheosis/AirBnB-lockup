#!/usr/bin/env bash
# Print the next free task for an agent, or exit 1 if none. Read-only.
# Usage: scripts/next-task.sh [area,area,...]     e.g. scripts/next-task.sh audit,llm
#        or set AGENT_AREAS=audit,llm
# Free = open, board Status Todo, no assignee, not an epic/coordination/main-broken issue, no open blocker. Lowest issue number first.
set -uo pipefail
. "$(dirname "$0")/lib.sh"

areas="${1:-${AGENT_AREAS:-}}"

todo=$(gh project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --limit 200 \
  --jq '.items[]|select(.content.type=="Issue" and .status=="Todo" and ((.assignees // [])|length)==0)|.content.number' 2>/dev/null) \
  || { echo "board unreadable: run 'gh auth refresh -s project'" >&2; exit 2; }

for n in $(printf '%s\n' $todo | sort -n); do
  info=$(gh issue view "$n" --json state,labels,title --jq '[.state, (.labels|map(.name)|join(",")), .title]|join("|")') || continue
  IFS='|' read -r state labels title <<<"$info"
  [ "$state" = "OPEN" ] || continue
  case ",$labels," in *,"type: epic",*|*,coordination,*|*,main-broken,*) continue ;; esac
  if [ -n "$areas" ]; then
    match=0
    for a in ${areas//,/ }; do case ",$labels," in *,"area: $a",*) match=1 ;; esac; done
    [ "$match" = 1 ] || continue
  fi
  [ "$(open_blockers "$n")" = "0" ] || continue
  echo "#$n $title"
  exit 0
done
echo "no free task${areas:+ in areas: $areas}" >&2
exit 1
