# Research & Document

Deep research a topic and produce concise findings.

## Arguments
- `$ARGUMENTS` - The topic to research

## Workflow

1. **Parse input**: Determine the topic and desired output format.
2. **Spawn deep-research agent**: Launch background agent with comprehensive research prompt covering:
   - Current state of the art
   - Competitor/precedent analysis
   - What works vs what fails
   - Non-obvious insights and connections
   - Actionable recommendations
3. **Wait for completion**: Monitor agent until done.
4. **Summarize**: Present key findings to user in concise format.
5. **Save if requested**: Write findings to the requested doc/path.

## Example Usage

```
/research-doc "marketing strategy for teen financial literacy app"
/research-doc "stock picks and timeline"
```

## Notes
- Research runs in background - can take 2-5 minutes.
