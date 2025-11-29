Take a screenshot and ask a specific question about it via subagent.

## Arguments
$ARGUMENTS - Your question about the visual (e.g., "is the attack animation playing?" or "what's wrong with the sprite positioning?")

## Instructions

1. Take screenshot:
   ```bash
   devtools screenshot /tmp/digidice-screenshot.png
   ```

2. Spawn Task subagent with `subagent_type: "general-purpose"` and `model: "haiku"`:

   ```
   Read the screenshot at /tmp/digidice-screenshot.png and answer this question:

   $ARGUMENTS

   Be concise and direct. Text response only - DO NOT include the image.
   ```

3. Return the answer.
