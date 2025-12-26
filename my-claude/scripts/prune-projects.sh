#!/bin/bash
# Prune old project caches to speed up claude startup
# Projects dir can grow to 600MB+ and doubles startup time

DAYS=${1:-14}
PROJECTS_DIR="$HOME/.claude/projects"

if [[ ! -d "$PROJECTS_DIR" ]]; then
  exit 0
fi

find "$PROJECTS_DIR" -maxdepth 1 -type d -mtime +$DAYS -exec rm -rf {} \;
