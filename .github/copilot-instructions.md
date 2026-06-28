# StateGraph TS — GitHub Copilot Instructions

StateGraph TS is a TypeScript-first statechart runtime and state-management platform.
It is framework-agnostic, serializable, and deterministic.

Full specifications live in:
- `PRODUCT_REQUIREMENTS.md`
- `TECHNICAL_REQUIREMENTS.md`
- `docs/decisions/` (ADR-001 through ADR-009)

Always read the relevant ADR before implementing anything in its area.

---

## Non-negotiable rules

### Package boundaries
- `packages/core` has zero framework dependencies and zero browser globals.
- Packages import only from each other's public barrel (`src/index.ts`). No deep imports.
- Apps depend on packages. Packages never depend on apps.

### DSL — ADR-001
The machine definition object must be JSON-serializable. No inline functions.
Guards, actions, and effects are **string references** in the DSL; implementations go in `setup()`.

```ts
// CORRECT
setup({
  guards: { isValid: ({ context }) => context.value.length > 0 },
  actions: { setError: assign(({ event }) => ({ error: event.message })) },
  effects: { submit: fromPromise(({ input, signal }) => fetch(input.url, { signal })) },
}).createMachine({ ... })

// WRONG — inline function in DSL
createMachine({
  states: { idle: { on: { SUBMIT: { guard: ({ context }) => context.ok } } } }
})
```

Override at test time via `createActor(machine, { provide: { guards, actions, effects } })`.

### Context immutability — ADR-003
Never mutate `context` in place. Use `assign()` only.

```ts
// CORRECT
assign(({ context }) => ({ count: context.count + 1 }))

// WRONG
actions: { inc: ({ context }) => { context.count++ } }
```

### Snapshot shape — ADR-004
Every snapshot has: `status`, `value`, `configuration`, `context`, `changed`, `event`, `transitions`, `pendingEffects`, `children`, `error`, `_traceId`.
`configuration` is a `ReadonlySet<string>` of active state node IDs.
`changed` is set by the runtime — adapters must use it to skip unnecessary re-renders.

### Effects — ADR-003
- `fromPromise`: auto-cancelled via `AbortSignal` on state exit.
- `fromCallback`: returns a cleanup function.
- `fromObservable`: type stub only in MVP — do not implement.
- Adapters must never run effects outside the actor runtime.

### TypeScript — TRD §4.1
- No `any` in public APIs. Use `unknown`, generics, or branded types.
- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
- Public APIs must emit `.d.ts` without widening to `any`.

### Module format — ADR-008
All packages: dual ESM + CJS via tsup. Use `.cjs` extension for CJS output, `.d.cts` for CJS declarations.

### Adapter API names — ADR-009
| Framework | Create actor | Select | Send |
|---|---|---|---|
| React | `useActor` / `useActorRef` | `useSelector` | `useSend` |
| Vue | `useActor` / `useActorRef` | `useSelector` | via `useActor` |
| Angular | `provideActor` / `ActorService` | `selectObservable` / `toSignal` | `service.send` |
| Solid | `createActor` | `createSelector` | via tuple |
| Svelte | `actorStore` | `selectorStore` | via return |
| DOM | `mountActor` | `onSnapshot` | `bindEvent` |

### Publishing — ADR-007
MVP ships 6 packages: `core`, `react`, `dom`, `testing`, `inspect`, `model-check`.
All other packages must have `"private": true` in `package.json`.

---

## Runtime semantics (TRD §6)
- Run-to-completion: one external event fully resolves before the next starts.
- Determinism: same machine + events + effect results = same snapshot sequence.
- Effects are scheduled after the transition commits, not inline.
- Entry order: outermost state first. Exit order: innermost state first.

---

## Do not
- Add framework imports to `packages/core`.
- Mutate `context` directly.
- Embed functions in machine definition objects.
- Add `any` to public API types.
- Implement `fromObservable` in MVP.
- Skip the `setup()` wrapper for typed machines.
- Alter runtime transition logic inside adapters.
