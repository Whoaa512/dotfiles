---
name: improve-codebase-architecture
description: Explore a codebase to find opportunities for architectural improvement, focusing on testability by deepening shallow modules. Use when user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more maintainable.
---

# Improve Codebase Architecture

Explore a codebase, surface architectural friction, discover opportunities for improving testability, and propose module-deepening refactors.

A **deep module** (Ousterhout, "A Philosophy of Software Design") has a small interface hiding a large implementation. Deep modules are more testable, more navigable, and let you test at the boundary instead of inside.

## Process

### 1. Explore the codebase

Navigate organically and note friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow the interface is nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in their seams?
- Which parts are untested or hard to test?

The friction you encounter IS the signal.

### 2. Present candidates

Numbered list of deepening opportunities. For each:

- **Cluster**: Which modules/concepts are involved
- **Why they're coupled**: Shared types, call patterns, co-ownership of a concept
- **Dependency category**: See [REFERENCE.md](REFERENCE.md)
- **Test impact**: What existing tests would be replaced by boundary tests

Do NOT propose interfaces yet. Ask: "Which of these would you like to explore?"

### 3. User picks a candidate

### 4. Frame the problem space

Write an explanation of:
- Constraints any new interface would need to satisfy
- Dependencies it would need to rely on
- A rough illustrative code sketch to ground the constraints (not a proposal)

Show to user, then immediately proceed to step 5.

### 5. Design multiple interfaces

Spawn 3+ parallel agents. Each must produce a **radically different** interface:

- Agent 1: "Minimize the interface — aim for 1-3 entry points max"
- Agent 2: "Maximize flexibility — support many use cases"
- Agent 3: "Optimize for the most common caller — make the default case trivial"
- Agent 4 (if applicable): "Ports & adapters for cross-boundary dependencies"

Each outputs:
1. Interface signature
2. Usage example
3. What complexity it hides
4. Dependency strategy (see [REFERENCE.md](REFERENCE.md))
5. Trade-offs

Present designs sequentially, compare in prose. Give your own recommendation — be opinionated. Propose a hybrid if elements combine well.

### 6. User picks an interface

### 7. Document the proposal

Write a refactor proposal as a markdown file in `./plans/` using the template in [REFERENCE.md](REFERENCE.md). Include the chosen interface, dependency strategy, testing plan, and migration guidance.
