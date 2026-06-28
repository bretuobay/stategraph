# DOM Adapter Tasks

- [ ] Define DOM adapter public types and package barrel exports.
- [ ] Implement `mountActor(machine, options?)`.
- [ ] Implement idempotent cleanup for mounted actors.
- [ ] Implement `bindEvent(element, domEventType, actor, stateEvent)`.
- [ ] Support static StateGraph event objects in `bindEvent`.
- [ ] Support DOM-event-to-StateGraph-event mapping functions in `bindEvent`.
- [ ] Implement `onSnapshot(actor, handler)`.
- [ ] Ensure all unsubscribe and cleanup functions are idempotent where practical.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add shared adapter conformance tests.
- [ ] Add DOM-specific tests for event listener registration, event mapping, unsubscribe, snapshot handlers, and cleanup.
- [ ] Add type tests for DOM helper event typing.
