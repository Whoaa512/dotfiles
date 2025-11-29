#!/usr/bin/env bash
# Auto-commit script for Claude's dotfiles
HOME_CLAUDE="$HOME/.claude"
git -C "$HOME_CLAUDE" add projects plans
git -C "$HOME_CLAUDE" commit -m "Auto-commit: projects & plans $(date +"%Y-%m-%d %H:%M:%S")"
