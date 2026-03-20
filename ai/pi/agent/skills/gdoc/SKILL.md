---
name: gdoc
description: Google Docs CLI for reading, converting, syncing, and editing docs. Use when working with Google Docs or converting markdown.
---

# Google Docs CLI (`gdoc`)

Read, write, and edit Google Docs. All `<DOC>` args accept URL or doc ID.

## Read
```bash
gdoc get <DOC> --markdown          # doc as markdown (preferred)
gdoc get <DOC>                     # plain text
gdoc get <DOC> --json              # full API response
gdoc get <DOC> --json=simple       # text with character indices
gdoc get <DOC> --markdown --image-dir ./imgs  # download images too
```

## Comments & Suggestions
```bash
gdoc comments <DOC>                # markdown format
gdoc comments <DOC> --format json
gdoc suggestions <DOC>             # pending suggestions
gdoc revisions <DOC>               # revision history
```

## Convert & Sync
```bash
gdoc convert <file.md>                        # markdown → new Google Doc, returns URL
gdoc convert <file.md> --title "My Doc"       # custom title
gdoc convert <file.md> --folder <folder-id>   # into specific Drive folder
gdoc sync <DOC> <file.md> --pull              # pull doc → local markdown
gdoc sync <DOC> <file.md> --pull --force      # overwrite existing local file
gdoc sync <DOC> <file.md> --pull --dry-run    # preview changes
```

## Edit
```bash
gdoc insert <DOC> "text"                      # insert at start
gdoc insert <DOC> "text" --index 42           # insert at index
gdoc delete <DOC> <START> <END>               # delete range
gdoc delete <DOC> <START> <END> --dry-run     # preview deletion
gdoc replace <DOC> "find" "replace"           # find & replace all
gdoc replace <DOC> "find" "replace" --ignore-case
```

## Styling
```bash
gdoc style <DOC> <START> <END> [flags]        # text styling (bold, italic, etc.)
gdoc paragraph <DOC> <START> <END> [flags]    # paragraph styling
gdoc bullets <DOC> <START> <END>              # add bullets
gdoc no-bullets <DOC> <START> <END>           # remove bullets
```

## Tables
```bash
gdoc table-insert <DOC> [flags]               # insert table
gdoc table-add-row <DOC> [flags]
gdoc table-add-column <DOC> [flags]
gdoc table-delete-row <DOC> [flags]
gdoc table-delete-column <DOC> [flags]
gdoc table-cell-style <DOC> [flags]
```
