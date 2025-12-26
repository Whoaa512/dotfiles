# Research & Document

Deep research a topic and update the corresponding bead with findings.

## Arguments
- `$ARGUMENTS` - The bead ID or topic to research (e.g., "stonks-rookie-3ch.8" or "monetization for stonks rookie")

## Workflow

1. **Parse input**: Determine if $ARGUMENTS is a bead ID or topic description
2. **Get context**: If bead ID provided, run `bd show <id>` to understand what needs researching
3. **Spawn deep-research agent**: Launch background agent with comprehensive research prompt covering:
   - Current state of the art
   - Competitor/precedent analysis
   - What works vs what fails
   - Non-obvious insights and connections
   - Actionable recommendations
4. **Wait for completion**: Monitor agent until done
5. **Summarize**: Present key findings to user in concise format
6. **Update bead**: Use beads-tracker agent to update the bead with detailed research findings
7. **Confirm**: Show user what was updated

## Example Usage

```
/research-doc stonks-rookie-3ch.8
/research-doc "marketing strategy for teen financial literacy app"
/research-doc stonks-rookie-7fj.3 --focus "stock picks and timeline"
```

## Notes
- Research runs in background - can take 2-5 minutes
- Always commits .beads after updating
- If no bead ID provided, will ask user which bead to update with findings
