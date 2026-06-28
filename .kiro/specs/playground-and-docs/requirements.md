# Playground and Docs Requirements

## Introduction

This spec defines the Vite playground, documentation app baseline, runnable examples, and initial migration documentation required for MVP validation.

## Requirements

### Requirement 1: Playground App

**User story:** As a contributor, I want a playground app so that runtime and adapter behavior can be manually validated.

#### Acceptance Criteria

1. WHEN `apps/playground` is created THEN it SHALL use Vite and consume workspace packages.
2. WHEN the playground runs THEN it SHALL demonstrate at least one React machine and one DOM machine.
3. WHEN examples are added THEN they SHALL import from public package barrels only.
4. WHEN the playground builds THEN it SHALL compile in CI.

### Requirement 2: Documentation App

**User story:** As a user, I want docs that explain StateGraph concepts and APIs so that I can adopt the platform incrementally.

#### Acceptance Criteria

1. WHEN `apps/docs` is created THEN it SHALL use Vite.
2. WHEN docs are written THEN they SHALL include package overview, runtime model, machine definition guide, effects guide, snapshots/selectors guide, testing/model-checking guide, trace/replay guide, adapter guide, migration guide, and contribution guide.
3. WHEN public examples appear in docs THEN they SHALL compile or be validated in CI.

### Requirement 3: Examples

**User story:** As an evaluator, I want runnable examples so that common UI patterns are easy to inspect.

#### Acceptance Criteria

1. WHEN examples are created THEN MVP examples SHALL include `react-modal`, `react-form`, and `dom-player`.
2. WHEN examples run THEN they SHALL consume workspace packages rather than copied source.
3. WHEN example code dispatches events THEN it SHALL use typed StateGraph events.
4. WHEN examples use effects THEN they SHALL demonstrate explicit `fromPromise` or `fromCallback` usage where appropriate.

### Requirement 4: Migration Documentation

**User story:** As an XState user, I want honest migration guidance so that I can evaluate StateGraph without assuming drop-in compatibility.

#### Acceptance Criteria

1. WHEN migration docs are written THEN they SHALL state that StateGraph is migration-friendly but not a drop-in XState replacement.
2. WHEN migration concepts are mapped THEN docs SHALL cover states, events, guards, actions, invoked effects, actors, snapshots, and React usage.
3. WHEN unsupported migration patterns are discussed THEN docs SHALL describe manual migration or post-MVP tooling.

### Requirement 5: CI Validation

**User story:** As a maintainer, I want docs and examples validated so that public examples do not drift.

#### Acceptance Criteria

1. WHEN CI runs THEN docs and examples SHALL be included in build or validation steps.
2. WHEN examples fail to compile THEN CI SHALL fail.
3. WHEN docs include code samples that are not compiled THEN they SHALL be clearly marked as conceptual.
