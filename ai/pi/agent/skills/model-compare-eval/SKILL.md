---
name: model-compare-eval
description: >
  Run the same prompt across multiple models in parallel supacode worktrees, collect the outputs (HTML reports,
  text, artifacts), and produce a side-by-side comparison report. Use when user asks to "compare models on X",
  "eval these models", "run a model bake-off", or invokes /skill:model-compare-eval.
---

# Model Compare Eval Skill

Run one prompt across N models → collect artifacts → compare ease-of-understanding + analysis quality.

## When to use

User wants to:
- bake off multiple models on the same task
- eval a new model against a known-good one
- compare how different models handle a codebase/design/writing task

Phrases: "compare models on...", "model compare eval", "run this prompt across X, Y, Z", "which model is best at..."

## Workflow

### Step 1: Gather inputs

Ask the user (use `questionnaire` if >1 unknown):
1. **The prompt** to run. Verbatim, not paraphrased.
2. **Models** to test. Examples: `opus-4.6`, `opus-4.7`, `gpt-5.4`, `crest-alpha-v2`, `glacier-alpha`.
3. **Repo/project** the comparison happens against (if codebase-related).
4. **Expected artifact type**: HTML report / markdown / code diff / text only.

### Step 2: Set up worktrees

Supacode worktrees must be created via the UI (no CLI create today). Instruct the user:

> Create a supacode worktree for each model off the same base branch. Name them `<task>-<model>`, e.g. `defrag-opus-4.7`. Pick the matching model in each worktree's pi session.

Then verify:

```bash
supacode worktree list
ls /Users/cj_winslow/.supacode/repos/<repo>/
```

Confirm one worktree per model exists, all on the same commit:

```bash
for d in /Users/cj_winslow/.supacode/repos/<repo>/<task>-*; do
  echo "=== $(basename $d)"; (cd "$d" && git log --oneline -1)
done
```

### Step 3: Run the prompt in each worktree

Tell user to paste the same prompt into each worktree's pi session. Wait for completion.

Remind them: if follow-up prompts are needed (e.g. "now make it an html report"), use the **same** follow-up text in every worktree — prompt count matters for the comparison.

### Step 4: Locate outputs

Sessions live in `~/.pi/agent/sessions/--Users-cj_winslow-.supacode-repos-<repo>-<task>-<model>--/`.

Parse the largest `.jsonl` per session to extract:
- Model ID (from `model_change` type)
- All user prompts (role=user text)
- Any errors (stopReason=error, errorMessage)
- Files written (tool_use with `.html`/`.md` path, or `write` tool)

Look for produced artifacts in the worktree (common locations):
- `visual-explainers/*.html`
- `<worktree>/*.html`
- `<worktree>/*.md`

Ignore pre-existing artifacts (check git status / mtime).

### Step 5: Compare

Read each artifact. Open all in Chrome side-by-side:

```bash
open -a "Google Chrome" file:///path/to/report1.html file:///path/to/report2.html ...
```

Evaluate on two axes:
1. **Ease of understanding** — layout, scan-ability, info hierarchy, visual clarity
2. **Analysis quality** — depth, framing, root-cause reasoning, actionability, evidence

For each model, capture:
- Prompt count to reach final output (fewer = better)
- Wall-clock time if known
- Errors / retries / model-not-found
- Output size (lines, bytes)
- Unique insight (what did only this model say?)
- Convergence (what did all models agree on?)

### Step 6: Produce comparison report

Write a markdown report at `/tmp/model-compare-<task>/README.md` with:

```markdown
# <Task> — model comparison

## Prompt
> <verbatim prompt>

## Runs
| # | Model | Prompts | Status | Artifact |
|---|-------|---------|--------|----------|

## Quick verdict
- Best for X: <model>
- Best for Y: <model>

## Convergence
What all models agreed on.

## Divergence
Where they split + why it matters.

## Gaps / issues found
Model errors, slowness, extra prompts needed.
```

Copy all artifacts into `/tmp/model-compare-<task>/` renamed `NN-<model>.ext` ordered by rank. Zip it:

```bash
cd /tmp && zip -r model-compare-<task>.zip model-compare-<task>/
```

### Step 7: Hand off

Report back with:
- Location of zip
- Short verdict (3-5 bullets)
- List of gaps found in the models themselves (routing errors, slowness, extra prompts)

## Important rules

- **Verbatim prompts**. No paraphrasing across worktrees — invalidates comparison.
- **Same base commit**. Verify with `git log -1` in each worktree.
- **Count errors as signal**. A 404'd model is part of the eval result, not a retry opportunity.
- **Prompt count matters**. Models that need nudges for trivial follow-ups are worse, not better.
- **Don't inject opinions during runs**. Only compare at the end.
- **Be skeptical of self-assessments**. If a report says "Health: Good" while its own findings list major issues, flag that inconsistency.

## Reusable helpers

Prompt extraction from a pi session:

```python
import json, os, glob
def extract_session(session_dir):
    files = sorted(glob.glob(os.path.join(session_dir, "*.jsonl")))
    p = max(files, key=os.path.getsize)
    out = {"model": None, "prompts": [], "errors": [], "artifacts": []}
    with open(p) as f:
        for line in f:
            d = json.loads(line)
            t = d.get('type')
            if t == 'model_change':
                out["model"] = d.get('modelId')
            elif t == 'message':
                c = d.get('content') or d.get('message') or {}
                if isinstance(c, dict):
                    if c.get('role') == 'user':
                        for part in c.get('content', []):
                            if part.get('type') == 'text':
                                out["prompts"].append(part['text'])
                    if c.get('stopReason') == 'error':
                        out["errors"].append(c.get('errorMessage'))
                    for part in c.get('content', []):
                        if part.get('type') == 'tool_use':
                            inp = part.get('input', {})
                            path = inp.get('path') or inp.get('file_path') or ''
                            if path.endswith(('.html', '.md')):
                                out["artifacts"].append(path)
    return out
```
