---
name: explain-diff
description: Produce a rich, interactive HTML explainer of a code change (diff, branch, commit range, or PR) ending with a comprehension quiz. Use when user asks to "explain this diff/PR/branch", "explainer for this change", or wants to verify they understand agent-written code before review.
---

# Explain Diff

Build an explainer doc for the specified change. Goal: the reader comes away able to *participate* in the code (have the next idea), not just verify it. Adapted from Geoffrey Litt's explain-diff.

## Resolve the change
- No target given → default to current branch vs merge-base with main/master (`git diff $(git merge-base HEAD main)...HEAD`)
- PR URL → `gh pr diff` (use `GH_HOST=git.musta.ch` for musta.ch URLs)
- Explore surrounding code liberally — the diff alone is never enough context.

## Sections (in this order)

1. **Background** — Explain the existing system relevant to this change. Two layers: a deep background for someone new to this subsystem (collapsible/skippable), then a narrow background directly relevant to the change. Broadly explore the surrounding code to write this.
2. **Intuition** — The essence of the change before any code. What problem, why this approach, concrete examples with toy data. Figures and diagrams liberally. Like a great commit message, one level deeper.
3. **Interactive figure** (only where it genuinely helps) — a small simulation/widget the reader can fiddle with to feel the behavior change (drag a value, step a timeline, toggle before/after). Skip if it'd be slop; tasteful > flashy.
4. **Literate code walkthrough** — Not file order; explanation order. Prose before each hunk saying what to look for. Group related changes. Show real diff hunks in `<pre>` blocks.
5. **Quiz** — 5 interactive multiple-choice questions, medium difficulty: answerable only if you understood the substance, no gotchas. On click: correct/incorrect + explanation. Show a score at the end.

## Quiz gate (the point of all this)
After the user reads the doc, remind them of the rule: **don't send the PR for review until you pass the quiz.** If they miss questions, offer to expand the relevant section. The quiz is a speed regulator — move at the speed of understanding, not just correctness.

## Format
- Single self-contained HTML file (inline CSS + JS). One long page, section headers, table of contents, basic responsive styling.
- **Dark mode by default**: dark background (~#14161a), light text, `color-scheme: dark`, muted borders, desaturated accent colors. All figures, diagrams, quiz widgets, and diff highlighting must use the dark palette (e.g. added lines = dark green bg with light green text, not GitHub-light colors).
- Save outside the repo: `/tmp/YYYY-MM-DD-explain-<slug>.html`, then `open` it.
- Write with the clarity and flow of Martin Kleppmann — engaging, classic style, smooth transitions.
- Diagrams: pick a small family of diagram styles reused throughout (simplified UI mock, system/dataflow diagram with example data). Simple HTML/CSS designs — never ASCII art.
- Code blocks: always `<pre>` (or a div with `white-space: pre-wrap`). Before saving, verify every code block preserves newlines.
- Callouts for key concepts, definitions, edge cases.
