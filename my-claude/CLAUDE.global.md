
## Always important
- Be extremely concise. Sacrifice grammar for the sake of concision.  Never forget this
- be as token efficient as possible
- Never include `Co-Authored-By: Claude <noreply@anthropic.com>` or `Generated with [Claude Code](https://claude.ai/code)` in any commit message
- Ponder possible solutions and always for the simplest approach.
- Avoid over-engineering as much as possible. We strive to be very grug brained at this establishment
- When working on code or features, please be sure to commit at each step with useful messages, and validate changes with tests, and write new tests if needed.
- Make commits small & focused to allow for easier review.
- Never leave obvious code comments
- Don't forget to run the linter before committing too
- When writing commit messages, Focus on why. if you don't know why, ask the user
- You don't need `-C` on git commands for operating in the current directory

### Language specifics
* Python
  * When creating ad-hoc python scripts that rely on dependencies, use PEP 723 inline script metadata
  * for fastest iteration use single file scripts
    * add dep: `uv add --script <script_path> <dep_names...>`
    * run: `uv run <script_path>`
* Nodejs/Typescript
  * for fastest iteration use `bun`

## Personal Notes

- When asked to "take a note of this" or create personal documentation, store these files in the @/Users/cjw/code/cj/notes directory.
  - Keep good organization in this dir
  - treat this as a personal mind map of our knowledge together


## tmux for Dev Servers
- Always start background dev servers in named tmux sessions: `tmux new-session -d -s <name> '<command>'`
- Before starting a server, check if it's already running: `tmux has-session -t <name> 2>/dev/null`
- View running sessions: `tmux list-sessions`
- Attach to check logs: `tmux attach -t <name>`
- Kill when done: `tmux kill-session -t <name>`

## Available CLI Tools
- Use `fd` instead of `find` for file discovery:
  - `fd -e java -e kt MockTrip projects/dora` (find files by name and extension)
  - `fd -t f pattern path` (files only)
- Use `rg` (ripgrep) for content search:
  - `rg -t java -t kotlin "pattern" path` (search by file type)
  - `rg -l "pattern" path` (list files with matches only)
  - `rg "^package.*pattern"` (anchor to line start)
  - `rg "class.*pattern|interface.*pattern"` (multiple patterns with OR)
- Use `tree` for directory structure viewing
- `gh` for querying Github
- `src search` for querying Sourcegraph
- `uv` for python things (see `uv --help`)
- `xan` CSV magician - successor to `BurntSushi/xsv`
- `bk` buildkite CLI tool - **prefer `bk api` over Buildkite MCP tools** to reduce context token usage
  - pipe to `jq` to filter/extract only what's needed
  - e.g. `bk api /organizations/airbnb/pipelines/{pipeline}/builds/{num}/annotations | jq '.[] | select(.context | startswith("abc123")) | .body_html'`
- `yt-dlp` YouTube/video downloader:
  - `yt-dlp <url>` - download video
  - `yt-dlp -x <url>` - extract audio only
  - `yt-dlp -f 'bestaudio' <url>` - specific format
  - `yt-dlp -F <url>` - list available formats
  - `yt-dlp -o '%(title)s.%(ext)s' <url>` - custom output template
  - `yt-dlp --write-subs --embed-subs <url>` - include subtitles
- `bear-go` Query Bear notes from SQLite:
  - `bear-go list` - list all note titles (most recent first)
  - `bear-go search <term>` - search titles and content
  - `bear-go get <title>` - get note by exact title (outputs markdown)
- `devtools` Chrome DevTools CLI (lighter than MCP on context):
  - `devtools pages` - list open pages
  - `devtools go <url>` - navigate
  - `devtools snap` - accessibility snapshot
  - `devtools screenshot [path]` - capture
  - `devtools click/hover/fill <uid>` - interact with elements
  - `devtools eval <script>` - run JS
  - `devtools console/network [idx]` - inspect logs/requests
  - Use `--json` for structured output, `-s <id>` to target specific session
- `gt` The Graphite CLI. Useful for creating/managing stacked PRs. Do not use unless the repo specifically calls for this. Quick reference:
  - Atomic change: `git commit` == `gt create`
  - Include changes in an existing atomic change `git commit --amend` == `gt modify`
  - Distinct addition to an existing atomic change == `gt modify --commit -m "..."`
    - DON'T FORGET the `--commit`
  - View stack `gt log short --stack --no-interactive`
  - Absorb changes into existing stack: `gt absorb`
  - Fold a branch's changes into its parent: `gt fold`
  - Insert new stack node (aka branch) between the current branch and its child: `gt create --insert`

### Beads (Issue Tracker)
> If the repo states it uses Beads, or has the .beads dir

Git-backed issue tracker for AI agents. Issues live in `.beads/issues.jsonl`.

```bash
# Core workflow
bd create "Issue title"       # Create issue (returns hash ID like bd-a1b2)
bd list                       # Show all issues
bd ready                      # Show unblocked work
bd show <id>                  # View issue details
bd update <id> --status in-progress
bd close <id>                 # Mark done
bd sync                       # Push/pull with git
# Dependencies
bd dep add <id> --blocks <other-id>
bd blocked                    # Show blocked issues
# Other useful
bd search "query"             # Text search
bd comment <id> "note"        # Add comment
bd prime                      # AI context dump
```



## Line of Sight Code Style Guidelines
Align the happy path to the left edge - Normal execution flow at left margin, errors/edge cases indented.

Rules
1. Early Exit Pattern
- Exit early on errors/invalid conditions
- Flip if statements to avoid else blocks
- Handle errors immediately when they occur

2. Structure
- Happy path flows down the left edge
- Happy return statement on the last line
- Extract complex logic into separate functions
- Keep function bodies small

3. Avoid Deep Nesting
Instead of:
```go
if something.OK() {
    // happy path logic nested
    return nil
} else {
    return errors.New("not ok")
}
```

Do:
```go
if !something.OK() {
    return errors.New("not ok")
}
// happy path logic at left margin
return nil
```
4. Complex Conditionals

Extract switch/case bodies into separate functions rather than inline logic.
Keep successful execution paths at the left margin. Handle errors with early returns. Avoid else blocks and deep nesting. Structure functions so main logic flows top-to-bottom without indentation.

<edit_guidelines>
- always use `fd` over `find`
- always use `rg` for search over `grep`
  - `grep` can be allowed for simple filtering in a chain of pipelined commands
</edit_guidelines>
