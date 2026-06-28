# Testing Package Requirements

## Introduction

This spec defines `@stategraph/testing`, the package for graph traversal, model-derived test generation, effect mocks, and adapter conformance test harnesses.

## Requirements

### Requirement 1: Graph Traversal

**User story:** As a QA engineer, I want deterministic graph traversal so that machines can generate stable tests.

#### Acceptance Criteria

1. WHEN a machine IR is supplied THEN traversal utilities SHALL enumerate states and transitions deterministically.
2. WHEN traversal order is computed THEN repeated runs over the same machine SHALL produce the same order.
3. WHEN a machine contains parallel regions THEN traversal SHALL account for active configurations, not only individual state nodes.

### Requirement 2: Coverage Generation

**User story:** As a test author, I want generated tests for states, transitions, and paths so that critical behavior is covered consistently.

#### Acceptance Criteria

1. WHEN state coverage is generated THEN at least one test case SHALL be produced for each reachable state where possible.
2. WHEN transition coverage is generated THEN at least one test case SHALL be produced for each reachable transition where possible.
3. WHEN bounded path tests are generated THEN generation SHALL respect explicit depth and count limits.
4. WHEN generated tests are emitted THEN they SHALL be executable by Vitest without manual edits.

### Requirement 3: Invalid Event and Guard Tests

**User story:** As a maintainer, I want invalid and guarded behavior tested so that protocols reject illegal sequences.

#### Acceptance Criteria

1. WHEN invalid-event tests are generated THEN events sent to states that do not handle them SHALL be covered.
2. WHEN guard-branch tests are generated THEN enabled and disabled guard outcomes SHALL be representable.
3. WHEN a guard cannot be driven automatically THEN the generated test SHALL expose a fixture hook for the user.

### Requirement 4: Effect Mocks

**User story:** As a test author, I want effect mock scaffolds so that async behavior is deterministic.

#### Acceptance Criteria

1. WHEN promise effect mocks are created THEN tests SHALL be able to control resolve and reject behavior.
2. WHEN callback effect mocks are created THEN tests SHALL be able to send back events and trigger cleanup.
3. WHEN generated tests use effects THEN they SHALL rely on `provide` overrides rather than private runtime internals.

### Requirement 5: Adapter Conformance

**User story:** As an adapter implementer, I want a shared conformance suite so that adapters preserve core semantics.

#### Acceptance Criteria

1. WHEN an adapter runs conformance tests THEN initial snapshot, subscription, selector equality, cleanup, dispatch, error propagation, and SSR behavior SHALL be covered where applicable.
2. WHEN conformance helpers use actors THEN they SHALL consume only the public actor contract.
3. WHEN an adapter fails conformance THEN diagnostics SHALL identify the failed behavior.
