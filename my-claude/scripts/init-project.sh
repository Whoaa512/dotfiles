#!/bin/bash
# Initialize a project for continuity system
# Run in any project to set up required directories.
#
# Usage: init-project.sh

set -e

echo "Initializing project for Claude continuity..."

mkdir -p thoughts/ledgers
mkdir -p thoughts/shared/handoffs
mkdir -p thoughts/shared/plans
mkdir -p .claude/cache

# Add to .gitignore if exists
if [ -f .gitignore ]; then
  if ! grep -q ".claude/cache/" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Claude cache" >> .gitignore
    echo ".claude/cache/" >> .gitignore
    echo "  Added .claude/cache/ to .gitignore"
  fi
fi

echo "Done. Structure:"
echo "  thoughts/ledgers/           - Continuity ledgers"
echo "  thoughts/shared/handoffs/   - Session handoffs"
echo "  thoughts/shared/plans/      - Implementation plans"
echo "  .claude/cache/              - Local cache (gitignored)"
