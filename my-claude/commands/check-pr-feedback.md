Fetch and address PR feedback comments for the current branch
# ==================================================================================================
Goal
-----
Fetch PR comments from the current branch, summarize the feedback, prioritize issues, and (optionally) implement fixes in collaboration with me.

Context
--------
• The repository may contain uncommitted changes.
• Uses `gh` CLI to fetch PR comments and details.
• The current branch should have an associated PR.

Workflow (follow strictly in order)
---------------------------------------

Stage 1: Pre-flight
	a.	Check for outstanding changes (git status).
	b.	If there are staged or unstaged changes, inform the user that we're going to commit them to leave a clean state prior to making fixes, and do so.
	c.	Verify current branch has an associated PR using `gh pr status`.

Stage 2: Fetch PR Feedback
	a.	Tell me: "Fetching PR comments and feedback…"
	b.	Execute `gh api repos/:owner/:repo/pulls/$(gh pr view --json number -q .number)/comments` to get all line-specific comments.
	c.	Execute `gh pr view --json reviews` to get all review comments.
	d.	Parse the comments into a structured array of feedback items (author, type, content, file:line if applicable).
	e.	Filter out resolved comments and focus on actionable feedback.

Stage 3: Create a TODO list
	a.	Re-order the feedback by YOUR OWN initial assessment of severity/impact (highest first).
	b.	Use your TODO list tool to add TODOs for each in that order, each tagged with severity/impact.
	c.	Group similar feedback items together where applicable.

Stage 4: Interactive Triage (loop per issue)

For each TODO item, do:

a. Show the full feedback comment with context.
b. Validate it in context (open the code, search all relevant code, etc.) to confirm the feedback is valid, how significant it is, and to prepare info that will help me decide whether to address it.
c. For any feedback that is clearly not valid or already addressed, explain why and continue to the next item.
d. For any that ARE valid feedback, describe the issue in detail, why it might or might not be worth addressing, with code snippets if applicable, and generate a proposed fix plan. Then ask me how to proceed:

Implement fix for **<feedback short summary>** as described above?
Options: (y)es / (s)kip / describe alternative approach / ask further questions

e. Wait for my reply before proceeding.
f. If I answer yes:
	•	Detail the concrete change plan (files touched, logic, tests).
	•	Implement the change.
	•	Commit it with a clear message.

g. Then continue to the next TODO item.

Stage 5: Wrap-up
	a.	After the loop, print a summary table:

Feedback	Author	Decision	Commit SHA	Notes
…	…	…	…	…

	b.	End with:

"PR feedback review complete. Let me know if anything else is needed or you have any questions about what was addressed."

---------------------------------------------
Note: If you need additional information (e.g., no PR found, unclear feedback, conflicting instructions), ask before acting.
