# ADR-005: Trace Event Schema Versioning

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The trace system is consumed by the devtools browser extension, the replay engine, model-check integration, and external tooling (trace export/import). Schema mismatches between a running app and an older devtools version — or between a saved trace file and the current parser — must be caught explicitly rather than silently producing corrupted output.

The TRD (§5.3) places trace schema ownership in `@stategraph/inspect`. The runtime emits events; the inspect package defines their shape.

---

## Decision

### Envelope

Every exported trace is wrapped in a typed envelope:

```ts
interface TraceEnvelope {
  schemaVersion: string       // 'MAJOR.MINOR', e.g. '1.0'
  sessionId: string           // UUIDv4, unique per actor lifetime
  machineId: string
  actorId: string
  createdAt: number           // Unix timestamp in milliseconds
  events: TraceEvent[]
}
```

`schemaVersion` uses `MAJOR.MINOR` only (no patch). It is a string rather than a numeric tuple to be JSON-friendly and to allow string comparison for compatibility checks.

### Trace event union

All trace events extend a common base and are discriminated by `type`:

```ts
interface BaseTrace {
  seq: number          // monotonically increasing within the session; used for replay ordering
  ts: number           // ms since session start (or Unix ms — adapter choice, documented in envelope)
  actorId: string
}

type TraceEvent =
  | (BaseTrace & { type: '@actor.started';    snapshot: unknown })
  | (BaseTrace & { type: '@actor.stopped' })
  | (BaseTrace & { type: '@event.received';   event: unknown })
  | (BaseTrace & { type: '@transition.fired'; source: string; target: string | null; eventType: string; guardResults: Record<string, boolean> })
  | (BaseTrace & { type: '@action.executed';  actionType: string; params: unknown })
  | (BaseTrace & { type: '@effect.started';   effectId: string; src: string; input: unknown })
  | (BaseTrace & { type: '@effect.done';      effectId: string; output: unknown })
  | (BaseTrace & { type: '@effect.error';     effectId: string; error: unknown })
  | (BaseTrace & { type: '@effect.cancelled'; effectId: string })
  | (BaseTrace & { type: '@context.updated';  patch: unknown })
  | (BaseTrace & { type: '@error';            error: unknown })
```

Event type strings use the `@namespace.verb` pattern to avoid collision with user-defined event types. The `@` prefix is reserved and must not be used in machine event definitions.

### Versioning rules

| Change | Version bump |
|---|---|
| Remove a field | MAJOR |
| Rename a `type` discriminant | MAJOR |
| Change the TypeScript type of an existing field | MAJOR |
| Add an optional field to an existing event | MINOR |
| Add a new event kind to the union | MINOR |
| Add a field to `TraceEnvelope` | MINOR |

### Validation

`@stategraph/inspect` owns a Zod schema for each supported `MAJOR` version:

```ts
// packages/inspect/src/schemas/v1.ts
export const traceEnvelopeV1 = z.object({
  schemaVersion: z.string().startsWith('1.'),
  sessionId: z.string().uuid(),
  machineId: z.string(),
  actorId: z.string(),
  createdAt: z.number(),
  events: z.array(traceEventV1),
})

// Public parse entry point
export function parseTraceEnvelope(raw: unknown): TraceEnvelope {
  const version = (raw as any)?.schemaVersion ?? ''
  const major = version.split('.')[0]
  if (major === '1') return traceEnvelopeV1.parse(raw)
  throw new UnsupportedSchemaVersionError(version)
}
```

Devtools and replay must call `parseTraceEnvelope` before consuming any trace. Mismatched MAJOR versions throw; old MINOR versions with missing optional fields are tolerated via Zod's `.optional()`.

### Retention policy

`@stategraph/inspect` maintains parsers for the current MAJOR and the immediately preceding MAJOR (N-1). Older versions are removed with a deprecation notice at least one major version in advance.

---

## Consequences

**Positive:**
- Explicit version rejection prevents silent data corruption in devtools and replay.
- Zod schemas serve as both runtime validators and documentation of the event shape.
- `seq` field enables correct replay ordering even when wall-clock timestamps have drift.
- Keeping parsers for N-1 MAJOR versions gives users a migration window.

**Negative:**
- Maintaining two MAJOR version parsers adds a small ongoing cost.
- `unknown` payload fields (`event`, `output`, `error`, `patch`) require callers to re-validate downstream. Using `unknown` is intentional — the trace system should not constrain machine-specific types.

---

## Alternatives Considered

**A. Numeric version field (`version: 1`)** — simpler, but a MINOR/MAJOR distinction requires two fields or a convention like `[major, minor]`. String is more expressive and JSON-friendly.

**B. No explicit versioning** — works until the first field change, then produces silent corruption. Unacceptable for an inspection and replay system.

**C. Full semver (`'1.0.0'`)** — patch level is irrelevant to schema compatibility; `MAJOR.MINOR` is sufficient and shorter.
