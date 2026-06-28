# React Adapter Requirements

## Introduction

This spec defines `@stategraph/react`, the React 18+ adapter for StateGraph actors. It provides idiomatic hooks and provider APIs while preserving core runtime semantics.

## Requirements

### Requirement 1: Actor Hooks

**User story:** As a React developer, I want hooks for actor lifecycle and snapshots so that StateGraph integrates with React components.

#### Acceptance Criteria

1. WHEN `useActor(machine, options?)` is called THEN it SHALL create an actor tied to component lifecycle and return `{ snapshot, send, actor }`.
2. WHEN `useActorRef(machine, options?)` is called THEN it SHALL return a stable actor ref without subscribing the component to snapshot changes.
3. WHEN the component unmounts THEN adapter-owned subscriptions and actor-owned effects SHALL be cleaned up.
4. WHEN React concurrent rendering occurs THEN subscriptions SHALL remain safe and consistent.

### Requirement 2: Selector and Send APIs

**User story:** As a performance-conscious developer, I want fine-grained subscriptions so that React re-renders only when selected data changes.

#### Acceptance Criteria

1. WHEN `useSelector(actor, selector, compare?)` is used THEN it SHALL re-render only when the selected value changes.
2. WHEN `compare` is omitted THEN selector equality SHALL use `Object.is`.
3. WHEN `useSend(actor)` is used THEN it SHALL return a stable send function that does not subscribe to snapshots.

### Requirement 3: Context Sharing

**User story:** As an app developer, I want to share actors through React context so that subtrees can interact with the same actor.

#### Acceptance Criteria

1. WHEN `StateGraphProvider` is rendered THEN descendant hooks SHALL be able to access its actor.
2. WHEN `useActorContext()` is called outside a provider THEN it SHALL throw a descriptive error.
3. WHEN context sharing is used THEN it SHALL NOT create duplicate actor instances.

### Requirement 4: Semantics and Boundaries

**User story:** As a maintainer, I want the React adapter to be thin so that framework behavior cannot alter core semantics.

#### Acceptance Criteria

1. WHEN the adapter dispatches events THEN it SHALL call actor `send` without reinterpreting transitions.
2. WHEN effects run THEN they SHALL run only through the core actor runtime.
3. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
4. WHEN errors occur THEN they SHALL surface idiomatically without changing runtime behavior.

### Requirement 5: Testing

**User story:** As an adapter maintainer, I want conformance tests so that React integration remains compatible with core semantics.

#### Acceptance Criteria

1. WHEN React adapter tests run THEN they SHALL include the shared adapter conformance suite.
2. WHEN framework-specific tests run THEN they SHALL cover mount, unmount, selector equality, context provider, concurrent-safe subscription, and SSR-safe behavior where applicable.
