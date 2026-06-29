# Solid Adapter Tasks

- [ ] Define Solid adapter public types and package barrel exports.
- [ ] Implement `createActor(machine, options?)`.
- [ ] Implement `createSelector(actor, selector)`.
- [ ] Ensure adapter-owned actors start and stop with Solid component lifecycle.
- [ ] Ensure unmount cleanup unsubscribes and cancels actor-owned effects through core stop behavior.
- [ ] Ensure actor sharing through Solid context reuses the same actor instance.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add Solid-specific tests for lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
- [ ] Add type tests for tuple and selector return types.
