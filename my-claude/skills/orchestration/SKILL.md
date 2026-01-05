---
name: orchestration
description: Multi-agent orchestration for complex tasks
---

# Orchestration

Spawn agents for parallel work. Stay high-level. Synthesize results.

## Role Check

**Are you a WORKER or ORCHESTRATOR?**

If your prompt contains "You are a WORKER agent" → execute task directly, don't spawn sub-agents.

Otherwise → you're the orchestrator. Continue reading.

---

## Core Principle

**Parallelize independent work. Do simple things directly.**

| Task | Approach |
|------|----------|
| Complex multi-file feature | Spawn parallel agents |
| Research + implement | Pipeline: explore → implement |
| Single file fix | Just do it yourself |
| Quick lookup | Just do it yourself |

Not everything needs agents. Use judgment.

## When to Orchestrate

- Multi-file implementations with no dependencies between files
- Research from multiple angles simultaneously
- Competing approaches (try 2-3, pick best)
- Long-running work (tests, builds) while doing other things

## When NOT to Orchestrate

- Single file changes
- Quick searches or lookups
- Sequential work where each step needs the previous result
- Tasks faster to do directly than explain to an agent

---

## Spawning Workers

### Worker Preamble (Required)

Always prefix agent prompts with this:

```
CONTEXT: You are a WORKER agent.

RULES:
- Complete ONLY the task below
- Use tools directly (Read, Write, Edit, Bash, etc.)
- Do NOT spawn sub-agents
- Report results with absolute file paths

TASK:
[specific task here]
```

### Example

```python
Task(
    subagent_type="general-purpose",
    description="Implement auth routes",
    prompt="""CONTEXT: You are a WORKER agent.

RULES:
- Complete ONLY the task below
- Use tools directly (Read, Write, Edit, Bash, etc.)
- Do NOT spawn sub-agents
- Report results with absolute file paths

TASK:
Create src/routes/auth.ts:
- POST /login - verify credentials, return JWT
- POST /signup - create user, hash password
- Use bcrypt for hashing, jsonwebtoken for tokens
- Follow patterns in existing routes
""",
    run_in_background=True
)
```

### Background by Default

Always use `run_in_background=True` for parallel work. Launch multiple agents in a single message.

```python
# Good: parallel launch
Task(subagent_type="Explore", prompt="...", run_in_background=True)
Task(subagent_type="Explore", prompt="...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="...", run_in_background=True)
```

### Agent Types

| Type | Use For |
|------|---------|
| `Explore` | Finding files, understanding codebase |
| `Plan` | Architecture, design decisions |
| `general-purpose` | Implementation, complex work |

### Model Selection

| Task | Model |
|------|-------|
| Simple search | `haiku` |
| Standard work | (default) |
| Complex reasoning | `sonnet` |

---

## Patterns

### Fan-Out (Parallel Independent)

```
Orchestrator
├──► Agent A (component 1)
├──► Agent B (component 2)  ← launch all at once
└──► Agent C (component 3)
```

### Pipeline (Sequential Dependent)

```
Agent A → result → Agent B → result → Agent C
```

Wait for each to complete before launching next.

### Map-Reduce

```
      ┌──► Agent A ──┐
Input ├──► Agent B ──┼──► Synthesize
      └──► Agent C ──┘
```

Fan-out, collect results, combine.

### Speculative

Try multiple approaches, pick best result.

---

## Tracking Work

Use `TodoWrite` to track multi-step orchestration:

```python
TodoWrite(todos=[
    {"content": "Research auth patterns", "status": "in_progress", "activeForm": "Researching auth patterns"},
    {"content": "Implement auth routes", "status": "pending", "activeForm": "Implementing auth routes"},
    {"content": "Add auth middleware", "status": "pending", "activeForm": "Adding auth middleware"},
    {"content": "Write tests", "status": "pending", "activeForm": "Writing tests"}
])
```

Mark complete as agents finish. Update status before spawning next wave.

---

## Synthesis

When agents complete:

1. Read their output files or use `TaskOutput(task_id="...")`
2. Combine findings - don't expose that multiple agents ran
3. Present unified result to user

Hide the machinery. User sees: "Here's what I found" not "Agent 1 found X, Agent 2 found Y".

---

## Error Handling

| Failure | Recovery |
|---------|----------|
| Agent timed out | Retry with smaller scope |
| Agent misunderstood | Retry with clearer prompt |
| Partial completion | Create follow-up task for remainder |
| Conflict (same file) | Resolve manually or ask user |

After 2 failed retries → ask user for guidance.

---

## Domain References

Load relevant guide before decomposing:

| Task Type | Reference |
|-----------|-----------|
| Feature/bug/refactor | [software-development.md](references/domains/software-development.md) |
| PR review | [code-review.md](references/domains/code-review.md) |
| Codebase exploration | [research.md](references/domains/research.md) |
| Test generation | [testing.md](references/domains/testing.md) |
| Documentation | [documentation.md](references/domains/documentation.md) |
| CI/CD | [devops.md](references/domains/devops.md) |

---

## Anti-Patterns

| Bad | Why | Better |
|-----|-----|--------|
| Agent for single-line fix | Overhead > work | Do it directly |
| Sequential when parallel possible | Slow | Fan-out |
| Vague agent prompts | Misunderstanding | Specific instructions |
| Blocking on agent when more work exists | Wasted time | Launch more, process as they complete |
| "Never read files yourself" | Dogmatic | Simple reads are fine |
