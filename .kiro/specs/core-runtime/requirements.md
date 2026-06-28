# Core Runtime Requirements

## Introduction

This spec defines `@stategraph/core`, the framework-independent runtime and type surface for StateGraph TS. It covers machine authoring, actor execution, statechart semantics, context updates, effects, snapshots, selectors, inspection hooks, and IR export.

## Requirements

### Requirement 1: Typed Serializable DSL

**User story:** As a TypeScript user, I want a serializable machine DSL with strong inference so that my UI protocols can power runtime and tooling.

#### Acceptance Criteria

1. WHEN a user calls `setup()` THEN it SHALL capture guard, action, effect, context, and event types for `.createMachine()`.
2. WHEN a machine definition is authored THEN guard, action, and effect references in the DSL SHALL be serializable string refs or typed ref objects.
3. WHEN a user calls bare `createMachine(definition)` THEN the runtime SHALL create a valid untyped machine with implementations resolved later.
4. WHEN a machine definition is serialized to JSON THEN it SHALL NOT contain executable functions.

### Requirement 2: Actor Lifecycle

**User story:** As an application developer, I want machines to run as actors so that each instance owns its state, queue, effects, children, and subscriptions.

#### Acceptance Criteria

1. WHEN `createActor(machine, options?)` is called THEN it SHALL return an actor with `start`, `stop`, `send`, `getSnapshot`, `subscribe`, `select`, and `inspect` capabilities.
2. WHEN an actor starts THEN it SHALL produce an initial snapshot with `@@INIT` event metadata.
3. WHEN an actor stops THEN it SHALL cancel actor-owned effects and child actors.
4. WHEN an actor receives events before start THEN behavior SHALL be deterministic and documented.

### Requirement 3: Statechart Semantics

**User story:** As a statechart author, I want standard hierarchical and parallel semantics so that complex UI behavior is explicit and scalable.

#### Acceptance Criteria

1. WHEN v1 machines are executed THEN the runtime SHALL support atomic, compound, parallel, initial, final, shallow history, and deep history states.
2. WHEN transitions are selected THEN guarded, targetless, self, delayed, and eventless transitions SHALL be supported.
3. WHEN entry, exit, and transition actions are configured THEN they SHALL run in deterministic order.
4. WHEN parallel regions transition THEN their updates SHALL resolve deterministically.

### Requirement 4: Run-to-Completion and Determinism

**User story:** As a debugger, I want replayable execution so that the same inputs produce the same snapshots.

#### Acceptance Criteria

1. WHEN an external event is processed THEN the runtime SHALL complete all enabled internal work before the next external event starts.
2. WHEN subscribers are notified THEN they SHALL observe only committed, consistent snapshots.
3. WHEN the same machine, initial context, event sequence, and effect results are replayed THEN the same snapshot sequence SHALL be produced.
4. WHEN multiple transition candidates exist THEN priority SHALL be explicit and stable.

### Requirement 5: Context, Actions, and Effects

**User story:** As a maintainer, I want all mutation and side effects to be visible so that behavior can be tested and replayed.

#### Acceptance Criteria

1. WHEN context changes THEN changes SHALL occur only through `assign()`.
2. WHEN `assign()` returns a patch THEN the runtime SHALL shallow-merge the patch into a new immutable context object.
3. WHEN a guard, action, or effect mutates context directly in dev mode THEN the runtime SHALL throw.
4. WHEN effects are requested THEN they SHALL be named, traceable, mockable, and cancellable where possible.
5. WHEN `fromObservable()` is used in MVP THEN it SHALL be a type stub that throws at runtime.

### Requirement 6: Snapshot and Selectors

**User story:** As an adapter author, I want a stable snapshot contract so that framework integrations can render consistently.

#### Acceptance Criteria

1. WHEN a snapshot is produced THEN it SHALL match the ADR-004 `StateGraphSnapshot` shape.
2. WHEN `configuration` and `value` are present THEN they SHALL remain mutually derivable from the machine definition.
3. WHEN `changed` is false THEN adapters MAY skip re-rendering selected values.
4. WHEN `actor.select(selector, listener)` is used THEN listener notification SHALL respect selector equality semantics.

### Requirement 7: Intermediate Representation

**User story:** As a tooling author, I want a serializable IR so that model checking, testing, devtools, and visual tools share one contract.

#### Acceptance Criteria

1. WHEN a machine is created THEN it SHALL be convertible to a serializable IR.
2. WHEN IR is exported THEN it SHALL include state IDs, hierarchy, transitions, event names, guard/action/effect refs, protocol contracts, and metadata.
3. WHEN IR is exported THEN it SHALL NOT contain executable code.
4. WHEN tooling consumes a machine THEN it SHALL use public IR rather than private runtime internals.
