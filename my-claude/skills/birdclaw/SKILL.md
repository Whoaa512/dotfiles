---
name: birdclaw
description: Query and manage a local-first Twitter/X workspace stored in SQLite via the `birdclaw` CLI. Use for local Twitter archives, DMs, likes, bookmarks, mentions, follow-graph queries, moderation (blocks/mutes), and AI digests. Data lives under `~/.birdclaw`.
---

# birdclaw

Local Twitter memory in SQLite: archives, DMs, likes, bookmarks, mentions, follow graph, moderation. The `birdclaw` binary is symlinked into `~/bin` (from `~/code/birdclaw`).

## When to Use
- Searching or exporting local Twitter/X data (tweets, DMs, mentions, likes, bookmarks)
- Importing a Twitter archive
- Follow-graph queries (mutuals, unfollows, top followers)
- Moderation: blocks / mutes
- AI digests / research briefs over local data
- Running the local web UI

## Key Rules
- **Add `--json`** (global flag, before the subcommand) for machine-readable output when scripting: `birdclaw --json <cmd>`.
- Data root is `~/.birdclaw` (SQLite DB + media/avatar cache).
- Node emits an experimental-SQLite warning on stderr — ignore it.
- First-time setup: `birdclaw init`.

## Common Commands
```bash
birdclaw init                       # create local root + seed DB
birdclaw archive find               # locate Twitter archives on disk
birdclaw import                     # import local archive data
birdclaw sync                       # refresh live collections into local store
birdclaw search <query>             # FTS5 search over tweets/DMs
birdclaw mentions --json            # export mention tweets for agents
birdclaw dms                        # direct messages
birdclaw graph                      # cache-only follow-graph queries (mutuals, unfollows...)
birdclaw whois <query>              # identify people/orgs from local DMs+tweets
birdclaw blocks / mutes             # moderation lists (ban/unban/mute/unmute aliases exist)
birdclaw digest [today|24h|week]    # streamed AI digest
birdclaw research <query>           # markdown brief from bookmarked threads
birdclaw db stats                   # storage + dataset stats
birdclaw backup                     # git-friendly text backups
birdclaw serve --port 3000          # run local web app (127.0.0.1)
```

Run `birdclaw <command> --help` for subcommand options. Full command list: `birdclaw --help`.

## Rebuilding
The binary loads `dist/`. After pulling changes rebuild from the repo:
```bash
cd ~/code/birdclaw && mise exec node@25 -- pnpm install && mise exec node@25 -- pnpm run build
```
(Package engines want Node >=25; the installed symlink runs fine on the default Node too.)
