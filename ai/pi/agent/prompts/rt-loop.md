---
description: Review triage loop - review (fan-out optional), adversarially triage findings, implement confirmed fixes
---
Run a review triage loop for: $@
(Default target if empty: the current branch vs its base. Parse overrides like "3 reviewers", "last 5 commits", "fan implementation".)

## Shape

Serial by default: review → triage → implement. Only the review stage fans out; triage is always a single adjudicating stage; implementation fans only when triage says findings are file-disjoint.

## Stage 1 — Review

Spawn code-critic on the target using the ship-check rubric (verdict SHIP/FIX FIRST/RETHINK, score /10, findings ranked P0-P3 with confidence + `file:line`, concrete fix ≤3 lines when possible).

Fan-out (only if asked, e.g. "3 reviewers"): spawn N reviewers in parallel on different models/providers to avoid shared blind spots. Do NOT dedupe or synthesize their findings — pass everything raw to triage. Triage owns dedup and truth.

If verdict is SHIP with no findings: report and stop.

## Stage 2 — Triage

Run the /triage adversarial corroboration flow on every finding:
- two independent verifiers per finding (one explicitly adversarial, trying to disprove)
- adjudicator resolves disagreements by reading source itself
- verdict per finding: confirmed / disproven / pre-existing / speculative
- evidence standard: reproducible code path or violated invariant in actual source; consensus alone is not truth
- append verdicts to the findings ledger per /triage

Output: verdict table. Confirmed findings get recommended fix + severity + whether they're file-disjoint from each other. Everything else gets one line on why it dies.

If nothing confirmed: report and stop.

## Stage 3 — Implement

Default: one super-coder agent fixes confirmed findings serially, one atomic commit per finding, lint + tests after.

Fan-out: if triage marked findings file-disjoint AND user asked to fan (or there are 3+ independent findings), partition across parallel implementation agents. Each writes a structured handoff: done/undone, commands + exit codes, issues.

## Loop exit

Re-run a light review pass on the fix commits only. Exit when verdict is SHIP or remaining findings are all disproven/speculative/pre-existing. Otherwise loop back to triage with the new findings.

Final output: what was fixed (commits), what was killed in triage (with verdicts), current review verdict.
