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
