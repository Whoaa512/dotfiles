#!/bin/bash
# Symlink dotfiles/ai/pi to ~/.pi for portable pi agent config
# Secrets (auth.json) and sessions are never tracked.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
TARGET_DIR="$HOME/.pi"
MY_CLAUDE_DIR="$(cd "$SCRIPT_DIR/../../my-claude" && pwd)"
PI_MONO_EXT="$HOME/code/pi-mono/packages/coding-agent/examples/extensions"

link_file() {
    local src="$1" target="$2"
    if [ ! -e "$src" ]; then
        echo "skip: $src (missing)"
        return
    fi
    mkdir -p "$(dirname "$target")"
    if [ -L "$target" ]; then
        current=$(readlink "$target")
        if [ "$current" = "$src" ]; then
            echo "ok:   ${target#$TARGET_DIR/}"
            return
        fi
        echo "fix:  ${target#$TARGET_DIR/}"
        rm "$target"
    elif [ -e "$target" ]; then
        echo "back: ${target#$TARGET_DIR/} -> .bak"
        mv "$target" "$target.bak"
    fi
    ln -s "$src" "$target"
    echo "link: ${target#$TARGET_DIR/}"
}

mkdir -p "$TARGET_DIR/agent/"{agents,extensions/{plan-mode,subagent},prompts,skills/{asana,graphite,gt-pr-align},sessions}

echo "=== Top-level ==="
link_file "$SOURCE_DIR/.gitignore"     "$TARGET_DIR/.gitignore"
link_file "$SOURCE_DIR/CLAUDE.md"      "$TARGET_DIR/CLAUDE.md"
link_file "$SOURCE_DIR/auto-commit.sh" "$TARGET_DIR/auto-commit.sh"

# AGENTS.md -> CLAUDE.md alias
if [ ! -L "$TARGET_DIR/AGENTS.md" ] || [ "$(readlink "$TARGET_DIR/AGENTS.md")" != "CLAUDE.md" ]; then
    rm -f "$TARGET_DIR/AGENTS.md"
    ln -s CLAUDE.md "$TARGET_DIR/AGENTS.md"
    echo "link: AGENTS.md -> CLAUDE.md"
else
    echo "ok:   AGENTS.md"
fi

echo ""
echo "=== Settings ==="
link_file "$SOURCE_DIR/agent/settings.json" "$TARGET_DIR/agent/settings.json"

echo ""
echo "=== Pi-only agents (from dotfiles/ai/pi) ==="
for f in planner.md reviewer.md scout.md worker.md; do
    link_file "$SOURCE_DIR/agent/agents/$f" "$TARGET_DIR/agent/agents/$f"
done

echo ""
echo "=== Shared agents (from dotfiles/my-claude) ==="
for f in "$MY_CLAUDE_DIR/agents/"*.md; do
    name=$(basename "$f")
    link_file "$f" "$TARGET_DIR/agent/agents/$name"
done

echo ""
echo "=== Local extensions (from dotfiles/ai/pi) ==="
for f in claude-rules.ts elapsed-timer.ts external-context.ts footer.ts titlebar-spinner.ts todo.ts; do
    link_file "$SOURCE_DIR/agent/extensions/$f" "$TARGET_DIR/agent/extensions/$f"
done

echo ""
echo "=== Pi-mono extensions (from pi-mono examples) ==="
if [ -d "$PI_MONO_EXT" ]; then
    for f in auto-commit-on-exit.ts bookmark.ts git-checkpoint.ts handoff.ts question.ts questionnaire.ts summarize.ts; do
        link_file "$PI_MONO_EXT/$f" "$TARGET_DIR/agent/extensions/$f"
    done
    # Directory extensions
    for d in plan-mode subagent; do
        for f in "$PI_MONO_EXT/$d/"*.ts; do
            name=$(basename "$f")
            link_file "$f" "$TARGET_DIR/agent/extensions/$d/$name"
        done
    done
else
    echo "warn: pi-mono not found at $PI_MONO_EXT, skipping pi-mono extensions"
fi

echo ""
echo "=== Prompts ==="
for f in "$SOURCE_DIR/agent/prompts/"*.md; do
    name=$(basename "$f")
    link_file "$f" "$TARGET_DIR/agent/prompts/$name"
done

echo ""
echo "=== Skills ==="
for s in asana graphite gt-pr-align; do
    link_file "$SOURCE_DIR/agent/skills/$s/SKILL.md" "$TARGET_DIR/agent/skills/$s/SKILL.md"
done

echo ""
echo "Done. ~/.pi symlinked from:"
echo "  config:     $SOURCE_DIR"
echo "  agents:     $MY_CLAUDE_DIR/agents"
echo "  extensions: $PI_MONO_EXT"
echo ""
echo "NOT synced (machine-local):"
echo "  agent/auth.json"
echo "  agent/sessions/"
echo "  auto-commit.log"
