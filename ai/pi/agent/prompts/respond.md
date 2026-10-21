---
description: Slack/PR/doc URL → what are they actually asking, precedent, source check, reply drafted in my voice. Triggers "wtf is this", "what's the ask", "how should i respond", "can you help here", "draft a reply"
---
Investigate and draft a response for: $@

## Process

### 1. Name the ask (first line of your output)
- Read the URL/thread/doc (slack skill, gdoc, gh, fetch)
- First line of the reply to me: `they're asking for: <one clause>` (stamp? a fix? a decision? an owner? just venting?). If it's ambiguous, say the two readings and pick one. cj's most common second turn is "what is he actually asking?"; don't make him ask.

### 2. Precedent
- Support/channel asks: search the same channel for prior threads on the topic (slack skill search, `in:#channel`) and `~/work/*/_infra/docs` + `~/work/cj/notes`. Lead with "we answered this before: <link>" when true.
- If the ask touches another team's repo/config, name the owner (ownership.airbnb.tools) and stop at "ask <owner>"; never prescribe changes to their files.

### 3. Cross-reference source
- If the topic relates to code we own, read the relevant source; verify claims against the implementation
- Note inaccuracies in the thread
- Docs gap ("is this covered in our docs?" is a recurring follow-up): if the answer should have been in docs, say so and offer a docs-only PR on a **fresh branch** (not the fix PR). Link it from the reply.

### 4. Draft response (same turn, not a follow-up)
- Write in cj's voice (cj-voice skill); write the draft to `/tmp/respond-draft.md` and run `voice-lint.sh --register slack --file /tmp/respond-draft.md` before showing
- Format for the target platform:
  - **Slack:** backticks for code, short paragraphs, Markdown `[text](url)` links, emoji sparingly
  - **PR comment:** reference specific files/lines
  - **Google Doc:** full sentences, section headers if long
  - **Email:** professional but casual
- Lead with the answer, context after

### 5. Output
```
they're asking for: ...
precedent: <link | none>
---
<draft, raw text>
```
Copy the draft to clipboard. One line of what you verified vs assumed, then stop.
