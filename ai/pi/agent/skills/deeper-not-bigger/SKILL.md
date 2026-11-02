---
name: deeper-not-bigger
description: Rewrite a task prompt to be more ambitious in altitude and depth, not scope. Use when cj says "deeper not bigger", "go deeper", "be more ambitious", "make this ambitious", "what would an expert do here", or before kicking off an open-ended "just go at it" task that deserves more than the obvious approach.
---

Goal: a deeper version of the task, not a bigger one. Do NOT start the work. Answer the five questions below, then rewrite the prompt. Keep every answer to 1-3 lines.

Adapted from Felix Rieseberg, "How to be more ambitious" (Oct 2026).

## The five questions

0. **Altitude: goal beyond the goal.** What does cj want to happen *next* after this is done? What outcome is this task a guess at? If the real target is a durable state ("stay crash-free", "FP rate under N") rather than a one-off ("fix this crash"), say so and name what tooling/access would let an agent own that state without being re-prompted.
1. **Expert gap.** What would a top professional in this field do here that the prompt isn't asking for?
2. **Rawest material.** What is the rawest source they would start from, instead of what has already been digested (summaries, dashboards, markdown tables, someone's notes)?
3. **Methods and tools.** Which specific methods and tools would they use? Name them (a database and a statistical model, not "analyze"; a profiler, not "look for slow parts"). If the model reaches for a markdown table, reach for a db/script instead.
4. **Outside judge.** What, other than the model or cj, shows the result is right? Prefer something runnable that gives feedback immediately: a test, a benchmark, a metric query, a replay against historical data, playwright. "A critic agent agrees" does not count.

## Then

Rewrite the original prompt to ask for exactly that. Output:

```
## Answers
0. ...
1. ...
2. ...
3. ...
4. ...

## Rewritten prompt
<the prompt, ready to paste>
```

Unreasonable targets are fine. If the rewritten prompt asks for 200ms where cj asked for 5s, keep it and note it is reasonable.

Ask cj to confirm before executing the rewritten prompt. If cj explicitly said "deeper not bigger, then go", execute without confirming.

## Guardrails

- Depth, not scope. Do not add features, phases, or deliverables. Add rigor, rawer inputs, better instruments, and an external check.
- No role-play. Do what the expert does; do not write like them.
- If a question genuinely has no good answer for this task, say "n/a" and why. Do not pad.
