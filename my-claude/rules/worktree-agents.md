# Worktree Agent Limitations

When spawning agents to work in git worktrees:

## Known Issue
Agents may fail with Edit/Write permissions on `.worktrees/*` paths even when glob patterns should allow them. Observed behavior:
- Agent enters 40+ retry loop on Edit tool
- Bash sed workarounds also get blocked
- Pattern: `Edit(/project/.worktrees/**)` doesn't grant agent access

## Workarounds

1. **Do work directly from main context** - If agent fails, just do the edits yourself
2. **Keep worktree work simple** - Agents can Read files fine, just not Edit
3. **Agent for research, main for implementation** - Use agents to explore/plan, implement directly

## Session Evidence
- 2025-12-26: Two super-coder agents (a24b441, a2ba5a0) both failed on `.worktrees/boss-game-flow/` edits
- Same edits succeeded immediately when done from main context
