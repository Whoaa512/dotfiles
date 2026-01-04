---
globs: [".claude/hooks/**/*"]
---

# Hook Development Rules

When working with files in `.claude/hooks/`:

## Pattern
Shell wrapper (.sh) → TypeScript (.ts) via `npx tsx`

## Shell Wrapper Template
```bash
#!/bin/bash
set -e
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx <handler>.ts
```

## TypeScript Handler Pattern
```typescript
interface HookInput {
  // Event-specific fields
}

async function main() {
  const input: HookInput = JSON.parse(await readStdin());

  // Process input

  const output = {
    result: 'continue',  // or 'block'
    message: 'Optional system reminder'
  };

  console.log(JSON.stringify(output));
}
```

## Hook Events
- **PreToolUse** - Before tool execution (can block)
- **PostToolUse** - After tool execution
- **UserPromptSubmit** - Before processing user prompt
- **PreCompact** - Before context compaction
- **SessionStart** - On session start/resume/compact
- **Stop** - When agent finishes

## Testing
Test hooks manually:
```bash
echo '{"type": "resume"}' | .claude/hooks/session-start-continuity.sh
```

## Registration
Add hooks to `.claude/settings.json`:
```json
{
  "hooks": {
    "EventName": [{
      "matcher": ["pattern"],  // Optional
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/hook.sh"
      }]
    }]
  }
}
```

## Injection Defense Hooks

The project includes prompt injection defense via `injection-defense.ts`:

### How it works
1. **PostToolUse** tracks tainted content (from WebFetch, Read, etc.)
2. **PreToolUse** checks Write/Edit/Bash args for:
   - Tainted content hashes
   - Injection pattern regex (e.g., "ignore previous instructions")
   - Dangerous bash commands with tainted args

### Risk levels
- **High** - Block immediately (direct injection, tainted content in args)
- **Medium** - Block (suspicious patterns like prompt escaping)
- **Low** - Warn only (single emphasis word like IMPORTANT)

### Read-only tools bypass
`Read`, `Glob`, `Grep`, `LSP` - always allowed (no state change)

### Testing
```bash
cd .claude/hooks && bun test
```

### Debug
Set `DEBUG=1` before running to see taint tracking logs.
