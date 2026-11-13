#!/usr/bin/env bash
# One-time (idempotent): create the label set from docs/COORDINATION.md section 3. Needs write access.
set -euo pipefail
mk() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "ok $1"; }

mk status:ready        0E8A16 "Free to claim"
mk status:in-progress  FBCA04 "Claimed and being worked on"
mk status:blocked      D93F0B "Waiting on something; see latest comment"

mk area:shared      5319E7 "src/shared contracts"
mk area:background  1D76DB "Service worker"
mk area:content     0075CA "Content script"
mk area:audit       006B75 "axe-core runner"
mk area:llm         B60205 "LLM client and prompts"
mk area:patch       C2E0C6 "Patch model and engine"
mk area:ui          D4C5F9 "Popup / side panel / options"
mk area:infra       BFD4F2 "Build, CI, manifest, docs"

mk type:feature  A2EEEF "New capability"
mk type:bug      D73A4A "Something is broken"
mk type:chore    EDEDED "Maintenance"

mk main-broken   B60205 "CI red on main; fix before new work"
mk coordination  C5DEF5 "Pinned announcements and roster"
