# StateGraph TS Product Requirements

## 1. Summary

StateGraph TS is a framework-agnostic TypeScript state management and state machine platform for building explicit, inspectable, testable interaction logic across modern applications.

The product is designed as a direct replacement for XState, with a broader platform vision: a deterministic statechart runtime, strongly typed state-management primitives, adapters for major UI frameworks, devtools, a visual editor, model checking, generated tests, and migration tooling.

The product is grounded in decades of research on state machines in HCI and UI engineering. The core thesis is that industry libraries expose state machines but still leave major research-backed gaps:

- interaction logic is often entangled with presentation logic;
- callbacks and reducers still scatter implicit modes across code;
- parallel UI regions cause state explosion;
- side effects are hard to inspect and replay;
- tests rarely derive from the state model itself;
- modern interfaces need identity-aware and uncertain-input extensions;
- framework integrations often shape semantics instead of adapting to a stable runtime.

StateGraph TS must make interaction state explicit while staying practical for TypeScript teams building React, Vue, Angular, Solid, Svelte, vanilla DOM, and server-side workflows.

## 2. Research Basis

The product requirements draw from the indexed papers in [research-papers/INDEX.md](./research-papers/INDEX.md).

Foundational requirements:

- From Wasserman and Rumbaugh: UI behavior needs formal, executable, understandable models with states, events, transitions, actions, hierarchy, and entry/exit behavior.
- From Carr and Berstel et al.: UI specifications should be executable, composable, verifiable, and independent of layout.
- From HsmTk, SwingStates, and production statechart tooling: interaction behavior should be reusable, separable from graphics, and implementable in production tooling.
- From Belli and Formal H: explicit models should support coverage-driven test generation, model checking, and user-error analysis.
- From Schwarz/Mankoff/Hudson: uncertain input should not be collapsed too early; the runtime should allow probabilistic extensions.
- From IOWAState: identity-aware, multi-user interaction requires user identity as part of the event/state model.
- From interface automata: component compatibility depends on legal interaction protocols, not only type signatures.

## 3. Product Goals

### 3.1 Primary Goals

- Provide a deterministic, framework-independent TypeScript statechart runtime.
- Replace ad hoc state stores, callback chains, and boolean mode flags with explicit state models.
- Support finite, hierarchical, parallel, and history states in v1.
- Provide first-class TypeScript inference for events, context, guards, actions, effects, snapshots, and selectors.
- Separate logical interaction state from visual/render state.
- Make every transition, effect, state entry, state exit, and event dispatch inspectable.
- Provide a stable adapter protocol for React, Vue, Angular, Solid, Svelte, vanilla DOM, and non-UI runtimes.
- Generate useful tests from the model: state coverage, transition coverage, path coverage, and invalid-event scenarios.
- Provide devtools and visual tooling without making them runtime dependencies.

### 3.2 Secondary Goals

- Offer migration paths from XState.
- Use modern TypeScript-first authoring with a JSON-compatible intermediate representation; treat older XML/SCXML workflows only as optional legacy interoperability.
- Support component protocol contracts for event compatibility and composition.
- Allow optional extensions for identity-aware and uncertain-input interaction.
- Support state persistence, trace replay, and time travel.

### 3.3 Non-Goals

- Do not fork runtime semantics per framework.
- Do not require a visual editor to use the runtime.
- Do not require or center XML/SCXML authoring.
- Do not optimize first for distributed consensus or backend workflow orchestration, though the runtime should be usable outside UI.
- Do not hide state transitions behind implicit framework reactivity.
- Do not make side effects execute invisibly or outside the runtime trace.

## 4. Target Users

### 4.1 Primary Users

- Frontend engineers building complex UI workflows.
- Design-system engineers building reusable interactive components.
- Product engineers maintaining form flows, modals, onboarding, checkout, editors, dashboards, and collaborative UI.
- Framework/library authors who need a stable state machine runtime under framework-specific adapters.

### 4.2 Secondary Users

- QA engineers generating tests from state models.
- HCI researchers prototyping interaction patterns.
- Tooling engineers building visual editors, inspectors, and model analyzers.
- Teams migrating from XState, Redux, Zustand, Pinia, NgRx, or ad hoc stores.

## 5. Product Positioning

StateGraph TS is a direct XState replacement with stronger emphasis on:

- TypeScript-first ergonomics rather than machine definitions that need heavy annotation.
- Framework-neutral runtime semantics with thin adapters.
- State management and statecharts in one coherent model.
- Built-in test generation and model analysis.
- Logical/visual state separation as a core design principle.
- Inspectable side effects, traces, and replay.
- Extension points for identity-aware and uncertain-input interaction.

The product should be approachable for simple state management while scaling to advanced statecharts.

## 6. Core Concepts

### 6.1 Machine

A machine is a declarative model of allowed states, events, transitions, guards, actions, effects, services, and child regions.

Machines must be serializable to an internal intermediate representation so tooling can inspect, visualize, validate, and test them.

### 6.2 Actor

An actor is a running instance of a machine.

Actors own:

- current snapshot;
- event queue;
- context;
- effect lifecycle;
- subscriptions;
- child actors;
- trace history when enabled.

### 6.3 Snapshot

A snapshot is an immutable description of the actor after an event is processed.

Snapshots must include:

- active state paths;
- context;
- status;
- changed flag;
- last event metadata;
- transition metadata;
- emitted effects;
- child actor references;
- error state when applicable.

### 6.4 Event

An event is a typed input to a machine.

Events must support:

- discriminated union typing;
- payload typing;
- optional source metadata;
- optional actor/user identity metadata;
- optional timestamp/trace metadata;
- optional confidence metadata for uncertain-input extensions.

### 6.5 Transition

A transition maps an event and current state to a target state, context update, actions, and effects.

Transitions must support:

- target states;
- targetless internal transitions;
- guarded transitions;
- multiple candidate transitions with deterministic priority;
- transition actions;
- generated/internal events;
- metadata for devtools and test generation.

### 6.6 Guard

A guard is a pure predicate that determines whether a transition is enabled.

Guards must be synchronous and side-effect-free in the core runtime.

### 6.7 Action

An action is a synchronous, traceable operation associated with transition, entry, or exit behavior.

Actions may update context only through explicit assignment APIs or return values. They must not mutate context in place.

### 6.8 Effect

An effect is an asynchronous or external operation requested by the runtime.

Effects must be explicit, cancellable where possible, and visible in traces. Effects are executed by the runtime effect system, not directly by arbitrary transition code.

### 6.9 Selector

A selector derives framework-consumable state from snapshots.

Selectors must be memoizable and usable in every adapter.

### 6.10 Protocol Contract

A protocol contract describes which events a machine accepts, emits, and requires from collaborators.

This supports component compatibility analysis inspired by interface automata.

## 7. Runtime Requirements

### 7.1 Determinism

- Given the same machine, initial input, event sequence, and effect results, the actor must produce the same snapshot sequence.
- Transition priority must be explicit and stable.
- Event processing must use run-to-completion semantics.
- Internal/generated events must be processed in a deterministic order.
- Parallel regions must resolve transitions deterministically.

### 7.2 Statechart Semantics

The runtime must support:

- atomic states;
- compound/hierarchical states;
- parallel/orthogonal states;
- final states;
- initial states;
- shallow and deep history states;
- entry actions;
- exit actions;
- transition actions;
- guarded transitions;
- targetless transitions;
- self transitions;
- delayed/timer events;
- invoked services/effects;
- child actors.

### 7.3 Context Management

- Context must be immutable from the consumer perspective.
- Context updates must be explicit and traceable.
- Context updates must be type checked.
- Context may be persisted and restored through a persistence adapter.
- Context must not replace explicit state modeling; documentation must discourage boolean-mode sprawl.

### 7.4 Side Effects

- Effects must be declared, named, and traceable.
- Effects must support cancellation on state exit.
- Effects must be testable with mocks/fakes.
- Effects must be replay-aware: trace replay can skip, mock, or rehydrate effect results.
- Framework adapters must not execute effects independently of the runtime.

### 7.5 Subscriptions

Actors must expose:

- subscribe to full snapshots;
- subscribe through selectors;
- one-time wait-for-state helpers;
- transition/event trace subscribers;
- error subscribers.

Subscriptions must be safe for concurrent framework render cycles.

### 7.6 Error Handling

- Guard/action/effect errors must be represented in trace metadata.
- Machines may define error transitions.
- Unhandled errors must move the actor to an error status unless intercepted.
- Adapter APIs must surface runtime errors idiomatically without changing runtime behavior.

## 8. TypeScript API Requirements

### 8.1 Authoring APIs

StateGraph TS must provide two authoring surfaces:

- object DSL for serializable machine definitions;
- builder API for advanced inference and reusable fragments.

The object DSL is the primary public API.

### 8.2 Required Core API

The core package must expose:

```ts
createMachine(definition)
createActor(machine, options?)
actor.start()
actor.stop()
actor.send(event)
actor.getSnapshot()
actor.subscribe(listener)
actor.select(selector, listener)
actor.inspect(listener)
```

Naming may evolve during implementation, but these capabilities are mandatory.

### 8.3 Type Inference

The API must infer:

- valid event types from machine definitions;
- event payloads by event type;
- context shape;
- state value/state path union where feasible;
- guard/action/effect parameter types;
- selector return types;
- adapter hook return types.

Invalid events should fail at compile time where the actor type is known.

### 8.4 Intermediate Representation

Every machine must be convertible to a serializable graph representation containing:

- state nodes;
- transitions;
- events;
- guards;
- actions;
- effects;
- parallel regions;
- history nodes;
- metadata;
- source locations when available.

This representation powers visual editing, devtools, model checking, and test generation.

## 9. State Management Requirements

StateGraph TS must support common state-store use cases without losing state-machine rigor.

Required capabilities:

- selectors over snapshots and context;
- derived values;
- batched notifications;
- transactions for grouped context updates within one transition;
- persistence hooks;
- hydration;
- time travel;
- trace replay;
- optimistic state transitions with explicit rollback events;
- framework-independent store bindings.

The product must make the distinction clear:

- finite state represents mode and allowed behavior;
- context represents extended data;
- derived state represents computed views;
- render state belongs to framework adapters or application code.

## 10. Adapter Platform Requirements

### 10.1 Adapter Contract

All framework adapters must consume the same actor contract:

```ts
interface StateGraphActor<TSnapshot, TEvent> {
  send(event: TEvent): void;
  getSnapshot(): TSnapshot;
  subscribe(listener: (snapshot: TSnapshot) => void): () => void;
  inspect?(listener: (trace: TraceEvent) => void): () => void;
}
```

Adapters may add idiomatic APIs, but they must not alter runtime semantics.

### 10.2 Official Adapters

The platform must provide official adapters for:

- React;
- Vue;
- Angular;
- Solid;
- Svelte;
- vanilla TypeScript/DOM.

### 10.3 Adapter Requirements

Each adapter must provide:

- actor creation/lifecycle integration;
- snapshot subscription;
- selector subscription;
- send helpers;
- effect lifecycle cleanup;
- SSR-compatible behavior where applicable;
- test utilities.

### 10.4 Framework-Specific Expectations

React adapter:

- hooks for actor creation, snapshots, selectors, and event dispatch;
- compatibility with concurrent rendering;
- no side effects during render.

Vue adapter:

- composables returning reactive snapshot/selector state;
- lifecycle cleanup through Vue hooks.

Angular adapter:

- injectable services;
- observable snapshot streams;
- signal support where available.

Solid adapter:

- signal-based selectors;
- fine-grained reactivity.

Svelte adapter:

- readable/writable store integration;
- component lifecycle cleanup.

Vanilla adapter:

- DOM event binding helpers;
- no framework dependency.

## 11. Tooling Requirements

### 11.1 Devtools Inspector

Devtools must show:

- active states;
- event log;
- transition log;
- guard results;
- actions and effects;
- context diffs;
- child actors;
- parallel regions;
- state history;
- warnings for suspicious model patterns.

Devtools must support pausing, stepping, replaying, exporting, and importing traces.

### 11.2 Visual Editor

The visual editor must support:

- viewing machine graphs;
- editing states and transitions;
- visualizing hierarchy and parallel regions;
- highlighting guarded transitions;
- showing side-effect markers;
- filtering by event;
- exporting to TypeScript object DSL;
- importing from intermediate representation;
- optional legacy SCXML import/export, kept outside the core authoring workflow.

The editor must preserve logical state independently from visual layout metadata.

### 11.3 Model Checker

The model checker must detect:

- unreachable states;
- dead states;
- dead transitions;
- nondeterministic transitions;
- missing initial states;
- invalid targets;
- impossible guards when statically provable;
- unhandled required events;
- event cycles that exceed configured limits;
- effects without cancellation policy where relevant.

### 11.4 Test Generator

The test generator must produce:

- state coverage tests;
- transition coverage tests;
- path coverage tests with configurable depth;
- invalid-event tests;
- guard-branch tests;
- effect mocking scaffolds;
- framework adapter integration tests.

Generated tests must be deterministic and readable.

### 11.5 Migration Tools

Migration tooling must support:

- XState machine analysis;
- best-effort conversion to StateGraph TS object DSL;
- migration reports for unsupported features;
- runtime compatibility notes;
- codemods for common React hook usage where feasible.

## 12. Advanced Extensions

### 12.1 Identity-Aware Interaction

The runtime must allow events to carry identity metadata.

Identity-aware extensions should support:

- per-user state regions;
- identity-aware guards;
- collaborative interaction traces;
- conflict detection;
- ownership transfer patterns;
- multi-user testing scenarios.

This is an extension capability, not a mandatory v1 core feature.

### 12.2 Uncertain Input

The runtime must reserve extension points for probabilistic events and state samples.

Uncertain-input extensions should support:

- confidence-weighted event alternatives;
- multiple possible state samples;
- action/feedback request mediation;
- delayed commitment until ambiguity resolves;
- traceable probability updates.

This is a post-v1 extension, but v1 APIs must not block it.

### 12.3 Protocol Compatibility

Machines should be able to declare accepted and emitted event protocols.

Tooling should analyze:

- whether parent and child machines are compatible;
- whether components emit events no receiver handles;
- whether required events are never produced;
- whether composition introduces illegal event sequences.

## 13. Package Architecture

The platform should use separate packages:

- `@stategraph/core`: runtime, machine definitions, actors, snapshots, selectors.
- `@stategraph/testing`: graph traversal, coverage, generated tests, effect mocks.
- `@stategraph/inspect`: trace protocol and devtools transport.
- `@stategraph/model-check`: static and bounded dynamic model analysis.
- `@stategraph/react`: React adapter.
- `@stategraph/vue`: Vue adapter.
- `@stategraph/angular`: Angular adapter.
- `@stategraph/solid`: Solid adapter.
- `@stategraph/svelte`: Svelte adapter.
- `@stategraph/dom`: vanilla DOM adapter.
- `@stategraph/scxml`: optional legacy SCXML import/export for migration/interoperability only.
- `@stategraph/migrate-xstate`: migration tooling.

The core package must have no framework dependencies.

## 14. MVP Definition

Although the full product is a platform, the first shippable MVP must include:

- core runtime with atomic, hierarchical, parallel, initial, final, and history states;
- typed events/context/guards/actions/effects;
- actor API with snapshots, send, subscribe, select, inspect;
- React adapter;
- vanilla DOM adapter;
- graph introspection;
- basic model checker;
- transition/state coverage test generator;
- trace recording and replay;
- documentation for logical vs visual state separation;
- migration guide from XState for common patterns.

## 15. Post-MVP Roadmap

Phase 2:

- Vue, Solid, Svelte, and Angular adapters;
- devtools browser extension;
- richer model checker;
- persistence/hydration helpers;
- optional legacy SCXML import/export.

Phase 3:

- visual editor;
- XState codemods;
- protocol compatibility analysis;
- identity-aware interaction extension.

Phase 4:

- uncertain-input extension;
- collaborative trace analysis;
- advanced generated test minimization;
- hosted model review/sharing workflow.

## 16. Example Product Scenarios

### 16.1 Modal Dialog

A modal dialog has logical states such as `closed`, `opening`, `open`, `submitting`, and `closing`.

Visual animation states are not the source of truth. The machine controls which interactions are accepted while the dialog is open, submitting, or closing.

Acceptance criteria:

- Escape closes only when allowed.
- Submit is ignored or rejected unless form state is valid.
- Closing cancels pending effects.
- Devtools shows the full event and transition sequence.

### 16.2 Multi-Step Form

A checkout or onboarding flow has finite steps and extended form data.

Acceptance criteria:

- Steps are explicit states.
- Form values live in context.
- Guards control progression.
- Async submission is an effect.
- Generated tests cover all valid transitions and invalid next-step events.

### 16.3 Parallel Media Player

A media player has independent regions for playback, buffering, captions, volume, and fullscreen.

Acceptance criteria:

- Parallel state regions avoid Cartesian state explosion.
- Events can target one region or coordinate across regions.
- Snapshot exposes all active state paths.
- UI adapters can select only the state each component needs.

### 16.4 Identity-Aware Collaboration

A collaborative canvas supports multiple users manipulating objects.

Acceptance criteria:

- Events carry actor/user identity.
- Ownership transfer can be modeled explicitly.
- Trace shows which user caused each transition.
- Protocol analysis identifies events emitted without handlers.

### 16.5 Uncertain Gesture Input

A touch interface receives ambiguous gesture input.

Acceptance criteria:

- Future extension can represent multiple candidate events with confidence.
- Runtime architecture does not require early commitment to one event interpretation.
- Feedback/action mediation can be added without rewriting core adapter APIs.

## 17. Acceptance Criteria

### 17.1 Runtime

- Same event sequence produces same snapshot sequence.
- Entry, exit, and transition actions execute in documented order.
- Parallel states update deterministically.
- Invalid targets fail at machine creation.
- Unhandled events are traceable and do not corrupt state.
- Effects are visible, cancellable, and mockable.

### 17.2 TypeScript

- Events are discriminated and payload-safe.
- Invalid event payloads fail compilation.
- Guards/actions/effects receive typed context and event values.
- Adapter hooks/composables preserve actor and selector types.
- Public APIs emit declaration files without type widening to `any`.

### 17.3 Adapters

- Framework adapters pass the same conformance test suite.
- Adapter lifecycle cleanup stops subscriptions and cancels actor-owned effects where appropriate.
- Adapter selectors prevent unnecessary updates when selected values do not change.
- Adapters do not duplicate runtime transition logic.

### 17.4 Tooling

- Graph export includes all states, transitions, guards, actions, effects, and metadata.
- Model checker reports unreachable states and invalid transitions.
- Test generator produces executable tests for state and transition coverage.
- Trace replay reproduces snapshot sequences under mocked effect results.

### 17.5 Documentation

- Docs explain finite state vs context vs derived state vs render state.
- Docs show migration examples from XState.
- Docs include framework adapter examples.
- Docs include testing/model-checking examples.
- Docs cite research foundations at a practical level.

## 18. Success Metrics

Engineering metrics:

- core runtime below a defined small bundle-size budget;
- no framework dependencies in core;
- complete adapter conformance suite;
- high TypeScript inference coverage in type tests;
- deterministic replay pass rate;
- generated tests cover all declared transitions in sample machines.

Adoption metrics:

- successful migration of representative XState examples;
- working examples for React, Vue, Angular, Solid, Svelte, and vanilla DOM;
- reduction in hand-written UI transition tests for sample apps;
- positive developer feedback on type ergonomics and debugging clarity.

Research-alignment metrics:

- hierarchy reduces duplicated transition definitions in examples;
- parallel regions reduce modeled states compared with flat machines;
- devtools makes side effects and mode changes inspectable;
- test generation catches invalid or unreachable UI behavior in examples.

## 19. Open Design Questions

These must be resolved during technical design, not by product consumers:

- exact naming of `createActor` vs `interpret` vs `spawn`;
- exact object DSL syntax;
- depth and limits of compile-time state path inference;
- trace format versioning;
- model-checking algorithm limits for large/infinite context spaces;
- compatibility scope with XState semantics;
- whether builder API ships in MVP or as experimental.

## 20. Documentation Requirements

Initial documentation must include:

- Why state machines for UI state management.
- Finite states vs context vs derived state.
- Logical state vs visual state.
- Hierarchy and parallel states.
- Effects and cancellation.
- Framework adapter guides.
- Testing from models.
- Model checker guide.
- XState migration guide.
- Research notes summarizing the HCI basis.

## 21. Glossary

- **Finite state:** A named mode that changes which events are valid and what they mean.
- **Context:** Extended data associated with an actor.
- **Snapshot:** Immutable current runtime view of state, context, status, and metadata.
- **Actor:** Running machine instance.
- **Guard:** Pure predicate that enables or blocks a transition.
- **Action:** Synchronous operation associated with transition/entry/exit behavior.
- **Effect:** External or asynchronous operation requested by the runtime.
- **Parallel state:** Statechart region where multiple child states are active simultaneously.
- **History state:** Pseudostate that remembers the last active child state.
- **Selector:** Function deriving a render-friendly value from a snapshot.
- **Trace:** Ordered record of events, transitions, actions, effects, and snapshots.
- **Protocol contract:** Declaration of accepted, emitted, and required events for compatibility analysis.
