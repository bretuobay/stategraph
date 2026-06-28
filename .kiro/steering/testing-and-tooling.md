---
inclusion: fileMatch: ["packages/testing/**", "packages/model-check/**", "packages/inspect/**", "**/*.test.ts", "**/*.spec.ts"]
---

# Testing, Model-Checking, and Tooling Rules

## Test runner

Vitest is the only test runner. All packages use it.
Tests requiring DOM APIs must declare `environment: 'jsdom'` or `'happy-dom'` in the Vitest config — never assume a browser environment in core packages.

## What runtime tests must cover (TRD §10.1)

- Transition priority (multiple candidates for the same event)
- Entry/exit/transition action ordering
- Guarded transitions (enabled and disabled)
- Targetless transitions
- Self transitions
- Parallel region determinism
- History state restoration (shallow and deep)
- Delayed events
- Child actor lifecycle
- Effect request and cancellation
- Trace replay producing the same snapshot sequence

## What adapter conformance tests must cover (TRD §10.3)

The shared conformance suite in `@stategraph/testing` must verify for every adapter:

- Initial snapshot behavior
- Subscription fires on each snapshot change
- Selector equality — no update when selected value is unchanged
- Cleanup stops subscriptions and cancels actor effects
- Event dispatch updates snapshot
- Error propagation (runtime error reaches the adapter)
- SSR behavior (where applicable)

## Model-checker usage (ADR-006)

Structural checks (always on, no bounds):
- Unreachable states
- Dead states (non-final, no outgoing transitions)
- Dead transitions (superseded by higher-priority candidates)
- Invalid targets
- Nondeterministic transitions
- Missing initial declarations

Bounded reachability (opt-in):
```ts
check(machine, {
  bounded: {
    enabled: true,
    maxPathDepth: 100,
    maxStatesExplored: 10_000,
    maxTransitions: 100_000,
    maxCycleLength: 20,
    timeoutMs: 5_000,
  },
})
```

`effectsWithoutCancel` is off by default — enable explicitly when auditing effects.

`ModelCheckResult.stats.hitLimit` must be checked — a `true` value means the analysis was incomplete and results are inconclusive for bounded checks.

## Generated tests (`@stategraph/testing`)

Generated tests must be:
- Deterministic across runs (same machine → same tests).
- Executable by Vitest with no modifications.
- Producing one test case per: each state (coverage), each transition, invalid events (events sent in states that don't handle them), guard branches (enabled vs disabled).

Effect mocking: `@stategraph/testing` provides scaffold factories that produce `fromPromise`/`fromCallback` fakes with controllable resolution.

## Trace schema validation (ADR-005)

`@stategraph/inspect` exports `parseTraceEnvelope(raw: unknown)` using Zod.
All devtools and replay code must call this before consuming a trace. Import only from `@stategraph/inspect`'s public barrel.

## IR completeness tests (TRD §10.2)

IR export tests must assert that the serialized graph includes all states, transitions, guards, action references, effect references, and metadata from the source machine definition. No missing nodes. No undeclared transitions.
