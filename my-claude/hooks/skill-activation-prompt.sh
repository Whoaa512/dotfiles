#!/bin/bash
set -e
cd ~/.claude/hooks
# Pass PPID to Node so it can find the correct context file
export CLAUDE_PPID="$PPID"
cat | node dist/skill-activation-prompt.mjs
