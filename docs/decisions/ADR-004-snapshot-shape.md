# ADR-004: Snapshot Shape

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD (§6.3) defines what a snapshot must include: active state paths, context, status, changed flag, last event metadata, transition metadata, emitted effects, child actor references, and error state. The TRD (§7) adds that adapters use snapshots for all rendering decisions and that `changed` must prevent unnecessary re-renders.

The exact TypeScript shape must be fixed before any adapter can be written, since all six adapters consume this type.

---

## Decision

```ts
type SnapshotStatus = 'idle' | 'active' | 'done' | 'error' | 'stopped'

// Mirrors statechart convention for hierarchical/parallel value representation
type StateValue =
  | string                           // atomic:   'idle'
  | Record<string, StateValue>       // compound/parallel: { player: { playback: 'playing' } }

interface StateGraphSnapshot<
  TContext,
  TEvent extends { type: string } = { type: string },
> {
  /** Actor lifecycle status. */
  status: SnapshotStatus

  /** Current state value. Nested for compound/parallel machines. */
  value: StateValue

  /**
   * Flat set of all active state node IDs (dot-separated paths).
   * Use this for selectors and devtools; parsing `value` is error-prone.
   */
  configuration: ReadonlySet<string>

  /** Extended state. Immutable from the consumer's perspective. */
  context: Readonly<TContext>

  /**
   * False when context and value are reference-equal to the previous snapshot.
   * Adapters use this to skip unnecessary re-renders.
   */
  changed: boolean

  /** The event that caused this snapshot. `@@INIT` for the initial snapshot. */
  event: TEvent | { type: '@@INIT' } | null

  /** Transitions that fired during this step (for devtools and test assertions). */
  transitions: ReadonlyArray<{
    readonly source: string          // state node ID
    readonly target: string | null   // null for targetless transitions
    readonly eventType: string
  }>

  /**
   * Effect invocations scheduled this step, not yet settled.
   * Allows devtools and tests to assert scheduled effects without runtime internals.
   */
  pendingEffects: ReadonlyArray<{
    readonly id: string              // stable per-invocation UUID
    readonly src: string             // effect name from setup()
    readonly input: unknown
  }>

  /** Active child actor handles keyed by invocation ID. */
  children: Readonly<Record<string, ChildActorRef>>

  /** Populated when status === 'error'. Typed unknown because effect rejections may not be Error instances. */
  error: unknown

  /** Trace correlation ID. Populated only when actor.inspect() is active. */
  _traceId: string | undefined
}
```

### Field-by-field rationale

| Field | Rationale |
|---|---|
| `status` | Lifecycle gate — adapters check `status === 'done'` to show completion UI, `status === 'error'` for error boundaries. |
| `value` | Nested object mirrors statechart mental model and matches XState convention, easing migration. |
| `configuration` | Flat set of active IDs — far easier to query than recursively parsing `value`. Selectors and model-check tooling use this. |
| `context` | Immutable reference. The runtime never mutates it in place; `assign()` always produces a new object. |
| `changed` | Computed by the runtime via `Object.is` on `context` + structural equality on `value`. Adapters skip diffing when `changed === false`. |
| `event` | The last dispatched event. `@@INIT` sentinel avoids `null` for the initial snapshot while keeping the union discriminated. |
| `transitions` | Metadata only — not used for rendering, but tested by test generators and shown in devtools. |
| `pendingEffects` | Effects that were scheduled but not yet resolved this step. Required for test assertions (`expect(snapshot.pendingEffects).toContainEqual({ src: 'submitForm' })`). |
| `children` | Child actor refs for hierarchical actor trees. Refs are stable handles, not nested snapshots. |
| `error` | `unknown`, not `Error` — effect promise rejections and guard throws can produce any value. |
| `_traceId` | Prefixed `_` to signal it is infrastructure metadata, not application state. Only present when tracing is enabled. |

---

## Consequences

**Positive:**
- `configuration` makes parallel region selectors O(1) lookups instead of recursive tree walks.
- `changed` flag removes the need for adapter-level memoization heuristics.
- `pendingEffects` on the snapshot enables white-box testing without mocking the effect system.
- `error: unknown` is honest about the type; callers must narrow before using.

**Negative:**
- `value` and `configuration` are redundant — both encode the active state. The runtime must keep them in sync. Documented invariant: `configuration` is always derivable from `value` + the machine definition; `value` is always derivable from `configuration`.
- `_traceId` on every snapshot adds a small memory cost even when inspection is inactive. The runtime sets it to `undefined` in production mode (excluded from JSON serialization).

---

## Alternatives Considered

**A. Only `configuration`, no `value`** — breaks XState migration expectations and makes it harder to pattern-match on simple machines where `value` is just a string.

**B. Nested snapshot for child actors** — embedding child `StateGraphSnapshot` inside the parent creates circular type issues and unbounded serialization depth. Child refs are handles instead.

**C. `changed` computed by adapters** — pushes diffing logic into every framework adapter, creating six diverging implementations. Centralizing it in the runtime ensures consistency.
