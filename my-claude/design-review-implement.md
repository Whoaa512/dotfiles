---
name: design-review-implement
description: Design a feature with game-designer, critique it, refine scope, then implement
---

# Design-Review-Implement Workflow

Use this when a bead needs game design thinking before implementation.

## Workflow

### 1. Identify Target Bead
```bash
bd ready  # Find unblocked work
bd show <bead-id>  # Get full context
```

### 2. Spawn Game Designer (Plan)
Use Task tool with `subagent_type: game-designer`:
- Provide bead context and current description
- Ask for structured design document
- Request specific deliverables (categories, mechanics, data structures)

### 3. Spawn Game Designer (Critique)
Use Task tool with `subagent_type: game-designer` in **devil's advocate** role:
- Pass the proposed design
- Ask to identify: scope creep, bad mechanics, missing elements, implementation risks
- Request specific actionable cuts/changes

### 4. Update Bead with Refined Scope
```bash
bd update <bead-id> --description "$(cat <<'EOF'
## Scope (refined)
[Incorporate critique feedback]
[Clear implementation notes]
EOF
)"
```

### 5. Spawn Implementation Agent
Use Task tool with `subagent_type: super-coder` with `run_in_background: true`:
- Reference the bead ID
- Let agent explore codebase first
- Request incremental commits and tests
- Continue other work while it runs

## When to Use
- P1/P2 features needing design decisions
- Systems with multiple valid approaches
- Features where scope creep is a risk
- Anything requiring game feel/balance consideration

## Example Prompt for Designer
```
Design the [FEATURE] system for Oops All Traps.

**Context**: [Game mechanics relevant to feature]

**Current bead description**: [paste from bd show]

**Design the following**:
1. [Category 1]
2. [Category 2]
3. [Specific deliverables]

Output a structured design document suitable for implementation planning.
```

## Example Prompt for Critic
```
**ROLE: Devil's Advocate / Design Critic**

Critique this [FEATURE] design. Be ruthless. Find problems.

---
[Paste proposed design summary]
---

**CRITIQUE THE FOLLOWING:**
1. Scope Creep - What can be cut?
2. Quality - Which parts are boring/too hard/unhealthy?
3. Balance - Are rewards appropriate?
4. ROI - Is this worth building?
5. Missing Elements - What's obviously absent?
6. Implementation Risk - What will cause problems?

Output concise critique with specific actionable recommendations.
```

## Example Prompt for Implementation Agent
```
Implement the [FEATURE] system for Oops All Traps.

**Bead:** [bead-id] - run `bd show [bead-id]` for full spec

**Scope Summary:**
[Paste refined scope from bead - key points only]

**Implementation approach:**
1. First explore existing codebase - find relevant patterns
2. Create data structures
3. Add event hooks/tracking
4. Implement core logic
5. Add UI (DOM-based per architecture)
6. Write tests

**Key files to explore first:**
- [Relevant subsystem files]
- [Existing patterns to follow]

Start with tests where possible. Commit incrementally.
```

## Real Example (Codex & Achievements)

**Designer output:** 5 codex categories, 20 achievements, reward tiers
**Critic verdict:** Cut to Bestiary only + 12-15 achievements
**Implementation result:**
- `src/game/MatchTracker.ts` - event tracking
- `src/ui/CodexUI.ts` - modal UI
- `tests/data/*.test.ts` - 327 lines of tests
- 4 focused commits, build passing
