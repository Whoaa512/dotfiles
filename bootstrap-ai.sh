#!/usr/bin/env bash
# Unified bootstrap for AI agent configs (pi + Claude Code).
#
# Fresh machine or existing machine — idempotent. Run:
#   ~/code/dotfiles/bootstrap-ai.sh
#
# What it does:
#   1. Clones the ~/code/* repos that pi settings.json packages depend on
#   2. Symlinks ~/.pi from dotfiles (init-pi-dotfiles.sh)
#   3. Runs the claude<->pi parity sync if present (work machines only)
#   4. Prints what still needs airbnb access / manual steps
#
# Safe to re-run: clones skip if present, symlinks are fixed in place.
set -euo pipefail

CODE="$HOME/code"
DOTFILES="$CODE/dotfiles"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

clone_if_missing() {
    local dir="$1" url="$2"
    if [ -d "$CODE/$dir/.git" ]; then
        echo "ok:   $dir (present)"
        return
    fi
    if [ -z "$url" ]; then
        warn "$dir missing and has no known remote — clone/copy it manually"
        return
    fi
    info "cloning $dir"
    git clone "$url" "$CODE/$dir"
}

# ── 1. Local code dependencies (referenced by ~/.pi/agent/settings.json) ──
info "Cloning ~/code AI dependencies"
mkdir -p "$CODE"
clone_if_missing pi-mono "git@github.com:Whoaa512/pi-mono.git"
clone_if_missing pi-btw  "https://github.com/dbachelder/pi-btw"
# quintinshaw-pi-dynamic-workflows has no upstream remote — must be copied by hand.
clone_if_missing quintinshaw-pi-dynamic-workflows ""

# Git-pinned pi packages (pi-review, pi-rollback, pi-autoresearch, pi-design-deck)
# are fetched by `pi update` from the SHAs in settings.json — no action needed here.

# ── 2. Pi symlinks ──
info "Symlinking ~/.pi from dotfiles"
"$DOTFILES/ai/pi/init-pi-dotfiles.sh"

# ── 3. Claude <-> pi parity sync (work machines) ──
PARITY="$HOME/work/cj/bin/sync-claude-pi-parity.sh"
if [ -x "$PARITY" ]; then
    info "Running claude<->pi parity sync"
    "$PARITY"
else
    warn "parity sync not found at $PARITY"
    warn "  (expected only on airbnb machines with ~/work/cj checked out)"
fi

# ── 4. Manual / airbnb-only steps ──
cat <<'NOTES'

=== Done. Manual steps that can't be scripted here ===

  * pi auth:        ~/.pi/agent/auth.json      (run `pi` and log in)
  * pi settings:    ~/.pi/agent/settings.json  (copied from template on first run — edit)
  * pi packages:    run `pi update` to fetch git-pinned packages
                    (pi-review, pi-rollback, pi-autoresearch, pi-design-deck)

  Airbnb-only (need ~/work/cj private repo + corp access):
  * work skills/commands live in ~/work/cj/ai — clone that repo first
  * CLAUDE.md / AGENTS.md symlink to ~/work/cj/ai/CLAUDE.home.md
  * on a purely personal machine those links dangle; point them at a
    portable CLAUDE.md instead if you want a work-free setup

NOTES
