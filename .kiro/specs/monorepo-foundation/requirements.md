# Monorepo Foundation Requirements

## Introduction

This spec defines the StateGraph TS workspace foundation required by all MVP packages. It covers Turborepo layout, shared tooling, package boundaries, build/test scripts, TypeScript strictness, dual ESM/CJS package output, and release scaffolding.

## Requirements

### Requirement 1: Workspace Layout

**User story:** As a package implementer, I want a predictable workspace layout so that agents can build packages independently without inventing structure.

#### Acceptance Criteria

1. WHEN the repository is scaffolded THEN it SHALL contain `apps/`, `packages/`, and `examples/` workspace roots.
2. WHEN MVP packages are created THEN the workspace SHALL include `packages/core`, `packages/testing`, `packages/inspect`, `packages/model-check`, `packages/react`, and `packages/dom`.
3. WHEN post-MVP package stubs are created THEN they SHALL be marked private and clearly documented as unsupported.
4. WHEN apps are created THEN `apps/docs`, `apps/playground`, and `apps/devtools` SHALL use Vite.

### Requirement 2: Package Boundaries

**User story:** As a maintainer, I want strict package boundaries so that runtime semantics remain framework-independent.

#### Acceptance Criteria

1. WHEN `@stategraph/core` is implemented THEN it SHALL NOT import any framework, browser global, adapter package, app code, DOM API, or test framework.
2. WHEN a package imports another package THEN it SHALL import only from the public package barrel.
3. WHEN an adapter package is implemented THEN it SHALL depend only on `@stategraph/core` and its framework peer dependency.
4. WHEN apps or examples need reusable logic THEN that logic SHALL live in `packages/*`, not app-local modules.

### Requirement 3: Toolchain

**User story:** As a contributor, I want one standard toolchain so that package implementation and CI are consistent.

#### Acceptance Criteria

1. WHEN dependencies are installed THEN the repo SHALL support Turborepo, TypeScript, tsup, Vite, Vitest, ESLint, Prettier, and changesets.
2. WHEN TypeScript is configured THEN strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` SHALL be enabled unless a package documents an exception.
3. WHEN tests are written THEN Vitest SHALL be the only test runner.
4. WHEN formatting is checked THEN Prettier SHALL be the single formatting authority.

### Requirement 4: Root Scripts

**User story:** As a coding agent, I want standard scripts so that I can run build, test, lint, and type checks predictably.

#### Acceptance Criteria

1. WHEN `package.json` is created THEN it SHALL include Turbo-backed scripts for `build`, `dev`, `test`, `test:watch`, `lint`, `check-types`, and `clean`.
2. WHEN formatting scripts are created THEN `format` SHALL run `prettier --write .` and `format:check` SHALL run `prettier --check .`.
3. WHEN a contributor runs package-specific work THEN Turbo filters such as `--filter=@stategraph/core` SHALL be supported.

### Requirement 5: Package Output

**User story:** As a consumer, I want packages to work in ESM and CommonJS ecosystems during MVP.

#### Acceptance Criteria

1. WHEN a published MVP package is built THEN it SHALL emit ESM, CommonJS, declaration files, and sourcemaps.
2. WHEN a package manifest is authored THEN it SHALL include a complete `exports` map for import and require consumers.
3. WHEN adapter packages build THEN framework peer dependencies SHALL NOT be bundled.
4. WHEN packages are published THEN the package files SHALL be limited to `dist`, `README.md`, and `package.json`.

### Requirement 6: Release Baseline

**User story:** As a maintainer, I want predictable MVP releases so that package compatibility is easy to reason about.

#### Acceptance Criteria

1. WHEN changesets are configured THEN all MVP published packages SHALL use lock-step `0.x.y` versioning.
2. WHEN a package is post-MVP THEN its `package.json` SHALL include `"private": true`.
3. WHEN a package is published THEN it SHOULD support npm provenance.
