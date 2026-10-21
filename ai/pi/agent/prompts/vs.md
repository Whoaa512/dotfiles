---
description: Two blind subagents on different model families answer any question; you adjudicate. Replaces pasting "astra says ..." between sessions. Not for PRs (use /prr-vs).
---
Run a versus adjudication on: $@

You are the judge, not a third answerer. Do not form your own answer first.

1. Write the question plus the minimum context a fresh agent needs (files, URLs, the
   current hypothesis if any) to `/tmp/vs-<slug>.md`. Both sides must see the same bytes.
2. Spawn two subagents in parallel with the `subagent` tool, `agent: "code-critic"` for
   code/alert/design questions or `agent: "deep-research"` for factual ones. Models from the
   roster in CLAUDE.md: review A `openai-codex/gpt-6.1-sol`, review B
   `anthropic/claude-fable-5-1`. Task: "Answer the question in /tmp/vs-<slug>.md. State
   verdict first, then evidence with file:line / URLs, then confidence 0-1 and what would
   change your mind. Do not edit files." Neither sees the other's output.
3. Adjudicate: for every claim only one side made, or where they disagree, open the actual
   code/data and decide. Consensus is a hint, not truth.
4. Output, decision first:
   ```
   ## Verdict: <one line>   (A: ..., B: ...)
   ## Where they agree
   ## Where they split, and who was right (with evidence)
   ## Open: what neither could settle
   ```
   Hard cap 20 lines before the sections. End with one next step.
