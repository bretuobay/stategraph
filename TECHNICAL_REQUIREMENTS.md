# StateGraph TS Technical Requirements

## 1. Purpose

This document translates the product requirements in [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) into implementation-level requirements for the StateGraph TS codebase.

StateGraph TS must be built as a TypeScript-first monorepo using Turborepo, Vite, Vitest, tsup, ESLint, and Prettier. The architecture must keep the core runtime framework-independent, deterministic, testable, and suitable for tooling such as devtools, model checking, generated tests, visual editing, and migration assistance.

## 2. Technical Principles

- The core runtime must have no framework dependencies.
- Runtime semantics must be stable across all adapters.
- Statechart execution must be deterministic and replayable.
- Effects must be explicit runtime requests, not hidden callback side effects.
- Public APIs must be strongly typed without requiring consumers to annotate every event and context type manually.
- Tooling must consume a serializable intermediate representation rather than private runtime internals.
- Packages must communicate through public barrel exports only.
- Migration from XState must be supported through guides, reports, and optional tooling, but the project must not promise drop-in XState API compatibility.

## 3. Monorepo Requirements

### 3.1 Workspace Layout

The repository must use a Turborepo workspace with this structure:

```txt
apps/
  docs/
  playground/
  devtools/
packages/
  core/
  testing/
  inspect/
  model-check/
  react/
  vue/
  angular/
  solid/
  svelte/
  dom/
  scxml/
  migrate-xstate/
  config-eslint/
  config-typescript/
  config-vitest/
examples/
  react-modal/
  react-form/
  dom-player/
```

Apps are product shells and integration surfaces. Packages own reusable runtime, tooling, adapters, and shared configuration.

### 3.2 Package Boundaries

- `apps/*` may depend on `packages/*`.
- Runtime/tooling packages may depend on `@stategraph/core` and shared config packages.
- Framework adapters may depend on `@stategraph/core` and their framework peer dependency.
- `@stategraph/core` must not depend on any adapter, app, DOM API, browser global, test framework, or visualization package.
- Packages must not import from app code.
- Packages must not deep-import private files from another package.

### 3.3 Root Scripts

The root `package.json` must expose Turbo-backed scripts:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "lint": "turbo run lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check-types": "turbo run check-types",
    "clean": "turbo run clean"
  }
}
```

Focused iteration must use Turbo filters, for example:

```sh
turbo run test --filter=@stategraph/core
turbo run build --filter=@stategraph/react
```

## 4. Toolchain Requirements

### 4.1 TypeScript

- Use strict TypeScript across all packages.
- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` unless a package documents a specific exception.
- Emit declaration files for all published packages.
- Public APIs must avoid `any`; use `unknown`, generics, branded types, or narrowed internal types where appropriate.
- Type-level behavior must be tested with compile-time tests.

### 4.2 tsup

Library packages must build with `tsup`.

Each published package must emit:

- ESM output;
- CommonJS output where needed for ecosystem compatibility;
- `.d.ts` declaration files;
- sourcemaps;
- tree-shakeable modules.

Package builds must not bundle peer dependencies such as React, Vue, Angular, Solid, or Svelte.

### 4.3 Vite

Vite must be used for browser-facing apps and examples:

- `apps/docs`;
- `apps/playground`;
- `apps/devtools`;
- framework examples where applicable.

Vite apps must consume packages through workspace dependencies, not copied source.

### 4.4 Vitest

Vitest is the standard unit, integration, and conformance test runner.

Required test groups:

- runtime semantics tests;
- type inference tests;
- graph/IR tests;
- model-checker tests;
- generated-test output tests;
- adapter conformance tests;
- migration fixture tests.

Tests that depend on browser APIs must use an explicit browser-like environment such as `jsdom` or `happy-dom`.

### 4.5 ESLint and Prettier

- ESLint must enforce TypeScript correctness, import boundaries, unused code, and package dependency hygiene.
- Prettier must be the single formatting authority.
- Formatting rules must not be duplicated in ESLint.
- Shared lint and formatting config should live in `packages/config-eslint` and root Prettier config.

## 5. Package Requirements

### 5.1 `@stategraph/core`

The core package owns:

- machine definition types;
- machine creation and validation;
- actor runtime;
- event queue;
- transition selection;
- context update mechanism;
- action execution;
- effect request scheduling;
- snapshot creation;
- selector subscriptions;
- trace emission;
- graph intermediate representation.

Required public capabilities:

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

Exact names may change during API design, but these capabilities must exist.

### 5.2 `@stategraph/testing`

The testing package owns:

- graph traversal utilities;
- state coverage generation;
- transition coverage generation;
- bounded path generation;
- invalid-event test generation;
- guard-branch test generation;
- effect mock scaffolding;
- adapter test harness helpers.

Generated tests must be deterministic, readable, and executable by Vitest.

### 5.3 `@stategraph/inspect`

The inspect package owns:

- trace event schema;
- inspector transport protocol;
- trace serialization;
- trace import/export helpers;
- devtools bridge APIs.

It must not depend on a specific browser extension runtime.

### 5.4 `@stategraph/model-check`

The model-check package owns static and bounded dynamic analysis:

- unreachable states;
- dead states;
- dead transitions;
- invalid targets;
- nondeterministic transitions;
- missing initial states;
- unhandled required events;
- cycles exceeding configured bounds;
- effects missing cancellation policy.

The package must consume the public machine graph/IR from `@stategraph/core`.

### 5.5 Framework Adapters

Official adapter packages:

- `@stategraph/react`;
- `@stategraph/vue`;
- `@stategraph/angular`;
- `@stategraph/solid`;
- `@stategraph/svelte`;
- `@stategraph/dom`.

Each adapter must:

- consume the same actor contract from `@stategraph/core`;
- provide lifecycle-safe actor creation;
- expose snapshot and selector subscriptions;
- provide idiomatic event dispatch helpers;
- clean up subscriptions and actor-owned effects;
- pass a shared adapter conformance suite.

Adapters may expose framework-specific APIs, but must not alter core runtime semantics.

### 5.6 `@stategraph/scxml`

The SCXML package is optional legacy interoperability tooling.

It must:

- import supported SCXML structures into StateGraph TS IR or object DSL;
- export supported machines to SCXML where possible;
- report unsupported constructs explicitly;
- remain outside the core runtime dependency graph.

### 5.7 `@stategraph/migrate-xstate`

The XState migration package must support:

- analysis of common XState machine definitions;
- best-effort conversion to StateGraph TS object DSL;
- migration reports;
- unsupported-feature diagnostics;
- fixture-based regression tests.

This package must not imply drop-in API compatibility.

## 6. Runtime Semantics Requirements

### 6.1 Determinism

Given the same machine, initial context, event sequence, and effect results, the runtime must produce the same snapshot sequence.

The implementation must define stable ordering for:

- external events;
- internal/generated events;
- transition priority;
- entry actions;
- exit actions;
- transition actions;
- parallel region updates;
- effect request emission.

### 6.2 Run-to-Completion

Event processing must use run-to-completion semantics:

- one external event is processed at a time;
- all enabled internal transitions for that event complete before the next external event starts;
- subscribers observe consistent snapshots only;
- effects are requested after the relevant transition step is committed.

### 6.3 Statechart Features

The v1 runtime must support:

- atomic states;
- compound states;
- parallel states;
- initial states;
- final states;
- shallow history;
- deep history;
- guarded transitions;
- targetless transitions;
- self transitions;
- entry actions;
- exit actions;
- transition actions;
- delayed events;
- invoked effects;
- child actors.

### 6.4 Context

- Context must be immutable from the consumer perspective.
- Context updates must be explicit, typed, and traceable.
- Context must not be mutated in place by guards, actions, or effects.
- Context update APIs must support transaction-style grouped updates within one transition.

### 6.5 Effects

Effects must be modeled as explicit runtime requests.

Effects must support:

- names or stable identifiers;
- typed input;
- typed result;
- cancellation policy;
- trace metadata;
- mock execution;
- replay behavior.

Framework adapters must not run effects independently from the actor runtime.

### 6.6 Errors

The runtime must distinguish:

- machine definition errors;
- invalid target errors;
- guard errors;
- action errors;
- effect request errors;
- effect result errors;
- unhandled runtime errors.

Errors must be visible in traces and snapshots where appropriate.

## 7. Type API Requirements

The API must infer:

- event discriminants;
- event payloads;
- context shape;
- valid state values where feasible;
- guard parameters;
- action parameters;
- effect input/result types;
- selector result types;
- adapter hook/composable return types.

Invalid events and invalid event payloads should fail at compile time whenever the actor type is known.

Type-level tests must cover:

- inferred event unions;
- invalid event rejection;
- context assignment typing;
- guard/action/effect typing;
- selector typing;
- adapter type preservation.

## 8. Intermediate Representation Requirements

Every machine must be convertible to a serializable graph representation.

The IR must include:

- machine metadata;
- state node IDs;
- state node hierarchy;
- parallel region metadata;
- initial/final/history nodes;
- transitions;
- event names;
- guard references;
- action references;
- effect references;
- protocol contracts;
- source locations when available;
- visual layout metadata when provided by tools.

The IR must be stable enough for devtools, model checking, visual editing, migration reports, and generated tests.

## 9. Adapter Contract Requirements

All adapters must consume a contract equivalent to:

```ts
interface StateGraphActor<TSnapshot, TEvent> {
  send(event: TEvent): void;
  getSnapshot(): TSnapshot;
  subscribe(listener: (snapshot: TSnapshot) => void): () => void;
  inspect?(listener: (trace: TraceEvent) => void): () => void;
}
```

Adapters must not depend on private actor internals.

Adapter conformance tests must verify:

- initial snapshot behavior;
- subscription behavior;
- selector equality behavior;
- cleanup behavior;
- event dispatch behavior;
- error propagation behavior;
- SSR behavior where applicable.

## 10. Testing Requirements

### 10.1 Runtime Tests

Runtime tests must cover:

- transition priority;
- entry/exit/action ordering;
- guarded transitions;
- targetless transitions;
- self transitions;
- parallel region determinism;
- history state restoration;
- delayed events;
- child actor lifecycle;
- effect request/cancel behavior;
- trace replay.

### 10.2 Model and Tooling Tests

Tooling tests must cover:

- IR export completeness;
- unreachable state detection;
- dead transition detection;
- nondeterminism detection;
- invalid target validation;
- generated state coverage tests;
- generated transition coverage tests;
- generated invalid-event tests.

### 10.3 Adapter Tests

Each adapter must run the shared conformance test suite plus framework-specific lifecycle tests.

### 10.4 Migration Tests

Migration tooling must use fixtures for common XState patterns:

- simple finite machines;
- hierarchical machines;
- parallel states;
- guards;
- actions;
- invoked services;
- delayed transitions;
- React hook usage where codemods are supported.

Unsupported or partially supported patterns must produce explicit diagnostics.

## 11. Build and Release Requirements

Each package must define:

- `build`;
- `dev` where useful;
- `test`;
- `test:watch`;
- `lint`;
- `check-types`;
- `clean`.

Published package manifests must include:

- `name`;
- `version`;
- `type`;
- `exports`;
- `main` if CommonJS is emitted;
- `module`;
- `types`;
- `files`;
- `sideEffects`;
- `peerDependencies` for framework packages;
- `dependencies` only where required at runtime;
- `devDependencies` for local build/test tooling.

Release artifacts must not include source-only private test fixtures unless explicitly required.

## 12. Documentation Requirements

Technical documentation must include:

- package overview;
- runtime execution model;
- machine definition guide;
- effects guide;
- snapshots and selectors guide;
- adapter authoring guide;
- testing and model-checking guide;
- trace and replay guide;
- migration guide from common XState concepts;
- contribution guide;
- package boundary rules.

All public examples must compile and run in CI.

## 13. CI Requirements

CI must run:

- install;
- format check;
- lint;
- type check;
- unit tests;
- adapter conformance tests;
- build;
- package export validation.

CI should support affected-package execution through Turborepo caching, but release branches must still support a full clean run.

## 14. Performance and Bundle Requirements

The core runtime must remain small and dependency-light.

The project must define bundle budgets before the first public release:

- `@stategraph/core` production ESM bundle budget;
- per-adapter bundle budget excluding peer framework;
- devtools transport budget;
- model-check package budget where applicable.

Runtime performance benchmarks must cover:

- machine creation;
- actor startup;
- event dispatch throughput;
- selector notification overhead;
- parallel region update cost;
- trace recording overhead.

## 15. Security and Robustness Requirements

- Machine definitions imported from external sources must be validated before execution.
- Visual editor imports must not execute arbitrary code.
- Migration tools must treat source files as untrusted input.
- Devtools trace import must validate schema version and payload shape.
- Effects must be registered explicitly; serialized IR must not contain executable functions.

## 16. MVP Technical Scope

The first shippable implementation must include:

- `@stategraph/core`;
- `@stategraph/testing`;
- `@stategraph/model-check` with basic checks;
- `@stategraph/inspect` with trace schema and local transport;
- `@stategraph/react`;
- `@stategraph/dom`;
- Vite playground app;
- core runtime conformance tests;
- React and DOM adapter conformance tests;
- basic XState migration guide;
- package build, lint, type-check, and test pipelines.

Post-MVP packages may be stubbed in the monorepo only if they clearly indicate unsupported status and do not ship as stable packages.

## 17. Open Technical Decisions

These decisions must be resolved during implementation:

- final object DSL shape;
- whether builder API ships in MVP or experimental;
- action and effect registration syntax;
- exact snapshot shape;
- trace event schema versioning;
- model-checker bounds and defaults;
- package publishing strategy;
- ESM-only versus dual ESM/CJS per package;
- exact adapter API names for each framework.

