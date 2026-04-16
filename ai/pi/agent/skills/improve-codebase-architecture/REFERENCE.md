# Reference

## Dependency Categories

When assessing a candidate for deepening, classify its dependencies:

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — just merge the modules and test directly.

### 2. Local-substitutable

Dependencies that have local test stand-ins (e.g., PGLite for Postgres, in-memory filesystem). Deepenable if the test substitute exists. Test with the local stand-in.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary. Define a port (interface) at the module boundary. The deep module owns the logic; transport is injected. Tests use an in-memory adapter. Production uses the real adapter.

### 4. True external (Mock)

Third-party services you don't control. Mock at the boundary. The deepened module takes the external dependency as an injected port.

## Testing Strategy

Core principle: **replace, don't layer.**

- Old unit tests on shallow modules are waste once boundary tests exist — delete them
- Write new tests at the deepened module's interface boundary
- Tests assert on observable outcomes through the public interface, not internal state
- Tests should survive internal refactors

## Proposal Template

```markdown
# Architecture Improvement: <Name>

## Problem

- Which modules are shallow and tightly coupled
- What integration risk exists in the seams
- Why this makes the codebase harder to maintain

## Proposed Interface

- Interface signature (types, methods, params)
- Usage example showing how callers use it
- What complexity it hides internally

## Dependency Strategy

Which category applies and how dependencies are handled.

## Testing Strategy

- New boundary tests to write
- Old tests to delete
- Test environment needs

## Implementation Recommendations

Durable guidance NOT coupled to current file paths:
- What the module should own
- What it should hide
- What it should expose
- How callers should migrate
```
