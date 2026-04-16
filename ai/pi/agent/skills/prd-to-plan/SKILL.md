---
name: prd-to-plan
description: Turn a PRD into a multi-phase implementation plan using tracer-bullet vertical slices, saved as a local Markdown file in ./plans/. Use when user wants to break down a PRD, create an implementation plan, plan phases from a PRD, or mentions "tracer bullets".
---

# PRD to Plan

Break a PRD into a phased implementation plan using vertical slices (tracer bullets). Output is a Markdown file in `./plans/`.

## Process

### 1. Confirm the PRD is in context

The PRD should already be in the conversation. If not, ask the user to paste it or point to the file.

### 2. Explore the codebase

Understand current architecture, existing patterns, and integration layers.

### 3. Identify durable architectural decisions

Before slicing, identify high-level decisions unlikely to change:

- Route structures / URL patterns
- Database schema shape
- Key data models
- Auth approach
- Third-party service boundaries

These go in the plan header so every phase can reference them.

### 4. Draft vertical slices

Break the PRD into **tracer bullet** phases. Each phase is a thin vertical slice through ALL layers end-to-end, NOT a horizontal slice of one layer.

Rules:
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Do NOT include specific file names or implementation details likely to change
- DO include durable decisions: route paths, schema shapes, data model names

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each phase show:
- **Title**: short descriptive name
- **User stories covered**: which from the PRD this addresses

Ask: Does the granularity feel right? Should any phases be merged or split?

Iterate until approved.

### 6. Write the plan file

Create `./plans/` if needed. Name after the feature (e.g. `./plans/user-onboarding.md`).

Template:

```markdown
# Plan: <Feature Name>

> Source PRD: <brief identifier or link>

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: ...
- **Schema**: ...
- **Key models**: ...

---

## Phase 1: <Title>

**User stories**: <list from PRD>

### What to build

Concise description of this vertical slice. End-to-end behavior, not layer-by-layer.

### Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

---

## Phase 2: <Title>

...
```
