---
description: Review last N commits for correctness, complexity, optimality, test quality, and AI slop
---
Review the last $@ commits on the current branch.

## Review Criteria (evaluate ALL)

1. **Correctness** — bugs, logic errors, edge cases missed
2. **Completeness** — anything critical missing from implementation
3. **Complexity** — over-engineered? simpler approach exists?
4. **Optimality** — is this the most optimal way to solve the issue? If not, what's better and why?
5. **Test usefulness** — do tests actually catch regressions or just pad coverage?
6. **AI slop check** — would a human reviewer return this saying it looks like AI-generated boilerplate? Specifically: unnecessary comments, over-abstraction, verbose where terse is better, patterns that scream "LLM wrote this"

## Process

1. `git log --oneline -N` to see the commits
2. `git diff HEAD~N..HEAD --stat` for scope
3. Read changed files, understand intent from commit messages
4. Evaluate against all 6 criteria above

## Output Format

### Verdict: SHIP / FIX FIRST / RETHINK

**Score:** X/10

**What's good:**
- ...

**Issues** (ordered by severity):
1. 🔴 [blocker] ...
2. 🟡 [should fix] ...
3. 🔵 [nit] ...

**Would a reviewer bounce this?** Yes/No — because...

If verdict is FIX FIRST, ask "intme for what to fix" and then fix.
