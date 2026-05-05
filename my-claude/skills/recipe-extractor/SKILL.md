---
name: recipe-extractor
description: Extract recipes from YouTube cooking videos into clean markdown notes. Use when asked to get recipes from a video URL.
---

# Recipe Extractor

Extract recipes from YouTube cooking videos and save as organized markdown in `notes/youtube/`.

## When to Use

- User shares a YouTube cooking/recipe video and wants recipes extracted
- User says "extract recipes", "get the recipes from this video", "what recipes are in this video"

## Process

1. **Get transcript** using the video-transcript-downloader skill's vtd.js:
   ```bash
   cd ~/Projects/agent-scripts/skills/video-transcript-downloader
   ./scripts/vtd.js transcript --url '<URL>' > /tmp/claude/recipe-transcript.txt
   ```
   If vtd.js fails, fall back to yt-dlp directly:
   ```bash
   mkdir -p /tmp/claude
   yt-dlp --write-auto-subs --sub-lang en --skip-download --sub-format vtt -o "/tmp/claude/recipe-video" "<URL>"
   ```
   Then clean VTT with Python:
   ```python
   python3 -c "
   import re
   with open('/tmp/claude/recipe-video.en.vtt') as f:
       text = f.read()
   lines = text.split('\n')
   seen = set()
   clean = []
   for line in lines:
       line = re.sub(r'<[^>]*>', '', line).strip()
       if not line or re.match(r'^(WEBVTT|Kind:|Language:|NOTE|\d{2}:\d{2})', line):
           continue
       if line not in seen:
           seen.add(line)
           clean.append(line)
   print(' '.join(clean))
   " > /tmp/claude/recipe-clean.txt
   ```

2. **Get video title:**
   ```bash
   yt-dlp --print title "<URL>"
   ```

3. **Extract recipes** from the transcript. For each recipe include:
   - Name and macros (calories, protein) if mentioned
   - Ingredients with quantities
   - Step-by-step instructions (concise, actionable)
   - Pro tips mentioned by the creator
   - Cooking temps and times

4. **Save to file** at `notes/youtube/<slugified-title>-<video-id>.md` with format:
   ```markdown
   # Video Title

   Source: https://www.youtube.com/watch?v=VIDEO_ID

   Brief summary of what the video covers.

   **Recurring staples:** list common ingredients across recipes

   ---

   ## 1. Recipe Name
   **Macros per serving**

   ### Component Name
   - ingredient list
   - instructions

   ### Assembly
   - step by step

   ---
   ## Pro Tips
   - collected tips from the video
   ```

## Output Format Rules

- Keep instructions concise and actionable
- Include exact measurements when given
- Note cooking temperatures and times precisely
- Group sub-recipes (sauces, fillings) under their parent recipe
- Include assembly/final steps separately
- Collect pro tips at the end or inline where relevant
