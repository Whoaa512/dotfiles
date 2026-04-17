---
name: airchat-remote
description: Push tasks to AirChat Remote from terminal, check session status, send messages to running sessions. Activate when user says "push to remote", "remote status", "check remote", "queue this on remote", or wants to dispatch async work to AirChat Remote workers.
---

# AirChat Remote Bridge

Terminal-native bridge to AirChat Remote. Push tasks, check status, interact with running sessions — without leaving the terminal.

## Trigger

Activate when:
- User says "push to remote", "send to remote", "queue this on remote"
- User says "remote status", "check remote", "what's running on remote"
- User says "remote send", "remote stop"
- User references AirChat Remote in context of dispatching async work

## Prerequisites

1. A running Airdev workspace with `airchat-daemon` connected to AirChat Remote
2. `iap-auth` available for authentication (standard Airbnb laptop setup)

If workspace isn't connected, guide user through setup (see Troubleshooting below).

## How It Works

Use the Bash tool to call AirChat Remote's REST API directly with curl. All commands follow the same pattern: get IAP token → call API → format output.

### API Base URL

```
https://airchatpro.a.musta.ch
```

Or override with `$AIRCHAT_API_URL` env var.

### Push a Task

Auto-detect repo/branch from cwd, then POST to create a task:

```bash
REPO=$(git remote get-url origin 2>/dev/null | sed -E 's/.*[:/]([^/]+\/[^/]+?)(\.git)?$/\1/')
BRANCH=$(git branch --show-current 2>/dev/null || echo "master")
TOKEN=$(iap-auth)

curl -s -X POST "https://airchatpro.a.musta.ch/v1/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg r "$REPO" --arg b "$BRANCH" --arg p "USER_PROMPT_HERE" \
    '{repo: $r, branch: $b, prompt: $p}')"
```

If user provides `--repo` or `--branch` overrides, use those instead of auto-detected.

After success, report:
- task_id and thread_id from response
- Link: https://airchat-remote-production.a.musta.ch/async-ai/sessions

### Check Status

```bash
TOKEN=$(iap-auth)
curl -s "https://airchatpro.a.musta.ch/v1/threads?limit=15&sort_by=updated_at&order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Format as compact table with status icons:

| Icon | Meaning |
|------|---------|
| 🟢 | Running (daemon connected, not completed) |
| ✅ | Completed |
| ❌ | Error |
| 🟡 | Needs input |
| ⚪ | Unknown/offline |

Show: `ID | Repo | Status | Age | Task prompt`
Summary: `N running  N done  N needs input`

### Send Message to Session

```bash
TOKEN=$(iap-auth)
curl -s -X POST "https://airchatpro.a.musta.ch/v1/threads/SESSION_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg c "MESSAGE" '{content: $c}')"
```

### Stop a Session

```bash
TOKEN=$(iap-auth)
curl -s -X POST "https://airchatpro.a.musta.ch/v1/threads/SESSION_ID/stop" \
  -H "Authorization: Bearer $TOKEN"
```

## Standalone CLI

A shell script is also available at:
```
projects/airchat/cli/tools/remote-bridge/remote
```

Symlink it for quick access:
```bash
ln -sf ~/work/ergo4/projects/airchat/cli/tools/remote-bridge/remote ~/bin/remote
```

Then use from any terminal:
```bash
remote push "add retry logic to webhook handler"
remote status
remote watch
remote send abc12345 "try a different approach"
remote stop abc12345
```

## Troubleshooting

**"Daemon not connected" error:**

```bash
yak ws create -r airbnb/ergo --name remote-worker
yak ws ssh remote-worker
airtool install airchat-daemon
airchat-daemon start --endpoint https://airchatpro.a.musta.ch --workspace-id remote-worker
gh auth login -h git.musta.ch
yak ws extend remote-worker -p 72h
```

**Auth errors:** Run `iap-auth` or `export IAP_BEARER_TOKEN=$(iap-auth)`

**Sessions visible at:** https://airchat-remote-production.a.musta.ch/async-ai/sessions

## Important Rules

- Always auto-detect repo/branch from cwd unless user provides explicit overrides
- Always show task_id and clickable link after pushing
- Keep status output compact — one line per session
- If API errors, show clear error + remediation steps
- Zero friction: never ask for information that can be inferred
