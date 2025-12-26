#!/bin/bash
set -e

DOTFILES="$HOME/code/cj/dotfiles/my-claude"
CLAUDE_DIR="$HOME/.claude"

echo "Syncing Claude config..."

# Directory symlinks (agents, commands, hooks, skills, rules)
for dir in agents commands hooks skills rules; do
  if [ -d "$DOTFILES/$dir" ]; then
    if [ ! -L "$CLAUDE_DIR/$dir" ]; then
      rm -rf "$CLAUDE_DIR/$dir"
      ln -s "$DOTFILES/$dir" "$CLAUDE_DIR/$dir"
      echo "  $dir/ (dir)"
    fi
  fi
done

# Scripts (individual symlinks)
mkdir -p "$CLAUDE_DIR/scripts"
for f in "$DOTFILES/scripts"/*.sh; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  [ "$name" = "sync-claude.sh" ] && continue  # skip self
  target="$CLAUDE_DIR/scripts/$name"
  rm -f "$target"
  ln -s "$f" "$target"
  echo "  scripts/$name"
done

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
