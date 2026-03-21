---
description: Dual-model review — pi reviews locally, GPT reviews separately, then synthesize findings
---
Run a triangulated review on the last $1 commits.

## Process

### 1. Pi reviews locally
Review the last $1 commits yourself using the same criteria as ship-check:
- Correctness, completeness, complexity, optimality, test quality, AI slop

Capture your findings as `PI_REVIEW`.

### 2. GPT reviews via subagent
Spawn a second review using a different model:

```
subagent({
  agent: "code-critic",
  model: "devai/global.google.gemini-2.5-pro-preview-06-05-v1",
  task: "Review the last N commits at <cwd>. Evaluate: correctness, completeness, complexity, optimality, test quality, and whether it looks like AI slop. Output a structured review with verdict (SHIP/FIX FIRST/RETHINK), score /10, and prioritized issues list."
})
```

Capture as `GPT_REVIEW`.

### 3. Synthesize
Compare both reviews. Output:

**Consensus** — issues both reviewers flagged
**Pi-only findings** — things only pi caught
**GPT-only findings** — things only GPT caught
**Disagreements** — where they diverge, with your assessment of who's right

### Verdict: SHIP / FIX FIRST / RETHINK

**Combined Issues** (deduplicated, severity-ordered):
1. 🔴 ...
2. 🟡 ...
3. 🔵 ...

If verdict is FIX FIRST, ask "intme for what to fix" and then fix.
