# ADR-002: Builder API — MVP or Experimental

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD (§8.1) specifies two authoring surfaces: the object DSL (primary) and a builder API for "advanced inference and reusable fragments." The open question is whether a programmatic builder ships in MVP or is deferred.

The risk of shipping both surfaces simultaneously is that two unstabilized APIs compound design debt before real usage data exists.

---

## Decision

`setup()` ships in MVP as the primary typed authoring surface. A full programmatic builder is post-MVP and tagged `@experimental`.

### What ships in MVP

`setup()` is a type-capture factory, not a full builder. It provides:

```ts
// MVP core exports
export {
  setup,           // type-capture factory → .createMachine()
  createMachine,   // bare untyped form for migration targets
  createActor,
  assign,
  fromPromise,
  fromCallback,
  fromObservable,  // stub type only in MVP
}
```

`setup()` is sufficient for:
- Full TypeScript inference across guards, actions, effects, context, and events.
- Named, reusable guard/action/effect implementations.
- Override via `provide:` at `createActor` time.

### What is deferred (post-MVP)

A full imperative builder for constructing machines programmatically from data:

```ts
// Post-MVP @experimental
import { experimental } from '@stategraph/core'

const machine = experimental.machineBuilder<Ctx, Evt>()
  .addState('idle', s => s.on('SUBMIT', { target: 'submitting' }))
  .addState('submitting', s => s.invoke({ src: 'submitForm' }))
  .build()
```

This builder is useful when machine topology is derived from runtime data (e.g., dynamic form steps, user-configured workflows). It cannot be stabilized before the core DSL is validated against real use cases.

Post-MVP home: named export under `experimental` namespace in `@stategraph/core`, or a separate `@stategraph/builder` package.

---

## Consequences

**Positive:**
- MVP surface area stays focused; `setup()` solves 95% of inference needs.
- Builder design can be informed by actual DSL usage patterns before committing to a public API.
- Avoids prematurely locking the TypeScript generics shape of a builder that interacts with every other core type.

**Negative:**
- Teams that need dynamically constructed machines must use `createMachine()` with manually assembled plain objects until the builder ships.
- The `experimental` namespace requires clear documentation to avoid accidental adoption.

---

## Alternatives Considered

**A. Ship both in MVP** — doubles the surface area before any user validation. Builder generics are extremely sensitive to the final DSL types; premature stabilization would create breaking changes.

**B. Skip the builder entirely** — valid long-term position, but the PRD explicitly identifies it as a planned surface, and dynamic machine construction is a real use case (workflow engines, form builders).

**C. Builder as a separate package from day one** — clean separation, but increases the coordination cost during early development when everything is still being shaped by the DSL.
