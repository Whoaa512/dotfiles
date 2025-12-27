# Human TODO Pattern

When tasks require manual human action (IRL work, external services, design decisions), track them in `HUMAN_TODO.md` at project root.

## When to Use

- App Store submissions, uploads
- Design work (icons, screenshots)
- External account setup
- Physical-world actions
- Decisions requiring human judgment
- Third-party service configuration

## Format

```markdown
# Human TODO

Tasks requiring manual action or real-world work.

## [Category]

- [ ] Task description
- [ ] Another task
```

## Rules

1. Keep separate from code TODOs and beads
2. Use checkboxes for trackability
3. Group by urgency/category
4. Claude should create/update this file when encountering manual blockers
5. Don't mix with automated tasks - those go in beads
