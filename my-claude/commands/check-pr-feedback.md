<task>
Fetch and address PR feedback comments for the current branch.
Argument: $ARGUMENTS (optional - specific feedback ID or filter)
</task>

<context>
This command fetches PR comments and reviews from the current branch, summarizes feedback, prioritizes issues, and optionally implements fixes through collaborative triage.

Key assumptions:
• The repository may contain uncommitted changes
• Current branch has an associated PR
• Using GitHub CLI (gh) for API access, and `gh auth login` has been run prior
• `jq` is available locally
• Comments may be line-specific or general review comments
</context>

<workflow>
Follow these stages strictly in order:

**Stage 1: Pre-flight Checks**
1. Use Bash tool: `git status` to check for outstanding changes
2. If there are staged or unstaged changes, inform user and commit them for clean state
3. Use Bash tool: `gh pr status` to verify current branch has an associated PR

**Stage 2: Fetch PR Feedback**
1. Display: "Fetching PR comments and feedback…"
2. Use Bash tool: `gh api repos/:owner/:repo/pulls/$(gh pr view --json number -q .number)/comments` for line-specific comments
3. Use Bash tool: `gh pr view --json reviews` for review comments
4. Parse comments into structured feedback items (author, type, content, file:line if applicable)
5. Filter out resolved comments, automated bot accounts (deployboard, svc-*), and focus on actionable human feedback

**Stage 3: Create TODO List**
1. Re-order feedback by severity/impact assessment (highest first)
2. Use TodoWrite tool to add TODOs for each item with severity/impact tags
3. Group similar feedback items together where applicable

**Stage 4: Interactive Triage**
For each TODO item:
1. Show full feedback comment with context
2. Validate in context (read code, search relevant files) to confirm validity and significance
3. For invalid/already addressed feedback: explain why and continue
4. For valid feedback: describe issue detail, impact assessment, code snippets, and propose fix plan

Then ask:
```
Implement fix for **<feedback short summary>** as described above?
Options: (y)es / (s)kip / describe alternative approach / ask further questions
```

5. Wait for user reply before proceeding
6. If user answers yes:
   - Detail concrete change plan (files, logic, tests)
   - Implement the change
   - Commit with clear message
7. Continue to next TODO item

**Stage 5: Wrap-up**
1. Print summary table:
   ```
   Feedback | Author | Decision | Commit SHA | Notes
   ```
2. End with: "PR feedback review complete. Let me know if anything else is needed or you have any questions about what was addressed."
</workflow>

<argument_handling>
If $ARGUMENTS is provided, use it to:
- Filter to specific feedback ID or author
- Focus on particular file or area
- Search for specific feedback pattern
If empty, process all available feedback
</argument_handling>

<error_handling>
If no PR found, unclear feedback, or conflicting instructions:
- Ask for clarification before proceeding
- Suggest alternative approaches
- Provide guidance on resolution
</error_handling>

<human_review_needed>
Flag these aspects for verification:
- [ ] Completeness of feedback identification
- [ ] Accuracy of severity assessment
- [ ] Appropriateness of proposed fixes
- [ ] Impact of changes on existing functionality
</human_review_needed>
