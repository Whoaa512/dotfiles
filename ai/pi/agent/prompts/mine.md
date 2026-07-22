---
description: Mine ledgers + recent sessions for patterns worth promoting to guards/skills/prompts/workflows
---
Run a mining pass over my agent-usage data and propose promotions. Mode: "$@" (empty = default; "deep" = full-session analysis).

## Inputs

**Default mode:**
1. `~/work/cj-private/ai-memory/ledgers/corrections.jsonl` — steering corrections (category + note)
2. `~/work/cj-private/ai-memory/ledgers/findings.jsonl` — review-finding verdicts
3. `~/work/cj-private/ai-memory/sessions/*.md` — last 30 days of session summaries
4. `~/.pi/agent/prompt-history.json` — recent raw prompts

**Deep mode (adds):**
5. Full session transcripts in `~/.pi/agent/sessions/*/*.jsonl` from the last 60 days. Too large to read directly — write a python script to extract user prompts/tool stats per session, then fan out subagents per month/chunk to analyze the corpora.

## Analysis

Count recurrence. For each pattern appearing 3+ times, classify per the promotion ladder:

| Observation | Promote to |
|---|---|
| Repeated phrasing / request shape | prompt template |
| Stable tool/domain procedure | skill |
| Staged multi-agent process | workflow |
| Non-negotiable safety invariant (recurring correction) | extension/guard, or executable test |
| Outcome history worth tracking | new ledger field |

Prefer test/guard over prose when a correction can be made deterministic.

Also flag:
- Existing skills/prompts that are invoked but still need manual intervention (revision candidates)
- Stale/overlapping instructions across CLAUDE.md, AGENTS.md, prompts, skills (consolidation candidates)
- Corrections that stopped recurring after codification (close the loop — note the win)

## Cross-check before proposing

For each candidate, verify it isn't already codified: check `~/.pi/agent/prompts/`, `~/.pi/agent/skills/`, `~/code/dotfiles/ai/pi/agent/skills/`, `~/work/cj/ai/pi/skills/`, `~/.pi/agent/extensions/`. Session logs contain expanded prompt templates — high verbatim frequency may mean heavy *usage* of an existing command, not a gap.

## Output

1. Write proposals to `~/work/cj-private/ai-memory/mining/YYYY-MM.md`: each candidate with evidence (counts, quoted examples), ladder classification, and effort estimate. Ranked by frequency × toil.
2. `touch ~/work/cj-private/ai-memory/ledgers/.last-mine`
3. Commit to cj-private.
4. Interview me on the top candidates — implement approved ones in-session.
