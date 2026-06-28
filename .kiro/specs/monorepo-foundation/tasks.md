# Monorepo Foundation Tasks

- [x] Scaffold root workspace manifests for package manager, Turborepo, TypeScript, ESLint, Prettier, Vitest, tsup, Vite, and changesets.
- [x] Add root scripts: `build`, `dev`, `test`, `test:watch`, `lint`, `format`, `format:check`, `check-types`, and `clean`.
- [x] Create `apps/`, `packages/`, and `examples/` workspace roots.
- [x] Scaffold MVP package folders for `core`, `testing`, `inspect`, `model-check`, `react`, and `dom`.
- [x] Scaffold private post-MVP stubs for `vue`, `angular`, `solid`, `svelte`, `scxml`, and `migrate-xstate` if package folders are created.
- [x] Add shared config packages for ESLint, TypeScript, and Vitest.
- [x] Configure strict TypeScript defaults with required compiler flags.
- [x] Configure tsup defaults for dual ESM/CJS package output.
- [x] Add package manifest template with `exports`, `main`, `module`, `types`, `files`, `sideEffects`, and license metadata.
- [x] Configure ESLint/import rules to prevent package deep imports and invalid dependency directions.
- [x] Configure changesets for lock-step MVP `0.x.y` package releases.
- [x] Add CI workflow or documented command sequence for install, format check, lint, type check, test, build, and package export validation.
