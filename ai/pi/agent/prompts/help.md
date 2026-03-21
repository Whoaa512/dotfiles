---
description: Show all available prompt commands and aliases
---
List all available prompt commands. Read every `.md` file in `~/.pi/agent/prompts/` (skipping `.bak` files), extract the `description` from frontmatter (or first line if no frontmatter), and display as a table grouped by category.

## Output Format

```
┌─────────────────────────────────────────────────────────────┐
│  /help                     — You are here                   │
├─────────────────────────────────────────────────────────────┤
│  REVIEW & SHIP                                              │
│  /sc, /ship-check N       — Review N commits (slop+optimal) │
│  /tri N                   — Dual-model triangulated review   │
│  /ready                   — Pre-ship readiness checklist     │
│  /council                 — Multi-agent review council       │
│  /simplify-commits        — Find over-engineering in commits │
│  /codex-review            — Airchat codex review + triage    │
│  /review-tech-doc         — 6-persona tech doc review        │
├─────────────────────────────────────────────────────────────┤
│  BUILD & IMPLEMENT                                          │
│  /dl, /dev-loop           — Implement → review → iterate     │
│  /ir, /implement-and-review — Worker → reviewer → fix chain  │
│  /implement               — Scout → plan → implement chain   │
│  /pl, /plan-loop          — Multi-agent planning consensus   │
│  /sap, /scout-and-plan    — Scout context → create plan only │
│  /debate                  — Multi-model debate to consensus  │
├─────────────────────────────────────────────────────────────┤
│  GIT & STACK                                                │
│  /sf, /stack-fix          — Clean up gt stack hygiene        │
│  /gso, /gt-stack-overview — Stack status table               │
│  /gpa, /gt-pr-align       — Align PRs with repo template    │
│  /cifix                   — Debug CI → fix → absorb          │
│  /check-pr                — Check PR status + fix issues     │
│  /check-pr-feedback       — Fetch + address PR comments      │
├─────────────────────────────────────────────────────────────┤
│  CONTEXT & COMMUNICATION                                    │
│  /brief                   — Read URL → TL;DR + action items  │
│  /respond                 — Read context → draft in my voice │
│  /ho, /handoff            — Generate prompt for new session  │
│  /intme, /interview       — Interview me to fill gaps        │
│  /learnings               — Compound session → CLAUDE.md     │
│  /feedback                — Give ME feedback on my prompting │
│  /write-review            — Draft peer/upward review         │
├─────────────────────────────────────────────────────────────┤
│  VALIDATE & DEBUG                                           │
│  /dogfood                 — Run app → validate → fix loop    │
│  /debug-pager             — Debug PagerDuty alert            │
├─────────────────────────────────────────────────────────────┤
│  WORK TRACKING                                              │
│  /asana-pulse             — Reconcile repos ↔ Asana board    │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN-SPECIFIC                                            │
│  /airchat-review          — Airchat review ops               │
│  /grafana                 — Grafana dashboard queries         │
│  /spinnaker               — Spinnaker deploy ops             │
└─────────────────────────────────────────────────────────────┘
```

Read the actual prompts directory to verify this list is current. If any prompts exist that aren't listed above, add them. If any listed above don't exist, omit them. Show the real state.
