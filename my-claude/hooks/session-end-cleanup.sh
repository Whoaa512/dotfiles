#!/bin/bash
set -e
cd ~/.claude/hooks
cat | node dist/session-end-cleanup.mjs
