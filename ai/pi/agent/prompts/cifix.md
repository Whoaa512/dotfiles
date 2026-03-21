---
description: Debug CI failure, fix it, and absorb into correct branch (gt stack aware)
---
Fix CI failures: $@

## Process

### 1. Identify failures
- If a Buildkite URL is provided, use `bk` CLI to get failure details
- Otherwise, check current branch: `GH_HOST=git.musta.ch gh pr checks $(git branch --show-current)` (adjust host if needed)
- For graphite stacks, check ALL branches: iterate the stack and report which branches have failures

### 2. Diagnose
- Use `bk` CLI to get job logs for failed steps (see buildkite skill)
- Identify root cause: lint, test, build, flaky, infra

### 3. Fix
- **Lint:** run the repo's lint-fix command (`yak s lint-fix` or `yak s lint:fix` with appropriate path)
- **Test:** read test output, fix the failing test or the code it tests
- **Build:** check imports, types, missing deps

### 4. Absorb into correct branch
- If in a graphite stack: `gt absorb` to place fix in the right branch
- If absorb doesn't work: make a fixup commit, note which branch it belongs to
- `gt restack` if needed after absorb

### 5. Push and verify
- `gt submit` or `git push --force-with-lease`
- Wait 120s, re-check CI
- Max 3 rounds

If no URL provided, check current branch CI automatically.
