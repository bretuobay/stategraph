---
inclusion: always
---

# Package Boundaries and Module Rules

These rules are absolute. Violations break the architecture and the publishing strategy.

## Hard boundaries

### `@stategraph/core`
- Zero framework dependencies (no React, Vue, Angular, Solid, Svelte).
- Zero browser globals (`window`, `document`, `navigator`).
- Zero test-framework imports.
- Zero imports from adapter packages.

### All packages
- Import only from a package's **public barrel** (`src/index.ts`). No deep imports like `@stategraph/core/src/internal/queue`.
- Packages never import from `apps/*`.
- Adapter packages may depend on `@stategraph/core` and one framework peer dependency only.

### Apps
- `apps/*` may depend on `packages/*`.
- Apps are deployment shells and integration surfaces; reusable logic belongs in packages.

## Module format (ADR-008)

All published packages emit dual ESM + CJS via tsup:

```ts
// packages/*/tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  clean: true,
})
```

File extensions: `.js` for ESM, `.cjs` for CJS, `.d.ts` + `.d.cts` for declarations.

Every published package must have a full `exports` map:

```jsonc
{
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false
}
```

## Publishing (ADR-007)

MVP publishes 6 packages: `core`, `react`, `dom`, `testing`, `inspect`, `model-check`.

All other packages must have `"private": true` in `package.json`. Do not remove this flag until the package is intentionally released.

Use `changesets` for versioning. All published packages use lock-step `0.x.y` versioning in MVP.
