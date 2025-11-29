Take a screenshot of the current game state and analyze it using a subagent to avoid token bloat.

## Instructions

1. First, take a screenshot using the devtools MCP and save it to a temp file:
   ```
   mcp__devtools__take_screenshot with filePath: "/tmp/digidice-screenshot.png"
   ```

2. Then spawn a Task subagent with `subagent_type: "general-purpose"` and `model: "haiku"` to analyze the image:

   Prompt for the subagent:
   ```
   Read the screenshot at /tmp/digidice-screenshot.png and describe the game state concisely:

   1. **Board**: Grid positions of all monsters (use coordinates like A1, B2). Note which are player (blue?) vs enemy (red?).
   2. **Monster Stats**: For each visible monster, note: name, ATK/DEF if shown, any status effects
   3. **UI State**: Current phase, turn indicator, any buttons/prompts visible
   4. **Issues**: Any visual glitches, overlapping elements, or errors visible
   5. **Console**: If dev tools console is visible, note any errors/warnings

   Be extremely concise. Use shorthand. Example format:
   - Player: Blue-Eyes (A2) 3000/2500, Dark Magician (B1) 2500/2100
   - Enemy: Red-Eyes (D3) 2400/2000
   - Phase: Battle, Player turn
   - UI: "Attack" button highlighted

   DO NOT include the image in your response - text only.
   ```

3. Return the subagent's text description to me.

This approach extracts visual info without bloating the main context with large images.
