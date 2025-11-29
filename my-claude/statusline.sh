#!/bin/bash
# Claude Code Status Line
# Shows: directory | tokens | branch | current task

# ANSI colors
CYAN='\033[36m'
YELLOW='\033[33m'
GREEN='\033[32m'
MAGENTA='\033[35m'
DIM='\033[2m'
RESET='\033[0m'

# Read JSON input from stdin
input=$(cat)

# Extract values using jq
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // .cwd')
PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir // .cwd')
TRANSCRIPT_PATH=$(echo "$input" | jq -r '.transcript_path // ""')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')

# Format directory - show relative to project or just basename
if [[ "$CURRENT_DIR" == "$PROJECT_DIR" ]]; then
    DIR_DISPLAY="${CURRENT_DIR##*/}"
else
    # Show relative path from project
    DIR_DISPLAY="${CURRENT_DIR#$PROJECT_DIR/}"
    [[ "$DIR_DISPLAY" == "$CURRENT_DIR" ]] && DIR_DISPLAY="${CURRENT_DIR##*/}"
fi

# Get current context size from last message's usage
TOKENS_DISPLAY="0"
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
    # Get last message's total input context (non-cached + cached)
    CONTEXT_SIZE=$(jq -s '
        [.[] | .message?.usage? | select(. != null)] | last |
        ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))
    ' "$TRANSCRIPT_PATH" 2>/dev/null)

    if [[ -n "$CONTEXT_SIZE" && "$CONTEXT_SIZE" != "0" && "$CONTEXT_SIZE" != "null" ]]; then
        # Format with K suffix for thousands
        if [[ "$CONTEXT_SIZE" -ge 1000000 ]]; then
            TOKENS_DISPLAY=$(awk "BEGIN {printf \"%.1fM\", $CONTEXT_SIZE / 1000000}")
        elif [[ "$CONTEXT_SIZE" -ge 1000 ]]; then
            TOKENS_DISPLAY=$(awk "BEGIN {printf \"%.1fK\", $CONTEXT_SIZE / 1000}")
        else
            TOKENS_DISPLAY="$CONTEXT_SIZE"
        fi
    fi
fi

# Get git branch
GIT_BRANCH=""
if [[ -d "$CURRENT_DIR" ]]; then
    cd "$CURRENT_DIR" 2>/dev/null
    if git rev-parse --git-dir > /dev/null 2>&1; then
        BRANCH=$(git branch --show-current 2>/dev/null)
        if [[ -n "$BRANCH" ]]; then
            # Check for uncommitted changes
            if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
                GIT_BRANCH="${YELLOW}${BRANCH}*${RESET}"
            else
                GIT_BRANCH="${GREEN}${BRANCH}${RESET}"
            fi
        fi
    fi
fi

# Try to get current task from transcript (last in_progress todo or last user message)
TASK=""
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
    # Look for in_progress todo items
    TASK=$(jq -r '
        [.[] | select(.type == "assistant") | .message.content[]? |
         select(.type == "tool_use" and .name == "TodoWrite") |
         .input.todos[]? | select(.status == "in_progress") | .content] |
        last // empty
    ' "$TRANSCRIPT_PATH" 2>/dev/null | head -c 40)

    # If no todo, get last user message summary
    if [[ -z "$TASK" ]]; then
        TASK=$(jq -r '
            [.[] | select(.type == "user") | .message.content |
             if type == "array" then .[0].text // .[0] else . end |
             select(type == "string")] | last // empty
        ' "$TRANSCRIPT_PATH" 2>/dev/null | head -c 40 | tr '\n' ' ')
    fi

    # Truncate and add ellipsis if needed
    if [[ ${#TASK} -ge 40 ]]; then
        TASK="${TASK:0:37}..."
    fi
fi

# Format cost
COST_DISPLAY=""
if [[ "$COST" != "0" && "$COST" != "null" && -n "$COST" ]]; then
    COST_DISPLAY=$(awk "BEGIN {printf \"\$%.2f\", $COST}")
fi

# Build output
OUTPUT="${CYAN}${DIR_DISPLAY}${RESET}"
OUTPUT+=" ${DIM}|${RESET} ${TOKENS_DISPLAY}ctx"
if [[ -n "$COST_DISPLAY" ]]; then
    OUTPUT+=" ${DIM}(${COST_DISPLAY})${RESET}"
fi

if [[ -n "$GIT_BRANCH" ]]; then
    OUTPUT+=" ${DIM}|${RESET} ${GIT_BRANCH}"
fi

if [[ -n "$TASK" ]]; then
    OUTPUT+=" ${DIM}|${RESET} ${MAGENTA}${TASK}${RESET}"
fi

echo -e "$OUTPUT"
