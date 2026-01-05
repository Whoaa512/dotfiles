# Orchestration Examples

## Review a PR

**User:** "Review PR #123"

**Orchestration:**
```python
# Fan-out: parallel analysis
Task(subagent_type="Explore", prompt="Get PR #123 details...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Review code quality...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Review security...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Review performance...", run_in_background=True)
```

**User sees:**
```
Reviewing PR #123...

## Summary
Adds user profile editing with image upload.

## Risk Assessment
- Security: Medium (file upload needs validation)
- Performance: Low

## Must Fix
1. Missing file type validation in upload handler (line 47)

## Looks Good
- Clean component structure
- Good error handling
```

---

## Implement a Feature

**User:** "Add dark mode to the app"

**Orchestration:**
```python
# Pipeline: research → plan
Task(subagent_type="Explore", prompt="Find styling patterns...", run_in_background=True)
# wait...
Task(subagent_type="Plan", prompt=f"Design dark mode given: {context}", run_in_background=True)

# Fan-out: parallel implementation
Task(subagent_type="general-purpose", prompt="Add CSS variables...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Create toggle component...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Add localStorage persistence...", run_in_background=True)

# Pipeline: integrate
Task(subagent_type="general-purpose", prompt="Wire components, test...", run_in_background=True)
```

**User sees:**
```
Adding dark mode.

Exploring styling patterns... Found Tailwind with CSS variables.

Plan:
1. Add CSS variables for dark theme
2. Create theme toggle component
3. Persist preference in localStorage

Implementing...

Done! Dark mode ready:
- Toggle in header (components/theme-toggle.tsx)
- Preference saved to localStorage
- System preference detected on first visit
```

---

## Fix a Bug

**User:** "Users can't log in after password reset"

**Orchestration:**
```python
# Fan-out: parallel diagnosis
Task(subagent_type="Explore", prompt="Search logs for login errors...", run_in_background=True)
Task(subagent_type="Explore", prompt="Trace password reset flow...", run_in_background=True)
Task(subagent_type="Explore", prompt="Check session handling after password change...", run_in_background=True)

# Synthesize findings → identify root cause

# Pipeline: fix and verify
Task(subagent_type="general-purpose", prompt="Clear session cookie after password reset...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Add regression test...", run_in_background=True)
```

**User sees:**
```
Investigating login issue after password reset...

Found: Password reset invalidates session token but old cookie remains.
On next login, invalid cookie causes auth to fail.

Fix: Clear session cookie when password is reset.

Fixed in auth/password-reset.ts (line 89).
Added regression test in __tests__/auth.test.ts.
```

---

## Understand a Codebase

**User:** "Help me understand this codebase"

**Orchestration:**
```python
# Fan-out: parallel exploration
Task(subagent_type="Explore", prompt="Analyze structure, entry points, build...", run_in_background=True)
Task(subagent_type="Explore", prompt="Identify patterns, frameworks...", run_in_background=True)
Task(subagent_type="Explore", prompt="Trace data flows, API, state...", run_in_background=True)
```

**User sees:**
```
## Overview
Next.js 14 with TypeScript, App Router.

## Structure
src/
├── app/        # Routes and pages
├── components/ # React components (shadcn/ui)
├── lib/        # Utilities
├── services/   # API clients, business logic
└── types/      # TypeScript types

## Key Patterns
- Data fetching: Server components with async/await
- State: React Context for auth, Zustand for UI
- Styling: Tailwind + shadcn/ui
- API: REST in app/api/, Prisma for database

Want me to dive deeper into any area?
```

---

## Run Tests and Fix Failures

**User:** "Run tests and fix any failures"

**Orchestration:**
```python
# Background: run tests
Task(subagent_type="general-purpose", prompt="Run full test suite...", run_in_background=True)
# wait for results...

# Fan-out: parallel fixes (if multiple failures)
Task(subagent_type="general-purpose", prompt="Fix auth.test.ts...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Fix api.test.ts...", run_in_background=True)
Task(subagent_type="general-purpose", prompt="Fix utils.test.ts...", run_in_background=True)

# Verify
Task(subagent_type="general-purpose", prompt="Re-run test suite...", run_in_background=True)
```

**User sees:**
```
Running tests...

Results: 47 passed, 3 failed

Failures:
1. auth.test.ts - "should reject expired tokens"
2. api.test.ts - "should handle rate limiting"
3. utils.test.ts - "should format dates correctly"

Fixing...

Fixed all 3:
1. auth.test.ts - Updated mock token expiry
2. api.test.ts - Added missing rate limit header
3. utils.test.ts - Fixed timezone handling

Re-running... All 50 tests passing.
```

---

## Pattern Summary

| Scenario | Pattern | Why |
|----------|---------|-----|
| PR Review | Fan-Out → Reduce | Parallel analysis, unified output |
| Feature | Pipeline → Fan-Out → Pipeline | Research, parallel build, integrate |
| Bug Fix | Fan-Out → Pipeline | Parallel diagnosis, sequential fix |
| Exploration | Fan-Out → Reduce | Parallel discovery, synthesize |
| Tests | Background → Fan-Out | Long-running, parallel fixes |
