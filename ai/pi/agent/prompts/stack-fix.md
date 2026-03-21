---
description: Clean up Graphite stack — squash fixups, fix CI, absorb, ensure hygiene
---
Fix up the current Graphite stack.

## Steps

### 1. Assess stack health
```bash
gt log short --stack --no-interactive
```
For each branch, check:
- Commit count and whether fixup/squash commits exist
- CI status (`GH_HOST=git.musta.ch gh pr checks <branch>` or buildkite)
- Whether commits belong on the right branch

### 2. Identify issues
- **Fixup commits** that should be absorbed (`gt absorb`)
- **Misplaced commits** on wrong branch
- **Lint/test failures** from CI
- **Messy history** — multiple tiny commits that should be squashed
- **Format-only commits** that leaked outside the working directory

### 3. Propose cleanup plan
Present a numbered plan like:
```
1. Branch X: squash 3 fixup commits via gt absorb
2. Branch Y: fix lint failure (specific error)
3. Branch Z: move commit abc123 to correct branch
```

**Ask user to confirm before executing.**

### 4. Execute
- Fix lint/test issues first (they block everything)
- `gt absorb` for fixups
- Interactive rebase only if needed and user approves
- Ensure commit messages have appropriate prefixes
- `gt restack` after changes

### 5. Verify
Re-run stack overview to confirm clean state.

If $@ is provided, focus on: $@
