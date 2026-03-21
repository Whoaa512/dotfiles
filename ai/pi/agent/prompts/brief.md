---
description: Read URL(s) and produce a concise briefing — TL;DR, key points, action items
---
Read and brief me on: $@

## Process

1. **Fetch content** via the appropriate tool:
   - Slack URL → use slack-cli skill
   - Google Doc → use `gdoc get <doc> --markdown`
   - Internal URL (*.a.musta.ch) → `curl -H "Authorization: Bearer $(iap-auth)" "URL"`
   - General URL → fetch/extract tool
   - If fetch fails, try playwright MCP as fallback

2. **Produce briefing:**

### TL;DR
One sentence.

### Key Points
- Bulleted, 3-5 items max

### Relevance
How does this relate to current work? (check current branch/repo context)

### Action Items
- What should I do about this, if anything?

### Notable Quotes
Pull 1-2 direct quotes if particularly insightful.

If the content is a discussion/thread, identify who said what and where there's agreement vs disagreement.

If asked to respond afterward, draft in user's voice (use cj-voice skill).
