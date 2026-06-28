---
inclusion: always
---

# StateGraph TS — Project Overview

StateGraph TS is a TypeScript-first statechart runtime and state-management platform.
It provides a deterministic, framework-agnostic runtime for explicit, inspectable interaction state.

## What it is not
- Not a fork of XState (migration-friendly alternative, not a drop-in replacement).
- Not a framework (adapters wrap a stable core runtime; they do not shape semantics).
- Not a visual-editor-first tool (runtime works without any tooling).

## Full specifications
Read these before implementing anything significant:

| Document | Purpose |
|---|---|
| `PRODUCT_REQUIREMENTS.md` | Goals, user stories, core concepts, acceptance criteria |
| `TECHNICAL_REQUIREMENTS.md` | Monorepo layout, toolchain, package contracts, runtime semantics |
| `docs/decisions/ADR-001` | Object DSL shape |
| `docs/decisions/ADR-002` | Builder API scope |
| `docs/decisions/ADR-003` | Action and effect registration |
| `docs/decisions/ADR-004` | Snapshot shape |
| `docs/decisions/ADR-005` | Trace event schema versioning |
| `docs/decisions/ADR-006` | Model-checker bounds and defaults |
| `docs/decisions/ADR-007` | Package publishing strategy |
| `docs/decisions/ADR-008` | ESM vs dual CJS |
| `docs/decisions/ADR-009` | Adapter API names per framework |

## Monorepo structure

```
apps/            → docs, playground, devtools (Vite apps)
packages/        → core, testing, inspect, model-check, react, vue, angular, solid, svelte, dom, scxml, migrate-xstate
packages/config-* → shared ESLint, TypeScript, Vitest config
examples/        → runnable examples consuming workspace packages
```

Toolchain: TypeScript (strict), tsup (library builds), Vite (apps), Vitest (tests), ESLint + Prettier, Turborepo, changesets.
