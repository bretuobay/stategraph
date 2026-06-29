# Svelte Adapter Requirements

## Introduction

This spec defines `@stategraph/svelte`, the Svelte adapter for StateGraph actors. It provides store-based actor access and selector helpers while preserving core runtime semantics.

## Requirements

### Requirement 1: Stores

**User story:** As a Svelte developer, I want store-based actor APIs so that StateGraph integrates with Svelte's subscription model.

#### Acceptance Criteria

1. WHEN `actorStore(machine, options?)` is called THEN it SHALL return a snapshot store, `send`, and actor ref.
2. WHEN `selectorStore(actor, selector)` is called THEN it SHALL return a readable store that updates only when the selected value changes.
3. WHEN `actorStore` is used THEN actor lifecycle SHALL be tied to the owning component or store subscription lifecycle.

### Requirement 2: Cleanup and Semantics

**User story:** As an app developer, I want stores to clean up automatically so unmounted Svelte components do not leak subscriptions or actor-owned effects.

#### Acceptance Criteria

1. WHEN a component or store unsubscribes THEN adapter-owned subscriptions SHALL be removed and actor-owned effects SHALL be stopped.
2. WHEN the adapter computes derived store values THEN it SHALL not run transitions or effects outside the core runtime.
3. WHEN a subtree shares an actor through Svelte context THEN the same actor instance SHALL be reused.

### Requirement 3: Boundaries and Compatibility

**User story:** As a maintainer, I want the adapter thin and idiomatic so it fits Svelte 4 store usage and remains compatible with future Svelte APIs.

#### Acceptance Criteria

1. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the adapter is used in SSR-capable environments THEN store creation and snapshot access SHALL remain safe where applicable.
3. WHEN the adapter is integrated into examples or apps THEN it SHALL expose Svelte-compatible store semantics.

### Requirement 4: Testing

**User story:** As an adapter maintainer, I want conformance and lifecycle tests so Svelte stays aligned with core semantics.

#### Acceptance Criteria

1. WHEN adapter tests run THEN they SHALL include the shared adapter conformance suite.
2. WHEN framework-specific tests run THEN they SHALL cover lifecycle, selector equality, subtree sharing, cleanup, and SSR-safe behavior where applicable.
