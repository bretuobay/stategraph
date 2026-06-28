# StateGraph TS — Claude Code Project Instructions

## What this project is

StateGraph TS is a TypeScript-first statechart runtime and state-management platform.
It is framework-agnostic, serializable, deterministic, and designed for tooling (devtools, model checking, visual editing, test generation).

Read these documents before making any non-trivial change:

- [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md) — goals, users, concepts, acceptance criteria
- [`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md) — monorepo layout, toolchain, package contracts, runtime semantics
- [`docs/decisions/`](./docs/decisions/) — ADRs for every resolved open design question

---

## Monorepo layout (TRD §3.1)

```
apps/docs  apps/playground  apps/devtools
packages/core  packages/testing  packages/inspect  packages/model-check
packages/react  packages/vue  packages/angular  packages/solid  packages/svelte  packages/dom
packages/scxml  packages/migrate-xstate
packages/config-eslint  packages/config-typescript  packages/config-vitest
examples/react-modal  examples/react-form  examples/dom-player
```

**Hard package boundary rules:**
- `@stategraph/core` must have zero framework dependencies, zero browser globals, zero test-framework imports.
- Packages communicate only through public barrel exports (`src/index.ts`). No deep imports.
- Adapter packages may only depend on `@stategraph/core` and their framework peer dependency.
- Apps may depend on packages. Packages must never import from apps.

---

## Toolchain (TRD §4)

| Tool | Role |
|---|---|
| TypeScript (strict) | All packages. Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. |
| tsup | Library builds. Dual ESM + CJS output. See ADR-008. |
| Vite | Browser apps and examples only. |
| Vitest | All tests. |
| ESLint + Prettier | Formatting authority is Prettier. ESLint enforces types and import boundaries. |
| changesets | Versioning and publishing. |
| Turborepo | Task orchestration. |

---

## Key ADR decisions — follow these exactly

### DSL shape (ADR-001)

Use `setup()` + `.createMachine()`. Never embed executable functions in the definition object — guards, actions, and effects are always **string references** in the DSL.

```ts
const machine = setup({
  guards: { isValid: ({ context }) => context.value.length > 0 },
  actions: { clearError: assign(() => ({ error: null })) },
  effects: { submitForm: fromPromise(({ input, signal }) => fetch(input.url, { signal })) },
}).createMachine({
  id: 'form',
  initial: 'idle',
  context: { value: '', error: null },
  states: {
    idle: { on: { SUBMIT: { target: 'submitting', guard: 'isValid' } } },
    submitting: {
      entry: ['clearError'],
      invoke: { src: 'submitForm', input: ({ context }) => ({ url: '/api' }), onDone: 'success', onError: 'idle' },
    },
    success: { type: 'final' },
  },
})
```

Override implementations at test/DI time:
```ts
createActor(machine, { provide: { guards: { isValid: () => true }, effects: { submitForm: fromPromise(async () => ({ ok: true })) } } })
```

### Builder API (ADR-002)

`setup()` ships in MVP. Full imperative builder (`.addState()`, etc.) is post-MVP under `experimental` namespace. Do not add it to MVP code.

### Actions and effects (ADR-003)

- Context updates: only via `assign()`. Never mutate `context` in place.
- Side-effect actions: plain `void` functions registered in `setup({ actions })`.
- Parameterised: `entry: [{ type: 'toast', params: { message: 'Saved!' } }]`.
- Effects: `fromPromise` (AbortSignal auto-cancel), `fromCallback` (manual cleanup), `fromObservable` (type stub only in MVP).

### Snapshot shape (ADR-004)

```ts
interface StateGraphSnapshot<TContext, TEvent> {
  status: 'idle' | 'active' | 'done' | 'error' | 'stopped'
  value: StateValue                    // string | Record<string, StateValue>
  configuration: ReadonlySet<string>   // flat set of active node IDs
  context: Readonly<TContext>
  changed: boolean
  event: TEvent | { type: '@@INIT' } | null
  transitions: ReadonlyArray<{ source: string; target: string | null; eventType: string }>
  pendingEffects: ReadonlyArray<{ id: string; src: string; input: unknown }>
  children: Readonly<Record<string, ChildActorRef>>
  error: unknown
  _traceId: string | undefined
}
```

### Trace versioning (ADR-005)

Every trace export has `{ schemaVersion: '1.0', sessionId, machineId, actorId, createdAt, events }`. Schema owned by `@stategraph/inspect`. MAJOR bump = breaking change. Use Zod to validate on import.

### Model checker (ADR-006)

Structural checks (unreachable states, dead states, dead transitions, invalid targets, nondeterminism, missing initial) are **on by default** — no bounds needed, O(V+E). Bounded reachability is **opt-in**. `effectsWithoutCancel` is off by default.

### Publishing (ADR-007)

MVP publishes 6 packages: `core`, `react`, `dom`, `testing`, `inspect`, `model-check`. All others are `"private": true` stubs. Lock-step `0.x.y` versioning via changesets. `sideEffects: false` on every package.

### Module format (ADR-008)

All MVP packages: dual ESM + CJS via tsup. `.js` for ESM, `.cjs` for CJS, `.d.ts` + `.d.cts` for declarations. Use a full `exports` map in `package.json`.

### Adapter API names (ADR-009)

| Framework | Create | Select | Send |
|---|---|---|---|
| React | `useActor` / `useActorRef` | `useSelector` | `useSend` |
| Vue | `useActor` / `useActorRef` | `useSelector` → `ComputedRef` | `send` from `useActor` |
| Angular | `provideActor` / `ActorService` | `selectObservable` / `toSignal` | `service.send` |
| Solid | `createActor` | `createSelector` | `send` from tuple |
| Svelte | `actorStore` | `selectorStore` | `send` from return |
| DOM | `mountActor` | `onSnapshot` | `bindEvent` |

---

## Runtime rules (TRD §6)

- **Run-to-completion:** one external event fully resolves (including all internal/generated events) before the next external event starts.
- **Determinism:** same machine + same event sequence + same effect results = same snapshot sequence. Every ordering decision (exit order, entry order, parallel region update order) must be documented and stable.
- **Immutability:** context is never mutated in place. `assign()` produces a new partial object; the runtime shallow-merges it.
- **Effects:** scheduled after the transition step commits, not inline. Framework adapters must not execute effects outside the actor runtime.

---

## Type rules (TRD §4.1, §7)

- No `any` in public APIs. Use `unknown`, generics, or branded types.
- Public APIs must emit `.d.ts` files without widening to `any`.
- Invalid event types must fail at compile time when the actor type is known.
- Write compile-time type tests (`expectType`, `assertType`) alongside runtime tests.

---

## Testing rules (TRD §10)

- Runtime tests must cover transition priority, entry/exit ordering, parallel region determinism, history restoration, delayed events, effect request/cancel, and trace replay.
- Each adapter must pass the shared conformance suite plus framework-specific lifecycle tests.
- Generated tests from `@stategraph/testing` must be deterministic and executable by Vitest with no modifications.

---

## What NOT to do

- Do not add `any` types to public APIs.
- Do not add framework imports to `@stategraph/core`.
- Do not deep-import from another package's private files.
- Do not put executable functions inside machine definition objects.
- Do not mutate `context` directly in guards, actions, or effects.
- Do not publish packages that are marked `"private": true` in their `package.json`.
- Do not alter runtime semantics inside framework adapters.
- Do not skip the `setup()` wrapper to avoid the dual-call pattern — bare `createMachine()` is for untyped/migration cases only.
