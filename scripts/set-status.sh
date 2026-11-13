#!/usr/bin/env bash
# Move an issue's card on the board. Usage: scripts/set-status.sh <issue> <Todo|"In progress"|Done>
# Release a claim: post UNCLAIMED, `gh issue edit <N> --remove-assignee @me`, then `scripts/set-status.sh <N> Todo`.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
set_status "${1:?issue number}" "${2:?Todo | In progress | Done}"
echo "#$1 -> $2"
