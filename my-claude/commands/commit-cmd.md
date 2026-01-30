Use a Haiku sub-agent to create a git commit.

Arguments: $ARGUMENTS (optional - files to stage/commit)

## Instructions

Spawn a Task subagent with `subagent_type: "general-purpose"` and `model: "haiku"` with this prompt:

```
Create a git commit. Files argument: "$ARGUMENTS"

1. Run in parallel:
   - `git status` to see files
   - `git diff` for unstaged changes
   - `git diff --cached` for staged changes
   - `git log --oneline -5` for recent commit style

2. Staging:
   - If files specified in argument, stage only those: `git add <files>`
   - If nothing specified and nothing staged, stage relevant changes (skip .beads/, generated files)
   - If already staged, use existing staging

3. Write a concise commit message:
   - Focus on WHY not what
   - Match repo's commit style
   - No "Co-Authored-By" or "Generated with Claude" lines

4. Commit with: git commit -m "$(cat <<'EOF'
<message>
EOF
)"

5. Run `git status` to confirm success

Return the commit hash and message.
```
