# my-claude

Personal Claude Code config, version controlled.

## Structure

```
├── agents/          # Custom agent definitions
├── commands/        # Slash commands (*.md)
├── hooks/           # Session hooks (shell + JS)
├── skills/          # Skills (SKILL.md format)
├── rules/           # Coding guidelines
├── scripts/
│   ├── autocommit.sh     # Auto-commit projects & plans
│   ├── init-project.sh   # Init project dirs
│   └── prune-projects.sh # Cleanup old project caches
├── settings.json    # Claude Code settings
├── statusline.sh    # Status line script
└── CLAUDE.global.md # Global instructions
```

## Fresh Mac / Existing Machine Setup

Use the unified AI bootstrap (idempotent — safe to re-run):

```sh
~/code/dotfiles/bootstrap-ai.sh
```

This clones the `~/code/*` pi dependencies, symlinks `~/.pi`, and runs the
claude<->pi parity sync (`~/work/cj/bin/sync-claude-pi-parity.sh`) which creates
the `~/.claude/` symlinks (agents, commands, skills, hooks, CLAUDE.md) from this
repo and `~/work/cj/ai`.

To re-sync symlinks only (no cloning), run the parity script directly:

```sh
~/work/cj/bin/sync-claude-pi-parity.sh
```

### Git Tracking for ~/.claude

Initialize git to track projects/plans history:

```sh
cd ~/.claude
git init
cat > .gitignore << 'EOF'
# Ignore large/transient dirs
cache/
debug/
file-history/
session-env/
shell-snapshots/
statsig/
telemetry/
todos/
downloads/
*.log
EOF
git add .
git commit -m "init"
```

### Auto-commit (cron)

Add crontab entry for automatic commits:

```sh
(crontab -l 2>/dev/null; echo '*/2 * * * * ~/.claude/scripts/autocommit.sh') | crontab -
```

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
