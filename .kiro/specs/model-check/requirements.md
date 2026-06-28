# Model Check Requirements

## Introduction

This spec defines `@stategraph/model-check`, the package for static graph analysis and opt-in bounded reachability. It consumes public machine IR from `@stategraph/core`.

## Requirements

### Requirement 1: Structural Checks

**User story:** As a machine author, I want fast default checks so that common modeling mistakes are caught in CI.

#### Acceptance Criteria

1. WHEN `check(machine)` is called THEN Tier 1 structural checks SHALL run by default.
2. WHEN unreachable states exist THEN diagnostics SHALL include `UNREACHABLE_STATE`.
3. WHEN dead non-final states exist THEN diagnostics SHALL include `DEAD_STATE`.
4. WHEN invalid targets exist THEN diagnostics SHALL include `INVALID_TARGET`.
5. WHEN compound states miss required initial declarations THEN diagnostics SHALL include `MISSING_INITIAL`.
6. WHEN nondeterministic transitions exist THEN diagnostics SHALL include `NONDETERMINISTIC_TRANSITION`.

### Requirement 2: Configuration Defaults

**User story:** As a CI maintainer, I want safe defaults so that checks are useful without excessive runtime.

#### Acceptance Criteria

1. WHEN config is omitted THEN defaults from ADR-006 SHALL be applied.
2. WHEN partial config is provided THEN it SHALL merge with defaults.
3. WHEN `effectsWithoutCancel` is omitted THEN it SHALL default to false.
4. WHEN bounded analysis is omitted THEN it SHALL default to disabled.

### Requirement 3: Bounded Reachability

**User story:** As an advanced user, I want bounded state-space exploration so that dynamic behavior can be analyzed within explicit limits.

#### Acceptance Criteria

1. WHEN bounded analysis is enabled THEN it SHALL respect `maxPathDepth`, `maxStatesExplored`, `maxTransitions`, `maxCycleLength`, and `timeoutMs`.
2. WHEN a limit is reached THEN result stats SHALL set `hitLimit: true`.
3. WHEN bounded analysis completes without hitting limits THEN `hitLimit` SHALL be false.
4. WHEN context cannot be fully explored THEN diagnostics SHALL avoid claiming full proof.

### Requirement 4: Result Shape

**User story:** As a tool author, I want structured diagnostics so that CLI and editor integrations can present useful errors.

#### Acceptance Criteria

1. WHEN checks finish THEN the result SHALL include `passed`, `diagnostics`, and `stats`.
2. WHEN diagnostics are emitted THEN each SHALL include severity, code, message, and relevant state or transition metadata where available.
3. WHEN errors are present THEN `passed` SHALL be false.
4. WHEN warnings only are present THEN `passed` MAY remain true.
