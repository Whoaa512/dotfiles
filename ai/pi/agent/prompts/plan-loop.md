---
description: Run plan loop - fan out to multiple agents, synthesize, iterate until consensus
---
Run a plan loop for: $@

Defaults: 2 iterations, 3 agents (override with "plan-loop 3 iter 4 agents: <task>")

Fan out agents (pick 3+ relevant lenses):
- grug-architect (simplicity, architecture)
- code-critic (complexity, risks)
- product-owner (user value, scope)
- jared-biz-strategist (business, GTM)
- game-designer (if game-related)

Each iteration:
1. Spawn agents in parallel with current plan state
2. Synthesize findings - identify conflicts and consensus
3. Update plan, mark items CONFIRMED or UNCONFIRMED

Early break when:
- All agents converge on approach
- No UNCONFIRMED items remain
- Implementation steps are concrete and sequenceable

Output: single plan doc with dissenting notes if any.
