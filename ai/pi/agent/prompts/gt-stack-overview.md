---
description: Show overview of current graphite stack with PR status
---
Show an overview of the current graphite stack: $@

```bash
gt log short --stack --no-interactive
```

For each branch in the stack, show:
- PR number, title, status (draft/ready/merged)
- Review status
- CI status
- Key changes summary
