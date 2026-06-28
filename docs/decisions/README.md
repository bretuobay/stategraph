# Architecture Decision Records

This directory contains ADRs for StateGraph TS. Each document records a significant design decision: the context, the decision made, its consequences, and alternatives considered.

ADRs are write-once with status updates. When a decision is superseded, the original document is updated to `Status: Superseded` and a new ADR is written.

## Index

| ADR | Title | Status |
|---|---|---|
| [ADR-001](./ADR-001-object-dsl-shape.md) | Object DSL Shape | Accepted |
| [ADR-002](./ADR-002-builder-api-mvp-or-experimental.md) | Builder API — MVP or Experimental | Accepted |
| [ADR-003](./ADR-003-action-and-effect-registration.md) | Action and Effect Registration Syntax | Accepted |
| [ADR-004](./ADR-004-snapshot-shape.md) | Snapshot Shape | Accepted |
| [ADR-005](./ADR-005-trace-event-schema-versioning.md) | Trace Event Schema Versioning | Accepted |
| [ADR-006](./ADR-006-model-checker-bounds-and-defaults.md) | Model-Checker Bounds and Defaults | Accepted |
| [ADR-007](./ADR-007-package-publishing-strategy.md) | Package Publishing Strategy | Accepted |
| [ADR-008](./ADR-008-esm-vs-dual-cjs.md) | ESM-only vs Dual ESM/CJS per Package | Accepted |
| [ADR-009](./ADR-009-adapter-api-names.md) | Adapter API Names per Framework | Accepted |

## How to propose a new ADR

1. Copy the template below into a new file `ADR-NNN-short-title.md`.
2. Fill in all sections. Leave `Status: Proposed` until the team accepts it.
3. Add a row to the index above.
4. Open a PR; the ADR is accepted when the PR merges.

## Template

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Superseded by ADR-NNN  
**Date:** YYYY-MM-DD  
**Deciders:** ...

---

## Context

Why does this decision need to be made?

## Decision

What was decided, and how does it work?

## Consequences

What are the positive and negative outcomes?

## Alternatives Considered

What else was evaluated and why was it rejected?
```
