#!/usr/bin/env bash
# Shared helpers. Source me: . "$(dirname "$0")/lib.sh"
# Board = GitHub Project "@Airbnb-lockup": https://github.com/users/VeneratedApotheosis/projects/4
# Needs `gh auth` with the `project` scope: gh auth refresh -s project

PROJECT_OWNER="${PROJECT_OWNER:-VeneratedApotheosis}"
PROJECT_NUMBER="${PROJECT_NUMBER:-4}"

# set_status <issue> <Todo|"In progress"|Done>
# Adds the issue to the board if missing (idempotent), then sets its Status field.
set_status() {
  local issue="$1" want="$2" url item pid fid oid
  case "$want" in
    "Todo"|"In progress"|"Done") ;;
    *) echo "status must be: Todo | In progress | Done (got '$want')" >&2; return 1 ;;
  esac
  url=$(gh issue view "$issue" --json url --jq .url) || return 1
  item=$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$url" --format json --jq .id) || return 1
  pid=$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json --jq .id) || return 1
  fid=$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json \
    --jq '.fields[]|select(.name=="Status")|.id') || return 1
  oid=$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json \
    --jq ".fields[]|select(.name==\"Status\")|.options[]|select(.name==\"$want\")|.id") || return 1
  [ -n "$fid" ] && [ -n "$oid" ] || { echo "board has no Status option '$want'" >&2; return 1; }
  gh project item-edit --id "$item" --project-id "$pid" --field-id "$fid" --single-select-option-id "$oid" >/dev/null
}

# open_blockers <issue>: prints how many OPEN issues block it (0 if the API call fails).
open_blockers() {
  gh api "repos/{owner}/{repo}/issues/$1/dependencies/blocked_by" \
    --jq '[.[]|select(.state=="open")]|length' 2>/dev/null || echo 0
}
