---
description: Run app, validate in browser/CLI, iterate on issues — autonomous validation loop
---

# Dogfood Skill

Autonomously run and validate the current project.

## Trigger
User says "dogfood", "dogfood this", "try it", "validate it works", or invokes `/dogfood`.

## Process

### 1. Detect project type
Read the project for clues:
- `package.json` → check `scripts.dev`, `scripts.start`, `scripts.serve`
- `Makefile` / `mise.toml` / `.mise.toml` → check for dev/serve tasks
- `go.mod` + `cmd/` → `go run ./cmd/...`
- `Procfile`, `docker-compose.yml` → container-based
- `yak s` → check for a dev/serve script

### 2. Start the app
- Start in a **tmux session** so it persists: `tmux new-session -d -s dogfood '<start command>'`
- Wait for startup (check logs or poll health endpoint)
- If it crashes immediately, read output and fix

### 3. Validate
Choose validation strategy based on project type:

**Web app/UI:**
- Use playwright MCP to navigate to the app
- Take snapshots of key pages
- Check for errors in console, broken layouts, missing data
- Compare against expected behavior from docs/README

**CLI tool:**
- Run with sample inputs
- Check exit codes, output format
- Test edge cases (empty input, bad args, help flag)

**API/service:**
- `curl` health endpoint
- Hit key endpoints with sample payloads
- Check response codes and shapes

### 4. Report
```
## Dogfood Report

**Status:** WORKING / BROKEN / PARTIAL

**Tested:**
- ✅ Homepage renders
- ✅ API responds on /health
- ❌ Search returns empty results
- ⚠️ Slow load on /dashboard (3.2s)

**Issues found:**
1. ...
```

### 5. Fix (if asked)
Fix issues found, restart app, re-validate.

### 6. Cleanup
When done: `tmux kill-session -t dogfood`

## Arguments
- `$@` — optional: specific page/endpoint/feature to validate
