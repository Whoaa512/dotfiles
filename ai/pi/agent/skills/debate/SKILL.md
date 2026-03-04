---
name: debate
description: >
  Multi-model debate and consensus engine. Triggers when user says "debate this" or uses /skill:debate.
  Sends a design question to two sub-agents (Opus and GPT) who go back and forth until they reach consensus,
  then one summarizes findings back to the main thread.
---

# Debate Skill

When triggered, orchestrate a structured debate between two AI models on the user's topic.

## Trigger

Activate when the user says **"debate this"**, **"debate:"**, or explicitly invokes `/skill:debate`.

## How It Works

You are the **orchestrator**. You do NOT participate in the debate itself. You manage the loop.

### Step 1: Extract the Prompt

Take the user's message and distill it into a clear, debatable design question or topic. This becomes the **start prompt**.

### Step 2: Seed Round (Parallel)

Use the `subagent` tool in **parallel** mode to send the SAME start prompt to both agents simultaneously:

```
subagent({
  tasks: [
    { agent: "debate-opus", task: "<start prompt>" },
    { agent: "debate-gpt", task: "<start prompt>" }
  ]
})
```

Collect both initial positions.

### Step 3: Debate Loop

Now run alternating rounds. Each round:

1. Send **debate-gpt's latest response** to **debate-opus** as a new task:
   ```
   subagent({ agent: "debate-opus", task: "The other agent (GPT) responded:\n\n<gpt's response>\n\nRespond to their points." })
   ```

2. Send **debate-opus's latest response** to **debate-gpt** as a new task:
   ```
   subagent({ agent: "debate-gpt", task: "The other agent (Opus) responded:\n\n<opus's response>\n\nRespond to their points." })
   ```

**Check for consensus** after each round: if EITHER agent's response contains `CONSENSUS_REACHED`, move to Step 4.

**Max rounds: 4.** If no consensus after 4 rounds, force Step 4 anyway with what you have.

### Step 4: Elect Summarizer

Pick whichever agent had the most comprehensive final status section. Send them a final task:

```
subagent({
  agent: "<chosen-agent>",
  task: "The debate has concluded. Here is the full exchange:\n\n<all rounds concatenated>\n\nProduce a final summary with:\n1. **Consensus** - What both sides agreed on\n2. **Key Trade-offs** - Where opinions diverged and why\n3. **Recommendation** - The synthesized recommendation\n4. **Open Questions** - Anything unresolved\n\nBe concise and actionable."
})
```

### Step 5: Report Back

Present the summarizer's output to the user in the main thread. Format it clearly:

```
## Debate Results

**Topic:** <original question>
**Rounds:** <N>
**Consensus:** <yes/partial/no>

<summarizer's output>
```

## Important Rules

- Do NOT inject your own opinions into the debate.
- Do NOT skip rounds or shortcut the process.
- Each agent gets the other's FULL response, not a summary.
- If an agent errors out, note it and continue with the remaining agent.
- Keep the user informed of progress (e.g., "Round 2 of 4...").
