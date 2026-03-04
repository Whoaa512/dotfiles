---
description: Overview of Graphite stack with branch summaries, PR status, and complexity scores
---

<task>
Analyze the current Graphite stack and display an overview table with branch details.
</task>

<instructions>
1. Run `gt log short --stack --no-interactive` to get the stack
2. For each branch in the stack, gather:
   - Branch name
   - PR number, title, status (draft/ready/merged)
   - Review and CI status
   - Brief summary of changes (from commit messages or diff)
   - Size: additions/deletions via `git diff --stat`
   - Review complexity score (1-5)
3. Output a markdown table with emoji indicators for size and complexity
</instructions>

<output_format>
| Branch | PR | Summary | Size | Complexity |
|--------|----|---------|------|------------|
| feat/xyz | #123 ✅ ready | Add user auth flow | 🟢 +50/-20 | 🟡 2 |

PR status: 📝 draft, ✅ ready, 🟣 merged
Review: 👀 pending, ✅ approved, ❌ changes requested
CI: 🟢 pass, 🔴 fail, 🟡 running

Size indicators:
- 🟢 Small (<100 lines)
- 🟡 Medium (100-300 lines)
- 🟠 Large (300-500 lines)
- 🔴 XL (500+ lines)

Complexity indicators:
- 🟢 1 - Trivial (typos, config)
- 🟢 2 - Simple (single file, clear change)
- 🟡 3 - Moderate (multi-file, some logic)
- 🟠 4 - Complex (architecture, many files)
- 🔴 5 - Intense (core changes, risky)
</output_format>
