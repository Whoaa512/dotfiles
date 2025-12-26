Run isolated tasks in parallel using git worktrees and sub-agents.

**Arguments:** $ARGUMENTS (optional focus area, e.g. "UI bugs", "performance", "abilities")

## Phase 1: Find Tasks

1. Run `bd ready` to see unblocked work
2. If $ARGUMENTS provided, filter to tasks matching that focus area
3. Identify 2-8 tasks that are:
   - Isolated (minimal overlap with each other)
   - Self-contained (can be done independently)
   - Quick wins preferred unless user specifies otherwise
4. Present the candidates and ask user which to run

## Phase 2: Parallel Pipelines

Spawn one sub-agent per task **all in parallel**. Each agent runs its own complete pipeline:

```
Work on issue <bead-id>: <title>

You own the full lifecycle: implement → validate → fix → repeat until done.

Setup:
1. Create worktree: `git worktree add .worktrees/<short-name> -b feat/<branch-name>`
2. Assign port: 518X (where X = your task number, e.g. 5181, 5182...)
3. Work in that directory

Implement:
- Build the feature/fix
- Run `pnpm lint:fix` before committing
- Make small focused commits
- Run tests if relevant

Validate:
1. Start dev server: `tmux new-session -d -s <name>-test 'pnpm dev --port <port>'`
2. Wait for server, then:
   - `devtools go http://localhost:<port>`
   - `devtools screenshot /tmp/<name>.png`
   - Interact with the feature
   - `devtools console` - check for errors
3. `tmux kill-session -t <name>-test`

Iterate:
- If issues found, fix and re-validate
- Repeat until feature works correctly

Report when done: branch name, what was implemented, validation results, any caveats.
```

Wait for all agents to complete their pipelines.

## Phase 3: Merge

Once all pipelines succeed, ask user to confirm merge. Then:

1. For each branch, rebase onto main and merge:
   ```
   cd .worktrees/<name> && git rebase main
   cd /Users/cjw/code/digidice && git merge --ff-only feat/<branch>
   ```
2. Remove worktrees: `git worktree remove .worktrees/<name>`
3. Delete branches: `git branch -d feat/<branch>`
4. Close beads: `bd close <id>`
5. Kill any remaining tmux sessions

Report final summary of merged features.
