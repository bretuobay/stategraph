# XState Migration Requirements

## Introduction

This spec defines `@stategraph/migrate-xstate`, the post-MVP migration package for helping teams move from XState to StateGraph TS. It is not a drop-in compatibility layer.

## Requirements

### Requirement 1: Analysis

**User story:** As a migration engineer, I want to analyze XState definitions so that I can understand conversion risk before changing code.

#### Acceptance Criteria

1. WHEN an XState machine definition is analyzed THEN the package SHALL identify supported and unsupported constructs.
2. WHEN the definition uses common patterns THEN the analysis SHALL map them to StateGraph concepts where possible.
3. WHEN the analysis encounters unsupported features THEN it SHALL emit explicit diagnostics.

### Requirement 2: Conversion

**User story:** As a migration engineer, I want best-effort conversion to the StateGraph object DSL so that common machines can move with minimal manual work.

#### Acceptance Criteria

1. WHEN a convertible XState machine is supplied THEN the package SHALL produce a StateGraph machine definition or migration-ready object DSL.
2. WHEN inline guards, actions, or services are present THEN the converter SHALL move them into named implementations where possible.
3. WHEN conversion cannot be completed safely THEN the package SHALL leave the machine partially converted and report why.

### Requirement 3: Migration Reports and Codemods

**User story:** As a maintainer, I want migration reports and code transforms so that application code can be updated consistently.

#### Acceptance Criteria

1. WHEN `createMigrationReport(...)` is used THEN it SHALL summarize applied mappings, unsupported features, and manual follow-up tasks.
2. WHEN codemod helpers run THEN they SHALL rewrite common React hook usage and machine authoring patterns where feasible.
3. WHEN migration output is generated THEN it SHALL preserve compatibility notes instead of claiming API equivalence with XState.

### Requirement 4: Boundaries and Testing

**User story:** As a maintainer, I want migration tooling isolated so it stays optional and does not shape core runtime semantics.

#### Acceptance Criteria

1. WHEN the package imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the package is used THEN it SHALL remain outside the core runtime dependency graph.
3. WHEN tests run THEN they SHALL cover analysis, conversion, report generation, unsupported-feature diagnostics, and fixture regressions.
