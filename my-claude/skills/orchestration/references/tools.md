# Orchestration Tools

## Task (Spawn Agents)

```python
Task(
    subagent_type="general-purpose",  # or "Explore", "Plan"
    description="Short description",
    prompt="Detailed instructions...",
    run_in_background=True,           # always True for parallel work
    model="haiku"                     # optional: haiku, sonnet, opus
)
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

## TaskOutput (Get Results)

```python
# Wait for completion
TaskOutput(task_id="abc123")

# Check without waiting
TaskOutput(task_id="abc123", block=False)

# Wait with timeout
TaskOutput(task_id="abc123", timeout=60000)
```

---

## TodoWrite (Track Work)

Track multi-step orchestration:

```python
TodoWrite(todos=[
    {"content": "Research auth patterns", "status": "in_progress", "activeForm": "Researching auth"},
    {"content": "Implement auth routes", "status": "pending", "activeForm": "Implementing auth"},
    {"content": "Write tests", "status": "pending", "activeForm": "Writing tests"}
])
```

Update as agents complete.

---

## AskUserQuestion (Clarify Scope)

When scope is unclear, ask:

```python
AskUserQuestion(questions=[
    {
        "question": "What scope are you envisioning?",
        "header": "Scope",
        "options": [
            {"label": "Production-ready", "description": "Full impl with tests, error handling"},
            {"label": "MVP", "description": "Core feature working, polish later"},
            {"label": "Prototype", "description": "Explore feasibility, throwaway OK"},
            {"label": "Design only", "description": "Architecture and plan, no code"}
        ],
        "multiSelect": False
    }
])
```

**Tips:**
- Up to 4 questions
- Up to 4 options per question
- Rich descriptions help users decide
- Use `multiSelect: True` when choices aren't exclusive

---

## Worker Preamble

Always prefix agent prompts:

```
CONTEXT: You are a WORKER agent.

RULES:
- Complete ONLY the task below
- Use tools directly (Read, Write, Edit, Bash, etc.)
- Do NOT spawn sub-agents
- Report results with absolute file paths

TASK:
[specific task]
```

---

## Example Prompts

### Implementation

```
CONTEXT: You are a WORKER agent.

RULES:
- Complete ONLY the task below
- Use tools directly (Read, Write, Edit, Bash, etc.)
- Do NOT spawn sub-agents
- Report results with absolute file paths

TASK:
Create src/routes/auth.ts:
- POST /login - verify credentials, return JWT
- POST /signup - create user, hash password
- Use bcrypt, jsonwebtoken
- Follow existing route patterns

RETURN: Confirm files created, summarize implementation.
```

### Exploration

```
CONTEXT: You are a WORKER agent.

RULES:
- Complete ONLY the task below
- Use tools directly (Read, Write, Edit, Bash, etc.)
- Do NOT spawn sub-agents
- Report results with absolute file paths

TASK:
Find all files related to user authentication:
- Route handlers for login/signup/logout
- Auth middleware
- Session/token management
- User model/schema

RETURN: List of files with brief description of each.
```

---

## Prompt Anti-Patterns

| Bad | Problem | Better |
|-----|---------|--------|
| "Fix the bug" | Which bug? Where? | "Fix 401 error after password reset in auth.ts" |
| "Build the frontend" | Too broad | Split: components, routing, state, API |
| "Implement auth" | No constraints | Specify: framework, token type, locations |
| "Check the code" | No focus | "Review for SQL injection, return severity ratings" |
