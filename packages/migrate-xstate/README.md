# @stategraph/migrate-xstate

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

XState → StateGraph migration tooling. Will provide codemods and a compatibility shim to help teams migrate from XState v4 or v5 to StateGraph TS incrementally.

## Planned scope

- **Codemods** — AST transforms (via jscodeshift or ts-morph) to convert:
  - `createMachine(...)` → `setup(...).createMachine(...)`
  - Inline guard/action/service functions → string references + `setup()` implementations
  - `interpret(machine)` → `createActor(machine)`
  - `service.onTransition(...)` → `actor.subscribe(...)`
- **API mapping reference** — documented equivalents for XState concepts

## Key differences from XState

| XState | StateGraph TS |
|---|---|
| `createMachine({ guards: {...} })` | `setup({ guards: {...} }).createMachine(definition)` |
| Inline guard/action functions in definition | String references only; implementations in `setup()` |
| `interpret(machine)` | `createActor(machine)` |
| `service.send(event)` | `actor.send(event)` |
| `service.onTransition(fn)` | `actor.subscribe(fn)` |
| `service.state` | `actor.getSnapshot()` |
| `state.matches("name")` | `snap.configuration.has("machine.name")` |
| `state.value` as nested object | Same — `snap.value` is `string \| Record<string, StateValue>` |

## Status

Stub package. Not installable from the registry. Watch the repository for the migration tooling milestone.
