---
description: Reflect on session learnings and update project CLAUDE.md with new conventions, gotchas, shortcuts
---
Review this session's conversation and extract learnings that should persist across future sessions.

## What to look for

Scan the conversation for:
1. **Corrections** — things you (the agent) got wrong that needed fixing ("no, use X not Y", "the host is git.musta.ch", "don't forget to...")
2. **Conventions discovered** — repo-specific patterns ("lint lives in .config/mise.toml", "use yak s lint:fix not lint-fix", "tests go in _test suffix not test_ prefix")
3. **Tool gotchas** — things that didn't work as expected ("gt absorb doesn't work here because...", "need iap-auth for this URL")
4. **Workflow preferences** — how the user wants things done in this repo ("always prefix commits with airchat-review:", "use gt not git for this repo")
5. **Architecture decisions** — design choices worth remembering ("we chose X over Y because Z", "this is gated behind sitar flag X")
6. **Dead ends** — approaches that were tried and abandoned ("don't try X, it doesn't work because Y")

## Process

1. Read the current project CLAUDE.md (check `.claude/CLAUDE.md`, `CLAUDE.md`, and `.pi/CLAUDE.md`)
2. Read `~/.claude/CLAUDE.md` to avoid duplicating global rules
3. Identify learnings from this session that aren't already captured
4. For each learning, classify as:
   - **ADD** — new rule/convention to add
   - **EDIT** — existing rule that needs updating/clarifying
   - **REMOVE** — stale rule that's no longer true
5. Present proposed changes and ask for confirmation
6. Apply changes, commit with message explaining why

## Output Format

```
## Session Learnings → CLAUDE.md updates

### ADD
- [ ] "When running lint in this repo, use `yak s lint:fix projects/<name>` not bare lint"
- [ ] "Commit messages must have `<project>:` prefix"

### EDIT  
- [ ] Line 42: Update sitar flag name from `risk_score` to `risk_score_enabled`

### REMOVE
- [ ] Line 18: "Use jorb for comments" — we migrated to direct GH API in 8e9a6ea4c

Confirm? (y/n)
```

## Rules
- Keep entries terse — these are for agents, not humans
- Don't add things already in global CLAUDE.md
- Don't add obvious things ("run tests before committing")
- DO add repo-specific gotchas that waste time when forgotten
- Preserve existing structure/sections of the CLAUDE.md
