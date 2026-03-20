---
description: Overview of Graphite stack with branch summaries, PR status, and complexity scores
---

<task>
Analyze the current Graphite stack and display an overview table with branch details.
</task>

<instructions>
## 1. Get stack structure
```bash
gt log short --stack --no-interactive
```
The output lists branches top-to-bottom (top = current). Reverse for display so stack reads bottom-up (base first).

## 2. Batch-gather data efficiently
For each adjacent pair (base..head), run these in a single bash block to minimize tool calls:

```bash
# For ALL branches at once — one bash call, not N
for pair in "label:base:head" ...; do
  name=$(echo "$pair" | cut -d: -f1)
  base=$(echo "$pair" | cut -d: -f2)
  head=$(echo "$pair" | cut -d: -f3)

  # Diff stats (total)
  git diff --shortstat "$base".."$head"

  # Test % — count changed lines in test files vs total
  test_lines=$(git diff "$base".."$head" -- '**/test_*' '**/tests/**' '**/*_test.*' | grep -cE '^\+[^+]|^-[^-]')
  total_lines=$(git diff "$base".."$head" | grep -cE '^\+[^+]|^-[^-]')

  # Commit messages (for summary)
  git log "$base".."$head" --oneline
done
```

PR metadata — also batch via single gh call per branch:
```bash
GH_HOST=git.musta.ch gh pr list --head "$branch" --json number,title,state,isDraft,reviewDecision,statusCheckRollup --limit 1
```

## 3. Derive CI status from statusCheckRollup
- Look for `buildkite/*-required` context: SUCCESS=🟢, FAILURE=🔴, PENDING=🟡
- Ignore `Test Plan` and `Code Review` contexts (not CI)

## 4. Investigate required CI failures
For any branch where `buildkite/*-required` is FAILURE, **always** dig into the build logs to explain why:

```bash
# Parse pipeline slug + build number from the targetUrl
# e.g. https://buildkite.com/airbnb/airbnb-twig-ci-required/builds/87970
bk build view -p <pipeline-slug> <build-number> -o json | jq '{state, jobs: [.jobs[] | select(.state == "failed") | {name, state, id}]}'

# For each failed job, fetch and tail the log
bk api /pipelines/<pipeline-slug>/builds/<build-number>/jobs/<job-id>/log | jq -r '.content' | tail -80
```

Extract from the logs:
- **Failing test names** and their file paths
- **Root cause** (the actual error/exception, not just "test failed")
- **Which branch introduced the failure** — if multiple branches fail with the same error, note this

Include a **CI Failure Analysis** section after the table with:
- Error message and location
- Root cause explanation
- Which stack nodes are affected
- Suggested fix if obvious from the error

## 5. Output the table
</instructions>

<output_format>
| # | Branch | PR | Summary | Size | Tests | Complexity |
|---|--------|----|---------|------|-------|------------|
| 1 | `feat/xyz` | [#123](url) ✅ ready | Add user auth flow | 🟢 +50/-20 | 🧪 45% | 🟡 3 |

**Tests column**: percentage of diff that is test code. High test % means the Size indicator overstates review burden — note this in the summary when test% > 50%.

PR status: 📝 draft, ✅ ready, 🟣 merged
Review: 👀 pending, ✅ approved, ❌ changes requested
CI: 🟢 pass, 🔴 fail, 🟡 running

Size indicators (total added+deleted):
- 🟢 Small (<100 lines)
- 🟡 Medium (100-300 lines)
- 🟠 Large (300-500 lines)
- 🔴 XL (500+ lines)

Complexity (factor in test% — high test coverage lowers effective complexity):
- 🟢 1 - Trivial (typos, config)
- 🟢 2 - Simple (single file, clear change)
- 🟡 3 - Moderate (multi-file, some logic)
- 🟠 4 - Complex (architecture, many files)
- 🔴 5 - Intense (core changes, risky)

## After the table, include:
1. **Status summary** — counts of draft/ready/merged, CI pass/fail, avg test%
2. **Size context** — for any node with test% > 50%, note the effective prod-code size
3. **Action items** — CI failures, PRs ready to unmark draft, etc.
</output_format>
