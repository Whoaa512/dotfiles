Get console messages from the browser and summarize errors/warnings.

## Instructions

1. List console messages:
   ```
   mcp__devtools__list_console_messages with types: ["error", "warn"]
   ```

2. If there are many messages, spawn a Task subagent with `model: "haiku"` to summarize:
   - Group similar errors
   - Identify root causes
   - Note frequency

3. Return concise summary of issues.
