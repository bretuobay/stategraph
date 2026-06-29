# Solid Adapter Requirements

## Introduction

This spec defines `@stategraph/solid`, the SolidJS adapter for StateGraph actors. It provides signal-oriented actor creation and selector helpers while preserving core runtime semantics.

## Requirements

### Requirement 1: Reactive Primitives

**User story:** As a Solid developer, I want signal-based actor APIs so that StateGraph fits Solid's fine-grained reactivity model.

#### Acceptance Criteria

1. WHEN `createActor(machine, options?)` is called THEN it SHALL return `[snapshotAccessor, send, actor]`.
2. WHEN `createSelector(actor, selector)` is used THEN it SHALL return an accessor that updates only when the selected value changes.
3. WHEN `createActor` is used THEN the actor SHALL be tied to the owning component lifecycle.

### Requirement 2: Cleanup and Semantics

**User story:** As an app developer, I want Solid cleanup to stop actor-owned effects and subscriptions without changing runtime semantics.

#### Acceptance Criteria

1. WHEN the component unmounts THEN adapter-owned subscriptions SHALL be removed and actor-owned effects SHALL be stopped.
2. WHEN selectors or snapshot accessors rerun THEN the adapter SHALL not execute effects or transition logic outside the core runtime.
3. WHEN a subtree shares an actor through Solid context THEN the same actor instance SHALL be reused.

### Requirement 3: Boundaries and Compatibility

**User story:** As a maintainer, I want the adapter thin and framework-native so it behaves like a normal Solid integration.

#### Acceptance Criteria

1. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the adapter is used in SSR-capable environments THEN actor creation and selectors SHALL remain safe where applicable.
3. WHEN the adapter is integrated into examples or apps THEN it SHALL expose a signal-based API consistent with Solid conventions.

### Requirement 4: Testing

**User story:** As an adapter maintainer, I want conformance and lifecycle tests so Solid remains aligned with core semantics.

#### Acceptance Criteria

1. WHEN adapter tests run THEN they SHALL include the shared adapter conformance suite.
2. WHEN framework-specific tests run THEN they SHALL cover lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
