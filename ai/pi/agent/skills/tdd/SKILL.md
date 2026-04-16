---
name: tdd
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## Philosophy

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** exercise real code paths through public APIs. They read like specs — "user can checkout with valid cart" tells you exactly what capability exists. They survive refactors.

**Bad tests** mock internal collaborators, test private methods, or verify through external means. Warning sign: test breaks on refactor but behavior hasn't changed.

See [tests.md](tests.md), [mocking.md](mocking.md), [interface-design.md](interface-design.md) for details.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This produces tests that test _imagined_ behavior, not _actual_ behavior.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  ...
```

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm interface changes needed
- [ ] Confirm which behaviors to test (prioritize — you can't test everything)
- [ ] Identify opportunities for [deep modules](deep-modules.md)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] Get user approval on the plan

### 2. Tracer Bullet

ONE test that confirms ONE thing. Proves the path works end-to-end.

```
RED:   Write test → fails
GREEN: Minimal code → passes
```

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code → passes
```

Rules: one test at a time, only enough code to pass, don't anticipate future tests.

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules
- [ ] Apply SOLID where natural
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```
