---
description: Adversarially corroborate review findings against source — confirmed/disproven/pre-existing/speculative with evidence
---
Triage these review finding(s): $@
(If empty, triage the finding(s) most recently pasted/discussed in this conversation.)

## Contract

A finding survives ONLY if a verifier reproduces the affected code path or the violated invariant in the actual source. Consensus alone is not truth. Prefer disproven/speculative over manufactured confirmation.

## Process

Extract each distinct finding (claim + file/location if given). Then run this via the `workflow` tool (adjust findings array; keep structure):

```js
export const meta = { name: 'triage_findings', description: 'Two independent verifiers corroborate review findings against source, adjudicator resolves' };
const findings = args.findings; // [{id, claim, location}]
const cwd = process.cwd();
const base = `You are verifying a code-review finding in the repo at ${cwd}. ` +
  `Read the ACTUAL source files. Trace the code path. A finding is confirmed only if you can identify ` +
  `the concrete affected code and show how the claimed failure occurs. Check git log/blame to determine ` +
  `if the issue pre-dates the change under review. Respond with verdict + the exact file:line evidence.`;
const schema = { type: 'object', properties: { verdict: { type: 'string', enum: ['confirmed','disproven','pre-existing','speculative'] }, evidence: { type: 'string' }, reasoning: { type: 'string' } }, required: ['verdict','evidence'] };
const results = [];
for (const f of findings) {
  const [a, b] = await parallel([
    () => agent(`${base}\n\nFINDING: ${f.claim}\nLOCATION: ${f.location || 'unknown'}`, { tier: 'medium', label: `verify-A ${f.id}`, schema }),
    () => agent(`${base}\n\nBe adversarial: actively try to DISPROVE this finding.\n\nFINDING: ${f.claim}\nLOCATION: ${f.location || 'unknown'}`, { tier: 'big', label: `verify-B ${f.id}`, schema }),
  ]);
  let final;
  if (a && b && a.verdict === b.verdict) {
    final = { verdict: a.verdict, evidence: `A: ${a.evidence} | B: ${b.evidence}` };
  } else {
    final = await agent(`Two verifiers disagree on a code-review finding in ${cwd}.\nFINDING: ${f.claim} (${f.location || 'unknown'})\nVerifier A: ${JSON.stringify(a)}\nVerifier B: ${JSON.stringify(b)}\nRead the source yourself and adjudicate. The evidence standard: reproducible code path or violated invariant.`, { tier: 'big', label: `adjudicate ${f.id}`, schema });
  }
  results.push({ id: f.id, claim: f.claim, ...(final ?? { verdict: 'speculative', evidence: 'verification failed' }) });
}
return { ok: true, results };
```

## After the workflow returns

1. Present a verdict table: finding | verdict | evidence. Confirmed findings get a recommended fix; everything else gets one line on why it dies.
2. Append each verdict to `~/work/cj-private/ai-memory/ledgers/findings.jsonl` as `{"ts": "<iso>", "project": "<basename cwd>", "source": "triage", "finding": "...", "verdict": "...", "evidence": "..."}` (one line each, `>>`).
3. Print exactly this sentinel on its own line so the session extractor skips these: `[triage:ledger-written]`
