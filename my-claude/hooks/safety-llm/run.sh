#!/bin/bash
set -e

CACHE_DIR="${HOME}/.cc-safety-llm"
ALLOWLIST="${CACHE_DIR}/allowlist.jsonl"
PROMPT_FILE="$(dirname "$0")/prompt.md"

mkdir -p "$CACHE_DIR"

# Read hook input
INPUT=$(cat)

# Only process Bash tool
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

# Extract command and cwd
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')

if [[ -z "$COMMAND" ]]; then
    exit 0
fi

# Hash the command for cache lookup
CMD_HASH=$(echo -n "$COMMAND" | shasum -a 256 | cut -d' ' -f1)

# Check allowlist cache
if [[ -f "$ALLOWLIST" ]]; then
    CACHED=$(grep "\"hash\":\"$CMD_HASH\"" "$ALLOWLIST" 2>/dev/null | head -1 || true)
    if [[ -n "$CACHED" ]]; then
        VERDICT=$(echo "$CACHED" | jq -r '.verdict')
        if [[ "$VERDICT" == "SAFE" ]]; then
            exit 0
        fi
    fi
fi

# Read prompt template and substitute cwd
PROMPT=$(sed "s|{{CWD}}|$CWD|g" "$PROMPT_FILE")

# Call Opus for evaluation (no tools, no session persistence)
RESPONSE=$(claude --print --model opus --tools "" --no-session-persistence --output-format text "$PROMPT

Command to evaluate:
$COMMAND" 2>&1) || {
    # API failure = fail-closed
    jq -n '{
        hookSpecificOutput: {
            permissionDecision: "deny",
            message: "Safety check failed (API unavailable). Command blocked."
        }
    }'
    exit 0
}

# Parse response
VERDICT=$(echo "$RESPONSE" | grep -E "^VERDICT:" | head -1 | sed 's/VERDICT:[[:space:]]*//')
REASON=$(echo "$RESPONSE" | grep -E "^REASON:" | head -1 | sed 's/REASON:[[:space:]]*//')

# Default to UNCERTAIN if parsing fails
if [[ -z "$VERDICT" ]]; then
    VERDICT="UNCERTAIN"
    REASON="Could not parse safety evaluation response"
fi

case "$VERDICT" in
    SAFE)
        # Add to allowlist and allow
        jq -n \
            --arg cmd "$COMMAND" \
            --arg hash "$CMD_HASH" \
            --arg verdict "$VERDICT" \
            --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '{cmd: $cmd, hash: $hash, verdict: $verdict, ts: $ts}' >> "$ALLOWLIST"
        exit 0
        ;;
    UNSAFE|UNCERTAIN)
        # Block with reason
        jq -n \
            --arg reason "$REASON" \
            --arg verdict "$VERDICT" \
            '{
                hookSpecificOutput: {
                    permissionDecision: "deny",
                    message: ("Safety: " + $verdict + " - " + $reason)
                }
            }'
        exit 0
        ;;
    *)
        # Unknown verdict = block
        jq -n \
            --arg response "$RESPONSE" \
            '{
                hookSpecificOutput: {
                    permissionDecision: "deny",
                    message: ("Safety check returned unexpected response: " + $response)
                }
            }'
        exit 0
        ;;
esac
