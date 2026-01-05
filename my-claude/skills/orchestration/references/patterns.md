# Orchestration Patterns

## Fan-Out

Launch parallel agents for independent work.

```
Orchestrator
├──► Agent A (file1)
├──► Agent B (file2)  ← single message, all at once
└──► Agent C (file3)
```

**When:** Independent file analysis, parallel searches, multi-component implementation.

```python
# Single message, multiple background agents
Task(subagent_type="Explore", prompt="Analyze auth...", run_in_background=True)
Task(subagent_type="Explore", prompt="Analyze db...", run_in_background=True)
Task(subagent_type="Explore", prompt="Analyze api...", run_in_background=True)
```

---

## Pipeline

Sequential agents where output feeds next step.

```
Agent A → result → Agent B → result → Agent C
```

**When:** Research→Plan→Implement, Analyze→Design→Build.

```python
# Step 1
Task(subagent_type="Explore", prompt="Find all API endpoints...", run_in_background=True)
# Wait for notification...

# Step 2 (uses result1)
Task(subagent_type="Plan", prompt=f"Design based on: {result1}", run_in_background=True)
# Wait for notification...

# Step 3 (uses result2)
Task(subagent_type="general-purpose", prompt=f"Implement: {result2}", run_in_background=True)
```

---

## Map-Reduce

Distribute work, aggregate results.

```
      ┌──► Agent A ──┐
Input ├──► Agent B ──┼──► Synthesize
      └──► Agent C ──┘
```

**When:** Analyzing multiple files, reviewing multiple PRs, processing batches.

```python
# MAP: parallel agents
Task(subagent_type="general-purpose", prompt="Analyze file1 for security...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Analyze file2 for security...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Analyze file3 for security...", run_in_background=True)

# REDUCE: collect and synthesize
# Wait for notifications, then combine findings
```

---

## Speculative

Try multiple approaches, pick best.

```
      ┌──► Approach A ──┐
Task ─├──► Approach B ──┼──► Evaluate → Best
      └──► Approach C ──┘
```

**When:** Uncertain algorithm, multiple valid architectures, optimization.

```python
Task(subagent_type="general-purpose", prompt="Implement recursive...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Implement iterative...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Implement memoized...", run_in_background=True)

# Evaluate results, pick winner
```

---

## Combining Patterns

### Pipeline + Fan-Out

```
Phase 1: PIPELINE
├─ Explore: Find patterns
└─ Plan: Design architecture

Phase 2: FAN-OUT
├─ Agent A: Component 1
├─ Agent B: Component 2
└─ Agent C: Component 3

Phase 3: PIPELINE
└─ Integration agent: Wire up, test
```

---

## Parallelization Rules

**Must parallelize:**
- Independent file reads
- Independent searches
- Independent agent tasks

**Must NOT parallelize:**
- Tasks with data dependencies
- Sequential workflow steps
- Operations on same file

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Timeout | Retry smaller scope |
| Incomplete | Follow-up task for remainder |
| Wrong approach | Retry clearer prompt |
| Conflict | Resolve manually |

After 2 retries → ask user.

---

## Result Synthesis

- Lead with conclusion
- Group by theme, not by agent
- Hide machinery ("Here's what I found" not "Agent 1 found X")
- Dedupe overlapping findings
