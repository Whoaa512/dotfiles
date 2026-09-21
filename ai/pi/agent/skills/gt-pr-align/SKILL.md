---
name: gt-pr-align
description: Align PR titles and descriptions with the repo PR template, for one PR or a whole graphite stack. Use when cj says "fix the PR desc", "align PR titles/descriptions", "clean up the PR body", "an agent made these PRs and the descriptions are weird", "do it for the whole stack", "drop the em dashes from the PR descriptions", or after pushing a stack before requesting review.
---

# PR Alignment

Analyze current branch/stack PRs and ensure titles and descriptions align with the repo's pull request template.

**Scope default: the whole stack.** If `gt log short --stack` shows a stack, process every
branch in it in one pass (trunk-most first so titles read in order). Only narrow to the
current branch when cj names a single PR/branch. Ask once at the start if ambiguous, never
per PR.

## Body Style

PR bodies should be **lean and why-focused**. Each template section should contain only what a reviewer needs:

- No em dashes anywhere in title or body; commas, semicolons, or a new sentence.
- **Summary**: Lead with *why* this change exists (the problem/motivation), then a one-liner *what* it does to address it. No commit message dumps, no implementation details — those belong in the diff.
- **How was it tested?**: Concise bullet list of test methods used.
- **Reviewers**: Tag if applicable, skip if not.

**Don't** paste commit messages or detailed implementation notes above or inside the Summary. The body is not a changelog — it's context for the reviewer.

## Steps

1. **Detect context:**
   ```bash
   gt log short --stack --no-interactive  # Check for graphite stack
   git branch --show-current              # Fallback to current branch
   gh pr list --head <branch> --json number,title,body,url
   ```

2. **Find PR template** (check in order):
   - `.github/PULL_REQUEST_TEMPLATE.md`
   - `.github/pull_request_template.md`
   - `docs/pull_request_template.md`
   - `PULL_REQUEST_TEMPLATE.md`
   - If none: use defaults (title, summary, why, test plan)

3. **Analyze each PR:**
   - Check all template sections are filled (not boilerplate)
   - Check body follows lean style: why + one-liner what, no commit dumps
   - Identify missing "why" context
   - Check title consistency across stack (common prefix, etc.)

4. **Present findings:**
   | PR | Title | Alignment |
   |----|-------|-----------|
   | #123 | Add auth flow | ⚠️ Missing: why, test plan |

5. **Interview user** for gaps (use question tool)

6. **Draft updates** and get approval

7. **Apply:**
   ```bash
   gh pr edit <number> --title "..." --body "..."
   ```
