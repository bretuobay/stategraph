# ADR-007: Package Publishing Strategy

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The TRD (§13) defines twelve packages under the `@stategraph` npm scope. Publishing all of them simultaneously creates maintenance overhead before the API is validated. Premature stable releases also create breaking-change pressure.

Three questions need resolution:
1. Which packages publish in MVP?
2. How are versions managed across the monorepo?
3. What tooling and mechanics handle releases?

---

## Decision

### Scope

All packages are published to npm under the `@stategraph` npm organization scope.

### MVP published packages (stable)

These six packages ship as stable `0.x.y` releases in MVP:

```
@stategraph/core
@stategraph/react
@stategraph/dom
@stategraph/testing
@stategraph/inspect
@stategraph/model-check
```

### Post-MVP packages (stubbed in monorepo, not published)

These packages live in the repo but are explicitly marked as not ready for consumption:

```
@stategraph/vue
@stategraph/angular
@stategraph/solid
@stategraph/svelte
@stategraph/scxml
@stategraph/migrate-xstate
```

Stubs must include a `README.md` with a `> ⚠️ Not yet published. See roadmap.` notice and must set `"private": true` in their `package.json` to prevent accidental publishing.

### Versioning

**MVP phase (`0.x.y`):** All published packages use lock-step versioning — they share the same version number and are released together. This simplifies compatibility reasoning ("use all `@stategraph/*` packages at `0.3.0`").

**Post-MVP:** Independent versioning per package once the API surface stabilizes. Adapter packages (React, Vue, etc.) will trail the core version cadence but are not required to match it exactly.

### Release tooling

Use `changesets` (`@changesets/cli`) for changelog authoring and version bumping:

```sh
pnpm changeset          # author a changeset during a PR
pnpm changeset version  # bump versions and update CHANGELOGs
pnpm changeset publish  # publish to npm
```

GitHub Actions flow:
1. Contributors add a changeset file per PR.
2. The `changesets/action` bot opens a "Release PR" aggregating all pending changesets.
3. Merging the Release PR triggers `changeset publish`.

### Publish flags and policies

```sh
npm publish --provenance    # supply-chain attestation via OIDC
```

- Pre-stable releases: `pnpm changeset --snapshot` publishes under a `@next` dist-tag.
- `sideEffects: false` in every `package.json` — no package registers globals.
- Adapter packages declare peer dependencies with ranges: `"react": ">=18.0.0"`, not exact versions.
- Published `files` field in `package.json` includes only `dist/`, `README.md`, and `package.json`. No source, no test fixtures.

### `package.json` checklist per published package

```jsonc
{
  "name": "@stategraph/core",
  "version": "0.1.0",
  "type": "module",
  "exports": { ... },       // see ADR-008
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "license": "MIT",
  "repository": { "type": "git", "url": "..." },
  "peerDependencies": {},   // populated for adapters
  "dependencies": {},       // only runtime deps, not dev/build
  "devDependencies": {}
}
```

---

## Consequences

**Positive:**
- Lock-step versioning in MVP eliminates "which adapter version works with which core version" support questions.
- `changesets` is the standard Turborepo monorepo release tool; no custom scripts needed.
- `--provenance` publish makes releases auditable via npm's supply-chain transparency features.
- Private stubs prevent accidental partial-release of incomplete adapters.

**Negative:**
- Lock-step versioning means a patch to `@stategraph/react` forces a version bump for all other packages. Acceptable in MVP; revisit post-MVP.
- All contributors must author a changeset per PR; this adds a small process step.

---

## Alternatives Considered

**A. Single `stategraph` package (monolithic)** — eliminates version matrix concerns but forces users to install all framework adapters even if they only use React. Violates the bundle budget goals.

**B. Independent versioning from day one** — correct long-term, but creates complexity in MVP where the API surface is still changing. Lock-step is the right trade-off at `0.x`.

**C. Manual release scripts** — `changesets` exists precisely to solve this problem in Turborepo monorepos. No reason to reinvent it.
