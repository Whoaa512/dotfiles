---
description: Review last N commits for correctness, complexity, optimality, test quality, and AI slop
---
Review the last $@ commits on the current branch.

## Guiding Principles

- **Only flag issues introduced by these commits.** Pre-existing problems are out of scope.
- **Be provable, not speculative.** If you claim something breaks, identify the actual affected code. "This might cause issues" is not a finding.
- **Prefer no findings over false positives.** If nothing would definitely be fixed by the author, say so. Don't manufacture issues to justify the review.
- **Match the rigor of the codebase.** Don't demand detailed input validation in a repo of quick scripts. Calibrate to the project's existing standards.
- **Ignore trivial style** unless it obscures meaning or violates documented project standards.

## Review Criteria (evaluate ALL)

1. **Correctness** — bugs, logic errors, edge cases missed. Must be discrete and actionable.
2. **Completeness** — anything critical missing from the implementation
3. **Complexity** — over-engineered? simpler approach exists?
4. **Optimality** — is this the most optimal way to solve the issue? If not, what's better and why?
5. **Test usefulness** — do tests actually catch regressions or just pad coverage?
6. **AI slop check** — would a human reviewer return this saying it looks like AI-generated boilerplate? Specifically: unnecessary comments, over-abstraction, verbose where terse is better, patterns that scream "LLM wrote this"

## Process

1. `git log --oneline -N` to see the commits
2. `git diff HEAD~N..HEAD` for the full diff
3. Read changed files in full to understand context around the diff
4. Evaluate against all 6 criteria above

## Output Format

### Verdict: SHIP / FIX FIRST / RETHINK

**Score:** X/10

**Issues** (ordered by severity, omit empty tiers):

Each issue must include:
- Severity: 🔴 P0 (blocks release, universal) · 🟡 P1 (urgent, next cycle) · 🟠 P2 (should fix eventually) · 🔵 P3 (nit)
- Confidence: low / medium / high — how sure are you this is real?
- Location: `file:line-range`
- One paragraph max explaining *why* it's a problem and *when* it manifests
- If applicable: a concrete fix (≤3 lines of code, in a code block)

Example:
```
1. 🟡 P1 [high] `src/handler.rs:42-45` — Off-by-one in slice bounds causes panic when input vec is empty. Fix: `&items[..items.len().saturating_sub(1)]`
```

If no issues found, explicitly state: **No issues found.**

**What's good:**
- ...

**Would a reviewer bounce this?** Yes/No — because...

If verdict is FIX FIRST, ask "intme for what to fix" and then fix.
