---
description: Generate self-contained prompt for continuing work in a fresh session
---
Generate a handoff prompt for a fresh session to continue the current work.

## Gather State

1. **Branch/stack:** `git branch --show-current`, `gt log short --stack --no-interactive` (if graphite)
2. **Recent commits:** `git log --oneline -10`
3. **Uncommitted changes:** `git status --short`
4. **Plan docs:** check for @docs/*.md, any referenced plan files in recent commit messages
5. **Open TODOs:** check for TODO/FIXME in recently changed files
6. **What was just done:** summarize the last session's work from commit messages
7. **What's next:** infer from plan docs, TODOs, or ask user

## Output Format

Generate a self-contained prompt block (fenced in triple backticks) that includes:
- Project path and repo context
- Branch/stack state
- What was already done (with commit refs)
- What remains to be done
- Any relevant file paths to read first
- Specific instructions for the next phase

The prompt should be copy-pasteable into a new pi session with zero additional context needed.

Copy to clipboard when done.
