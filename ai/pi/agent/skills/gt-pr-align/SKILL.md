---
name: gt-pr-align
description: Align PR titles and descriptions with repo template. Use when PRs need cleanup or template compliance.
---

# PR Alignment

Analyze current branch/stack PRs and ensure titles and descriptions align with the repo's pull request template.

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
   - Compare title against commits and changes
   - Check all template sections filled
   - Identify missing "why" context
   - Note empty/boilerplate sections

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
