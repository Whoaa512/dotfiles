# my-claude

Personal Claude Code config, version controlled.

## Structure

```
├── agents/          # Custom agent definitions
├── commands/        # Slash commands (*.md)
├── hooks/           # Session hooks (shell + JS)
│   └── dist/        # Compiled JS
├── skills/          # Skills (SKILL.md format)
├── rules/           # Coding guidelines
├── scripts/
│   ├── sync-claude.sh    # Sync to ~/.claude
│   └── init-project.sh   # Init project dirs
├── settings.json    # Claude Code settings
├── statusline.sh    # Status line script
└── CLAUDE.global.md # Global instructions
```

## Setup

```sh
./scripts/sync-claude.sh
```

Creates symlinks from `~/.claude/` to this repo.

## Per-Project Init

For continuity features (ledgers, handoffs):

```sh
~/.claude/scripts/init-project.sh
```

Creates:
- `thoughts/ledgers/` - Continuity ledgers
- `thoughts/shared/handoffs/` - Session handoffs
- `thoughts/shared/plans/` - Implementation plans
- `.claude/cache/` - Local cache (gitignored)

## TypeScript Preflight (Future)

Add to PostToolUse when tsgo compiler is ready:
```json
{ "matcher": "Edit|Write", "hooks": [{"type": "command", "command": "$HOME/.claude/hooks/typescript-preflight.sh", "timeout": 40}] }
```
