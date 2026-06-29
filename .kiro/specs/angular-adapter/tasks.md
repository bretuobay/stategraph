# Angular Adapter Tasks

- [ ] Define Angular adapter public types and package barrel exports.
- [ ] Implement `provideActor(machine, options?)`.
- [ ] Implement `ActorService` lifecycle and snapshot exposure.
- [ ] Implement `toObservable(actor)`.
- [ ] Implement `selectObservable(actor, selector)`.
- [ ] Implement `toSignal(actor, selector?)`.
- [ ] Ensure adapter-owned actors start and stop with Angular DI/component lifecycle.
- [ ] Ensure unmount cleanup unsubscribes and cancels actor-owned effects through core stop behavior.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add Angular-specific tests for DI setup, observable selection, signal interop, cleanup, and SSR-safe behavior where applicable.
- [ ] Add type tests for service and helper return types.
