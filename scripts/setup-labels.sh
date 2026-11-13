#!/usr/bin/env bash
# One-time (idempotent): create labels and the MVP milestone. See docs/ISSUES.md. Needs write access.
# Status is NOT a label: it lives on the board (Todo / In progress / Done).
set -euo pipefail
mk() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "ok $1"; }

mk "type: epic"      3E4B9E "Parent tracking issue. Not worked on directly"
mk "type: feature"   A2EEEF "New user-facing capability"
mk "type: bug"       D73A4A "Something is broken"
mk "type: refactor"  FEF2C0 "Restructure code, same behavior"
mk "type: test"      BFE5BF "Add or fix tests"
mk "type: docs"      0075CA "Documentation"
mk "type: chore"     EDEDED "Setup, config, tooling"

mk "area: shared"      5319E7 "src/shared contracts"
mk "area: background"  1D76DB "Service worker"
mk "area: content"     0075CA "Content script"
mk "area: audit"       006B75 "axe-core runner"
mk "area: llm"         B60205 "LLM client and prompts"
mk "area: patch"       C2E0C6 "Patch model and engine"
mk "area: ui"          D4C5F9 "Popup / side panel / options"
mk "area: tests"       FBCA04 "Fixtures, unit and e2e tests"
mk "area: infra"       BFD4F2 "Build, CI, manifest, docs"

mk "main-broken"  B60205 "CI red on main; fix before new work"
mk "coordination" C5DEF5 "Pinned announcements and roster"

if gh api "repos/{owner}/{repo}/milestones" --jq '.[].title' | grep -qx MVP; then
  echo "ok milestone MVP (exists)"
else
  gh api "repos/{owner}/{repo}/milestones" -f title=MVP -f description="One-day build: scan, suggest, apply, rescan, undo" >/dev/null && echo "ok milestone MVP"
fi
