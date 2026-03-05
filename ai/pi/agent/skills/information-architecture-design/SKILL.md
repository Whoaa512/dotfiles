---
name: information-architecture-design
description: >
  Design navigation, taxonomy, and information architecture for apps/products.
  Plan + diagram first, implement after approval. Use for nav structure, sitemap,
  content organization, or taxonomy design.
---

# Information Architecture Design

## Trigger

- **Explicit:** "design the IA", "help with navigation", "organize the taxonomy"
- **Auto-detect:** discussions about nav confusion, page hierarchy, content organization, sitemap, naming/labeling, discoverability problems

## Operating Contract

- Always **plan + diagram first**, never jump to implementation
- Require **user approval** before making changes
- Use **opinionated defaults**; accept overrides when requested
- Stay concrete—no abstract IA theory

## Step 0: Mode Selection

Decide which path based on context:

| Signal | Mode |
|--------|------|
| Existing codebase/product with routes, nav components, or config | **Scan** → analyze existing structure, propose improvements |
| Greenfield project or no artifacts to scan | **Interview** → ask targeted questions to understand needs |
| Mixed/unclear | Quick scan first, then focused interview to fill gaps |

## Step 1: Discovery

### Scan Mode
Look for:
- Route definitions / URL structure
- Nav components / menu configs
- Page/screen inventory
- Content types and relationships

### Interview Mode
Starting questions (adapt, don't recite verbatim):
- Who are the primary users? What are their top 3 tasks?
- What content types exist (or will exist)?
- What's the expected scale? (pages, items, categories)
- Are there existing mental models or conventions users expect?
- What platforms? (web, mobile, CLI, API)
- Any hard constraints? (tech stack, legacy compatibility)

## Step 2: Synthesis

Summarize findings before proposing:
- **Users & goals** — who and what they're trying to do
- **Content inventory** — what exists or will exist
- **Constraints** — tech, scale, legacy, platform
- **Current pain points** — if existing product

## Step 3: Propose IA Plan

Present the architecture for approval. Include relevant deliverables:

### Navigation Model
Primary, secondary, and utility navigation structures. Show hierarchy and relationships.

### Content Model
Content types, their attributes, relationships, and taxonomy. Use tables for clarity.

### User Flow Map
Key task paths showing how users accomplish their top goals through the structure.

### Validation Checklist
Review the proposal against principles:
- [ ] Labels are clear, consistent, jargon-free
- [ ] Related items are grouped logically
- [ ] Depth is appropriate (progressive disclosure)
- [ ] Structure scales with projected growth
- [ ] Organized by user tasks, not internal structure
- [ ] Key items are discoverable from expected entry points

## Step 4: Implement (after approval)

- Make changes incrementally, small commits
- Validate each step against the approved plan
- Flag any deviations for re-approval

## Output Formats

Pick what fits the deliverable:
- **Mermaid diagrams** — hierarchy, flows, relationships
- **ASCII trees** — quick nav structure overview
- **Markdown tables** — taxonomy, content models, attribute maps
- Combine formats freely

## Output Scaffold

Use as a starting structure, not a rigid template:

```markdown
## IA Plan: [Product/Feature Name]

### Context
[Summary from discovery]

### Navigation Model
[Diagram + description]

### Content Model
[Table or diagram of types/relationships]

### User Flows
[Key task paths]

### Risks & Open Questions
[What needs further validation]
```

## Principles

Apply throughout, don't list to user:
- **Clarity** — consistent naming, no jargon
- **Logical grouping** — related items together
- **Progressive disclosure** — don't overwhelm; reveal depth on demand
- **Scalability** — design for growth
- **Task-oriented** — organize by what users do, not by content type
- **Discoverability** — things live where users expect them
