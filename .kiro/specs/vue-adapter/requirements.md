# Vue Adapter Requirements

## Introduction

This spec defines `@stategraph/vue`, the Vue 3 adapter for StateGraph actors. It provides composables for actor lifecycle, snapshot access, and derived selection while preserving core runtime semantics.

## Requirements

### Requirement 1: Composables

**User story:** As a Vue developer, I want composables for actor lifecycle and selection so that StateGraph integrates cleanly with Vue 3 components.

#### Acceptance Criteria

1. WHEN `useActor(machine, options?)` is called THEN it SHALL create an actor tied to component lifecycle and return reactive snapshot, `send`, and actor handles.
2. WHEN `useActorRef(machine, options?)` is called THEN it SHALL return a stable actor ref without making the component rerender on every snapshot.
3. WHEN `useSelector(actor, selector, compare?)` is used THEN it SHALL return a computed value that updates only when the selected value changes.
4. WHEN `compare` is omitted THEN selector equality SHALL default to `Object.is`.

### Requirement 2: Lifecycle and Cleanup

**User story:** As an app developer, I want adapter-owned actors and subscriptions cleaned up automatically so Vue unmounts do not leak runtime work.

#### Acceptance Criteria

1. WHEN a component unmounts THEN adapter-owned subscriptions SHALL be removed and actor-owned effects SHALL be stopped through core actor cleanup.
2. WHEN the adapter uses Vue reactive primitives THEN it SHALL avoid altering transition semantics or executing runtime effects during render.
3. WHEN SSR or hydration is used THEN actor creation and snapshot access SHALL remain safe for server-side rendering where applicable.

### Requirement 3: Shared Actor Access

**User story:** As a Vue app developer, I want to share one actor across a subtree so child components interact with the same runtime instance.

#### Acceptance Criteria

1. WHEN an actor is shared through Vue tree context THEN descendant consumers SHALL observe the same actor instance.
2. WHEN actor sharing is used THEN the adapter SHALL NOT create duplicate actor instances for the same subtree.
3. WHEN tree sharing is not used THEN the adapter SHALL still support direct actor refs and composable-local ownership.

### Requirement 4: Boundaries and Testing

**User story:** As a maintainer, I want the Vue adapter to stay thin and testable so it cannot diverge from core semantics.

#### Acceptance Criteria

1. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the adapter is tested THEN it SHALL include the shared adapter conformance suite.
3. WHEN framework-specific tests run THEN they SHALL cover lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
