---
name: asana
description: Personal task tracking with Asana CLI. Use for cross-repo work tracking, task management, dependencies.
---

# Asana CLI

Personal task tracker for cross-repo work.

## Context Setup
```bash
asana ctx project <gid>     # Set project for this repo
asana ctx task <gid>        # Set active task
asana ctx show              # View context
```

## Core Workflow
```bash
asana prime                 # AI context dump (start of session)
asana ready --assignee me   # Find unblocked work
asana task start <gid>      # Claim task (move to in_progress)
asana log "progress note"   # Add session log
asana done                  # Complete context task
```

## Dependencies
```bash
asana task dep add <task> <blocked-by>
asana task dep list <task>
asana task dep rm <task> <blocked-by>
asana blocked               # Show blocked tasks
```

## Multi-Project & Sections
```bash
asana task project add <task-gid> <project-gid>   # Add task to another project
asana task project rm <task-gid> <project-gid>     # Remove task from project
asana task project list <task-gid>                 # List projects for a task

asana section list --project <project-gid>         # List sections in a project
asana section add-task <section-gid> <task-gid>    # Move task into a section
asana section create --project <gid> --name "X"    # Create a section
```

## Search & Explore
```bash
asana search "query"        # Text search
asana task get <gid>        # Task details
```

## Config (.asana.json)
```json
{
  "project": "<project-gid>",
  "sections": {
    "planning": "<section-gid>",
    "in_progress": "<section-gid>",
    "blocked": "<section-gid>",
    "done": "<section-gid>"
  }
}
```

## Discovery
```bash
asana --help                # All commands
asana <cmd> --help          # Subcommands & flags
```

## Team Board Reference (Source Code Infrastructure)

Project GID: `1210814738437308`

| Section | GID | Use for |
|---------|-----|---------|
| Review Conductor | 1210814688138200 | review-conductor work |
| Airchat review | 1213418534336418 | airchat-review features, fixes, metrics |
| Ergo Graduation | 1210814688138198 | ergo graduation work |
| Ergo Polyglot | 1212072294914290 | polyglot support |
| Twig | 1212361636738091 | twig repo work |
| Graphite | 1213736100609525 | graphite trial |
| KTLO Work | 1213751483520520 | repo-scout, infra maintenance, operational work |

When adding tasks to team board, place them in the correct section by domain.
