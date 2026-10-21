---
description: Run dev loop - implement with super-coder, review with code-critic, iterate until done
---
Run a dev loop for: $@

Loop structure:
1. Spawn super-coder to implement one thing at a time
2. Spawn code-critic to review
3. Repeat until all work complete
4. Final review by appropriate agent (game-designer for games, product-owner for apps, or ask me)

Use the subagent tool for spawning agents. Models from the roster table in CLAUDE.md.

Handoff contract: a subagent handoff is INVALID unless it contains non-empty `commands run +
exit codes` and a `git diff --stat` (or an explicit "no changes, because ..."). On an empty
or invalid handoff, re-dispatch once with the same task; if it fails again, stop and report
to me. Never report a step done on the strength of an empty handoff.
