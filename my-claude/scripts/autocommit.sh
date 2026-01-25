#!/usr/bin/env bash
# Auto-commit script for Claude's dotfiles
HOME_CLAUDE="$HOME/.claude"
git -C "$HOME_CLAUDE" add projects plans todos paste-cache debug file-history stats-cache.json cache/*.md history.jsonl
git -C "$HOME_CLAUDE" commit -m "Auto-commit: projects & plans $(date +"%Y-%m-%d %H:%M:%S")"
