#!/usr/bin/env bash
# Auto-commit script: stages all changes and commits with a generated message

set -euo pipefail

cd "$HOME/.pi" || exit 1

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add -A

  changed_files=$(git diff --cached --name-only)
  num_files=$(echo "$changed_files" | wc -l | tr -d ' ')

  if [ "$num_files" -eq 1 ]; then
    if [ -n "$(git diff --cached --diff-filter=A --name-only)" ]; then
      msg="Add $(basename "$changed_files")"
    else
      msg="Update $(basename "$changed_files")"
    fi
  else
    msg="Update ${num_files} files"
  fi

  changes=$(git diff --cached --stat | tail -1)
  git commit -m "$msg" -m "$changes"
  echo "✓ Committed: $msg"
else
  echo "Nothing to commit."
fi
