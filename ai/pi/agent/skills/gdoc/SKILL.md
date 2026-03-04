---
name: gdoc
description: Google Docs CLI for reading, converting, and creating docs. Use when working with Google Docs or converting markdown.
---

# Google Docs CLI (`gdoc`)

Read and write Google Docs as markdown.

## Read Doc as Markdown
```bash
gdoc read <doc-url>
gdoc read "https://docs.google.com/document/d/..."
```

## Read Doc Comments
```bash
gdoc comments <doc-url>
```

## Convert Markdown to Google Doc
```bash
gdoc convert <file.md>
gdoc convert ./notes/design.md
```

Returns the URL of the created Google Doc.
