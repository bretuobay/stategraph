# Vue Adapter Tasks

- [ ] Define Vue adapter public types and package barrel exports.
- [ ] Implement `useActor(machine, options?)`.
- [ ] Implement `useActorRef(machine, options?)`.
- [ ] Implement `useSelector(actor, selector, compare?)` with `Object.is` default.
- [ ] Ensure adapter-owned actors start and stop with Vue component lifecycle.
- [ ] Ensure unmount cleanup unsubscribes and cancels actor-owned effects through core stop behavior.
- [ ] Ensure actor sharing through subtree context uses a single actor instance.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add Vue-specific tests for lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
- [ ] Add type tests for composable return types and event typing.
