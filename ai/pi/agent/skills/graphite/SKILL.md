---
name: graphite
description: Graphite CLI (gt) for stacked PRs. Use when repo uses graphite for PR workflow.
---

# Graphite CLI (`gt`)

Stacked PR workflow. Only use when repo specifically calls for it.

## Core Concepts
- `gt create` = `git commit` but creates a stack node (branch)
- `gt modify` = `git commit --amend`
- Stack = chain of dependent PRs

## Critical Rules
- `git add ...` BEFORE `gt create` - graphite creates empty branches if nothing staged
- `--commit` flag required with `gt modify --commit -m "..."` to create distinct commit

## Common Commands

### Create/Modify
```bash
git add <files>
gt create -m "feat: add thing"      # New stack node
gt modify                            # Amend current (like git commit --amend)
gt modify --commit -m "fix: typo"   # Distinct commit in same branch
```

### View Stack
```bash
gt log short --stack --no-interactive
```

### Fix Existing Stack
```bash
gt absorb                            # Auto-fixup commits into right branches
gt fold                              # Merge branch into parent
gt create --insert                   # Insert new branch between current and child
```

### Sync & Submit
```bash
gt sync                              # Rebase stack on trunk
gt submit                            # Push stack and create/update PRs
```
