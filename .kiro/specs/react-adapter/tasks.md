# React Adapter Tasks

- [x] Define React adapter public types and package barrel exports.
- [x] Implement `useActor(machine, options?)`.
- [x] Implement `useActorRef(machine, options?)`.
- [x] Implement `useSelector(actor, selector, compare?)` with `Object.is` default.
- [x] Implement `useSend(actor)` with stable callback behavior.
- [x] Implement `StateGraphProvider` and `useActorContext()`.
- [x] Ensure hook lifecycle starts and stops adapter-owned actors correctly.
- [x] Ensure unmount cleanup unsubscribes and cancels actor-owned effects through core stop behavior.
- [x] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [x] Add React-specific tests for lifecycle, selector equality, provider usage, missing provider error, and SSR-safe behavior.
- [x] Add type tests for hook return types and event typing.
