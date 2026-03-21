---
description: Pre-ship readiness checklist — tests, docs, flags, telemetry, error handling
---
Check if the current branch/stack is ready to ship: $@

## Checklist Scan

For each item, check the diff and report ✅ (present) or ❌ (missing/incomplete):

### Code Quality
- [ ] Tests exist for new/changed behavior
- [ ] Tests actually test meaningful behavior (not just padding coverage)
- [ ] No TODOs or FIXMEs left unresolved
- [ ] No dead code or commented-out blocks

### Production Readiness
- [ ] Error handling — are errors caught, logged, and surfaced appropriately?
- [ ] Telemetry/metrics — new behavior has observability (statsd, logging, etc.)
- [ ] Sentry/error tracking — exceptions captured where needed
- [ ] Feature flags — risky changes gated behind flags for gradual rollout
- [ ] Config — any new config values have sensible defaults

### Documentation
- [ ] Docs updated if behavior changed (README, internal docs, inline docs)
- [ ] Plan docs (@docs/) match implementation — nothing promised but unbuilt
- [ ] PR description explains the why

### Deploy Safety
- [ ] No breaking changes without migration path
- [ ] Rollback plan exists (or change is trivially revertible)
- [ ] CI passes

## Output

```
Ready to ship? YES / NOT YET

✅ 8/12 checks passing
❌ Missing:
  - No telemetry for new verify_issues endpoint
  - Feature flag not wired up for rescue_pass
  - _infra/docs/customization-files.md not updated
```

If NOT YET, ask "intme for what to fix" and then fix.
