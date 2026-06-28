# DOM Adapter Requirements

## Introduction

This spec defines `@stategraph/dom`, the vanilla DOM adapter for lifecycle-safe actor mounting, DOM event binding, and snapshot-driven DOM updates.

## Requirements

### Requirement 1: Actor Mounting

**User story:** As a vanilla DOM developer, I want actor mounting helpers so that StateGraph can run without a framework.

#### Acceptance Criteria

1. WHEN `mountActor(machine, options?)` is called THEN it SHALL create and start an actor.
2. WHEN `mountActor` returns THEN it SHALL provide `{ actor, cleanup }`.
3. WHEN `cleanup()` is called THEN it SHALL stop the actor and release adapter-owned resources.
4. WHEN cleanup is called multiple times THEN it SHALL be safe and idempotent.

### Requirement 2: DOM Event Binding

**User story:** As a developer, I want to bind DOM events to StateGraph events so that user input enters the actor protocol.

#### Acceptance Criteria

1. WHEN `bindEvent(element, domEventType, actor, stateEvent)` is called THEN it SHALL register a DOM listener.
2. WHEN the DOM event fires THEN it SHALL send the configured StateGraph event to the actor.
3. WHEN `stateEvent` is a function THEN it SHALL receive the DOM event and return the StateGraph event.
4. WHEN the unsubscribe function is called THEN it SHALL remove the DOM listener.

### Requirement 3: Snapshot Subscription

**User story:** As a developer, I want DOM update helpers so that actor snapshots can drive UI updates.

#### Acceptance Criteria

1. WHEN `onSnapshot(actor, handler)` is called THEN it SHALL subscribe to actor snapshots.
2. WHEN actor snapshots change THEN the handler SHALL receive the committed snapshot.
3. WHEN the unsubscribe function is called THEN the snapshot listener SHALL be removed.

### Requirement 4: Semantics and Boundaries

**User story:** As a maintainer, I want the DOM adapter to remain a thin layer over core.

#### Acceptance Criteria

1. WHEN the DOM adapter sends events THEN it SHALL call core actor `send`.
2. WHEN effects run THEN they SHALL run only through the core actor runtime.
3. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
4. WHEN DOM APIs are used THEN they SHALL be isolated to `@stategraph/dom` and tests configured with a DOM-like environment.

### Requirement 5: Testing

**User story:** As an adapter maintainer, I want DOM conformance tests so that vanilla integrations behave like framework adapters.

#### Acceptance Criteria

1. WHEN DOM adapter tests run THEN they SHALL include the shared adapter conformance suite.
2. WHEN DOM-specific tests run THEN they SHALL cover mount, cleanup, event binding, functional event mapping, snapshot subscription, and unsubscribe behavior.
