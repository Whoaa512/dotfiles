#!/bin/bash
set -e

DOTFILES="$HOME/dotfiles/my-claude"
CLAUDE_DIR="$HOME/.claude"

echo "Syncing Claude config..."

# Sync commands (individual symlinks)
mkdir -p "$CLAUDE_DIR/commands"
for f in "$DOTFILES/commands"/*.md; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  target="$CLAUDE_DIR/commands/$name"
  rm -f "$target"
  ln -s "$f" "$target"
  echo "  commands/$name"
done

# Agents dir symlink
if [ ! -L "$CLAUDE_DIR/agents" ]; then
  rm -rf "$CLAUDE_DIR/agents"
  ln -s "$DOTFILES/agents" "$CLAUDE_DIR/agents"
  echo "  agents/ (dir)"
fi

# Core files
for f in CLAUDE.global.md settings.json statusline.sh; do
  [ -f "$DOTFILES/$f" ] || continue
  case "$f" in
    CLAUDE.global.md) target="$CLAUDE_DIR/CLAUDE.md" ;;
    *) target="$CLAUDE_DIR/$f" ;;
  esac
  if [ ! -L "$target" ]; then
    rm -f "$target"
    ln -s "$DOTFILES/$f" "$target"
    echo "  $f"
  fi
done

echo "Done."
