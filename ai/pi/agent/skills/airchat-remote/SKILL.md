---
name: airchat-remote
description: Push tasks to AirChat Remote from terminal, check session status, send messages to running sessions. Activate when user says "push to remote", "remote status", "check remote", "queue this on remote", or wants to dispatch async work to AirChat Remote workers.
---

# AirChat Remote Bridge

Terminal-native bridge to AirChat Remote. Push tasks, check status, interact with running sessions — without leaving the terminal.

## Trigger

Activate when user mentions pushing to remote, checking remote status, or dispatching async work to AirChat Remote.

## How It Works

There's a shell script at `projects/airchat/cli/tools/remote-bridge/remote` in the ergo repo (symlinked to `~/bin/remote`).

**Read it first**, then use its commands via bash:

```bash
cat ~/work/ergo4/projects/airchat/cli/tools/remote-bridge/remote
```

Run commands through bash. Examples:

```bash
remote push "task description"
remote push "task" --repo airbnb/ergo --branch main --workspace ws-name
remote status
remote watch
remote send <session-id> "message"
remote stop <session-id>
```

The script self-documents via `remote help`. Read it, use it, follow its conventions.
