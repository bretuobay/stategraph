# StateGraph TS

A TypeScript-first statechart runtime and state-management platform. Framework-agnostic, serializable, and deterministic — built for production apps and tooling alike.

## Packages

### Published (MVP — v0.1.x)

| Package | Description |
|---|---|
| [`@stategraph/core`](./packages/core) | Pure runtime: machines, actors, guards, actions, effects |
| [`@stategraph/react`](./packages/react) | React 18+ adapter (`useActor`, `useSelector`, `useSend`) |
| [`@stategraph/dom`](./packages/dom) | Headless DOM adapter (`mountActor`, `bindEvent`, `onSnapshot`) |
| [`@stategraph/inspect`](./packages/inspect) | Trace recording, serialization, devtools bridge, and replay |
| [`@stategraph/testing`](./packages/testing) | Test-plan generation, effect mocks, adapter conformance suite |
| [`@stategraph/model-check`](./packages/model-check) | Static structural analysis for machine IR |

### Post-MVP stubs (not published)

| Package | Description |
|---|---|
| `@stategraph/react` | Vue 3 adapter |
| `@stategraph/angular` | Angular adapter |
| `@stategraph/solid` | SolidJS adapter |
| `@stategraph/svelte` | Svelte adapter |
| `@stategraph/scxml` | SCXML import/export |
| `@stategraph/migrate-xstate` | XState → StateGraph codemod tooling |

## Quick start

```ts
import { assign, fromPromise, setup, createActor } from "@stategraph/core";

const machine = setup({
  guards: {
    isValid: ({ context }) => context.value.trim().length > 0,
  },
  actions: {
    setValue: assign(({ event }) => ({ value: event.value })),
  },
  effects: {
    submit: fromPromise(({ input }) => fetch(input.url, { method: "POST" })),
  },
}).createMachine({
  id: "form",
  initial: "idle",
  context: { value: "" },
  states: {
    idle: {
      on: {
        CHANGE: { actions: ["setValue"] },
        SUBMIT: { target: "submitting", guard: "isValid" },
      },
    },
    submitting: {
      invoke: { src: "submit", input: ({ context }) => ({ url: "/api" }), onDone: "success" },
    },
    success: { type: "final" },
  },
});

const actor = createActor(machine);
actor.start();
actor.send({ type: "CHANGE", value: "hello" });
actor.send({ type: "SUBMIT" });
console.log(actor.getSnapshot().value); // "submitting"
```

## Apps and examples

| Path | Description | Dev command |
|---|---|---|
| `apps/playground` | Live demos: counter, toggle, 3-second timer | `pnpm dev:playground` |
| `apps/docs` | Single-page reference docs for all 10 guide topics | `pnpm dev:docs` |
| `examples/react-modal` | React modal with `closed ↔ open` lifecycle machine | `pnpm dev:modal` |
| `examples/react-form` | React form with guarded submit, async effect, error/retry | `pnpm dev:form` |
| `examples/dom-player` | Parallel playback + volume machine with DOM event binding | `pnpm dev:player` |

## Design principles

- **Run-to-completion**: one external event fully resolves (all internal events drained) before the next starts.
- **Determinism**: same machine + same event sequence + same effect results = same snapshot sequence, always.
- **Immutability**: context is never mutated in place. `assign()` produces a new partial object.
- **Serializable definition**: guards, actions, and effects are registered as string references — the machine definition is pure JSON-serializable data.
- **Effects scheduled after commit**: side effects are dispatched after the transition step completes, never inline.

## Monorepo commands

```sh
pnpm build           # Build all packages
pnpm test            # Run all tests
pnpm lint            # Lint all packages
pnpm check-types     # Type-check all packages
pnpm dev             # Start all dev servers (packages + apps)
pnpm dev:playground  # Start playground app only
pnpm dev:docs        # Start docs app only
pnpm dev:modal       # Start react-modal example only
pnpm dev:form        # Start react-form example only
pnpm dev:player      # Start dom-player example only
```

## Repository layout

```
apps/
  playground/        Vite app — interactive machine demos
  docs/              Vite app — reference documentation
  devtools/          Vite app — devtools UI (stub)
packages/
  core/              Runtime (zero dependencies)
  react/             React 18+ adapter
  dom/               Headless DOM adapter
  inspect/           Trace + devtools
  testing/           Test utilities
  model-check/       Static analysis
  config-eslint/     Shared ESLint config
  config-typescript/ Shared TypeScript configs
  config-vitest/     Shared Vitest config
examples/
  react-modal/       Modal lifecycle example
  react-form/        Form with async effect example
  dom-player/        Parallel state DOM player example
docs/
  decisions/         Architecture Decision Records (ADR-001 – ADR-009)
```

## Architecture decisions

Nine ADRs govern all non-trivial design choices. See [`docs/decisions/`](./docs/decisions/) for the full index.

Key decisions:
- **ADR-001** — `setup()` + `.createMachine()` dual-call pattern; no executable functions in the definition object.
- **ADR-004** — Snapshot shape with `value`, `configuration`, `context`, `children`, `pendingEffects`.
- **ADR-007** — Lock-step `0.x.y` versioning; only 6 packages published in MVP.
- **ADR-008** — Dual ESM + CJS output via tsup for all published packages.

## Contributing

1. All packages: TypeScript strict mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
2. `@stategraph/core` must have zero framework dependencies, zero browser globals, zero test-framework imports.
3. Import only from package barrels (`src/index.ts`). No deep imports between packages.
4. Adapter packages may only depend on `@stategraph/core` and their framework peer dependency.
5. Run `pnpm lint && pnpm check-types && pnpm test` before opening a PR.
