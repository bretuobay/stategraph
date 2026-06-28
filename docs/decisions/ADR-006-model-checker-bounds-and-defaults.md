# ADR-006: Model-Checker Bounds and Defaults

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD (§11.3) requires the model checker to detect unreachable states, dead states, dead transitions, nondeterminism, missing initial states, invalid targets, impossible guards, unhandled events, cycles beyond configured limits, and effects without cancellation policy.

The fundamental challenge is that statechart context can be unbounded (arbitrary strings, numbers, arrays). Full model checking over unbounded context is undecidable. The checker must provide practical guarantees without requiring formal abstract interpretation.

---

## Decision

### Two tiers of analysis

**Tier 1 — Structural (static graph analysis)**  
Operates on the machine definition graph only, ignoring context values. Always runs. Fast: O(V + E) on the state/transition graph.

**Tier 2 — Bounded reachability (dynamic BFS/DFS)**  
Explores the state space under concrete or abstracted context. Opt-in. Can be expensive for large machines or wide context.

---

### Default configuration

```ts
interface ModelCheckConfig {
  checks: {
    /** Tier 1: states with no incoming transitions (excluding initial). */
    unreachableStates: boolean        // default: true

    /** Tier 1: non-final states with no outgoing transitions. */
    deadStates: boolean               // default: true

    /** Tier 1: transitions that can never fire (always superseded by higher-priority transitions). */
    deadTransitions: boolean          // default: true

    /** Tier 1: transitions with non-existent target state IDs. */
    invalidTargets: boolean           // default: true

    /** Tier 1: two or more transitions on the same event from the same state with no guard priority difference. */
    nondeterminism: boolean           // default: true

    /** Tier 1: compound/parallel states missing an `initial` declaration. */
    missingInitial: boolean           // default: true

    /**
     * Tier 1: invoked effects with no onDone/onError or explicit cancellation policy.
     * Off by default — fire-and-forget effects are intentional in many designs.
     */
    effectsWithoutCancel: boolean     // default: false
  }

  bounded?: {
    enabled: boolean                  // default: false
    /** Max event sequence length for reachability exploration. */
    maxPathDepth: number              // default: 100
    /** Max unique state configurations explored before giving up. */
    maxStatesExplored: number         // default: 10_000
    /** Max transitions evaluated across all paths. */
    maxTransitions: number            // default: 100_000
    /** Max cycle length before flagging a potential infinite loop. */
    maxCycleLength: number            // default: 20
    /** Wall-clock timeout for the entire analysis run. */
    timeoutMs: number                 // default: 5_000
  }
}
```

All `checks` flags default to the values above when omitted. Partial config objects are merged with defaults:

```ts
check(machine)                         // all Tier 1 defaults
check(machine, { checks: { effectsWithoutCancel: true } })  // Tier 1 + effect check
check(machine, { bounded: { enabled: true } })              // Tier 1 + Tier 2 defaults
```

---

### Outputs

```ts
interface ModelCheckResult {
  passed: boolean
  diagnostics: ModelCheckDiagnostic[]
  stats: {
    statesAnalyzed: number
    transitionsAnalyzed: number
    durationMs: number
    bounded: boolean
    hitLimit: boolean    // true if bounded analysis was cut short
  }
}

interface ModelCheckDiagnostic {
  severity: 'error' | 'warning'
  code: string              // e.g. 'UNREACHABLE_STATE', 'NONDETERMINISTIC_TRANSITION'
  message: string
  stateId?: string
  transitionSource?: string
  transitionEvent?: string
}
```

`severity: 'error'` blocks a clean CI pass. `severity: 'warning'` is informational (e.g., `effectsWithoutCancel`).

---

### CLI

```sh
stategraph check <machine-file>                     # Tier 1 defaults
stategraph check <machine-file> --bounded           # Tier 1 + Tier 2 defaults
stategraph check <machine-file> --depth 50 --states 5000
stategraph check <machine-file> --no-dead-states    # disable one check
```

---

## Consequences

**Positive:**
- Tier 1 structural checks catch the most common authoring mistakes (typos in target IDs, missing initial states) with zero false positives and negligible runtime cost.
- Opt-in bounded analysis prevents performance surprises in CI for large machines.
- `hitLimit: true` in the result makes it transparent when analysis was incomplete, rather than falsely reporting clean.

**Negative:**
- Structural analysis cannot catch guards that are logically impossible (e.g., `context.count > 100 && context.count < 0`) without abstract interpretation. The PRD accepts this limitation; documentation must note it.
- Bounded analysis with default limits may still time out on machines with large fan-out. Users must tune limits per machine.

---

## Alternatives Considered

**A. Always run bounded analysis** — prohibitively slow for machines with any unbounded context variable (strings, arrays). Would make the checker unusable as a default CI step.

**B. Abstract interpretation with symbolic context** — correct but requires a constraint solver (Z3 or similar) as a dependency. Out of scope for MVP; could be a post-MVP research extension.

**C. Single `maxDepth` parameter** — insufficient; path depth, state count, and transitions are independent axes. A machine with depth 10 can still have millions of configurations via parallel regions.
