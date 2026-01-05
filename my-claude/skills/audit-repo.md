---
name: audit-repo
description: Security audit for unfamiliar repos/directories before running code
---

# Audit Repo

Scan unfamiliar codebases for suspicious patterns before running.

## When to Use

- Cloned new repo you don't trust
- Reviewing third-party code
- Before running `npm install`, `pip install`, etc.
- Checking if dependencies are safe

## Usage

```
/audit-repo [path]
```

If no path given, uses current directory.

## What It Checks

### Prompt Injection (AI Safety)
- "ignore previous instructions" patterns
- Role manipulation ("you are now", "act as")
- System prompt escaping (`<|im_start|>`, `[SYSTEM]`)
- Hidden unicode (zero-width chars)
- Base64-encoded injection payloads

### High Risk (Block)
- Obfuscated code (base64 payloads, hex-encoded strings)
- Reverse shells, data exfil patterns
- Crypto mining signatures
- Known malicious package names
- Hardcoded credentials/API keys
- Install scripts with network calls

### Medium Risk (Warn)
- `eval()`, `exec()`, `Function()` usage
- Dynamic code loading
- Suspicious npm postinstall/preinstall scripts
- Network calls to unusual endpoints
- File system writes outside project

### Info
- External dependencies count
- Network permissions requested
- Privileged operations

## Scripts

```bash
# Prompt injection scanner (recommended first step)
bun run ~/.claude/skills/audit-repo/scan-injections.ts [path]

# Exit codes: 0=clean, 1=medium risk, 2=high risk
```

## Commands

```bash
# Quick scan - high risk only
rg -l 'eval\(|exec\(|Function\(' --type-add 'code:*.{js,ts,py,rb,sh}' -t code

# Base64 blobs (potential payloads)
rg '[A-Za-z0-9+/]{50,}={0,2}' --type-add 'code:*.{js,ts,py,rb}' -t code

# Hardcoded secrets
rg -i '(api[_-]?key|password|secret|token)\s*[=:]\s*["\x27][^"\x27]{8,}'

# Reverse shell patterns
rg -i 'bash -i|/dev/tcp|nc -e|python.*socket.*connect'

# Crypto miners
rg -i 'stratum\+|cryptonight|coinhive|minero'

# Suspicious npm scripts
jq '.scripts | to_entries[] | select(.key | test("pre|post")) | "\(.key): \(.value)"' package.json 2>/dev/null

# Python setup.py dangers
rg 'cmdclass|download_url|subprocess|os\.system' setup.py 2>/dev/null

# Check for typosquatting (common packages)
# lodash → 1odash, requests → reqeusts, etc.
```

## Workflow

1. Run high-risk scans first
2. Check package.json/setup.py/Cargo.toml scripts
3. Review any flagged files manually
4. Check dependency versions against known vulns
5. Only then run install commands
