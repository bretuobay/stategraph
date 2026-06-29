# Svelte Adapter Tasks

- [ ] Define Svelte adapter public types and package barrel exports.
- [ ] Implement `actorStore(machine, options?)`.
- [ ] Implement `selectorStore(actor, selector)`.
- [ ] Ensure adapter-owned actors start and stop with Svelte component lifecycle or store subscription lifecycle.
- [ ] Ensure unmount and unsubscribe cleanup cancels actor-owned effects through core stop behavior.
- [ ] Ensure actor sharing through Svelte context reuses the same actor instance.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add Svelte-specific tests for lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
- [ ] Add type tests for store and selector return types.
