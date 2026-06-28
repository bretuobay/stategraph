# React Adapter Tasks

- [ ] Define React adapter public types and package barrel exports.
- [ ] Implement `useActor(machine, options?)`.
- [ ] Implement `useActorRef(machine, options?)`.
- [ ] Implement `useSelector(actor, selector, compare?)` with `Object.is` default.
- [ ] Implement `useSend(actor)` with stable callback behavior.
- [ ] Implement `StateGraphProvider` and `useActorContext()`.
- [ ] Ensure hook lifecycle starts and stops adapter-owned actors correctly.
- [ ] Ensure unmount cleanup unsubscribes and cancels actor-owned effects through core stop behavior.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add React-specific tests for lifecycle, selector equality, provider usage, missing provider error, and SSR-safe behavior.
- [ ] Add type tests for hook return types and event typing.
