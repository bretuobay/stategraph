# ADR-008: ESM-only vs Dual ESM/CJS per Package

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The TRD (§4.2) specifies: "Each published package must emit ESM output; CommonJS output where needed for ecosystem compatibility." The "where needed" is the decision point.

The consuming ecosystem in 2025/2026 includes:
- **Vite** (ESM-native, used by `apps/playground`, `apps/docs`, `apps/devtools`)
- **Vitest** (ESM-native in project config, but some CI setups still use CJS interop mode)
- **Jest** (still widely used without `--experimental-vm-modules`)
- **Angular's Webpack-based CLI** (webpack 5 can consume ESM but some Angular setups still use `require()` internally)
- **Next.js** (ESM + CJS depending on config and pages vs app router)
- **Node.js CLI tooling** (migration tools, model checkers) — can use `require()` or dynamic `import()` depending on the calling script

---

## Decision

**Dual (ESM + CJS) for all MVP packages.** Revisit for framework adapters post-MVP.

### Per-package breakdown

| Package | MVP format | Post-MVP plan |
|---|---|---|
| `@stategraph/core` | ESM + CJS | Remain dual — used in Node.js tooling, migration scripts, CLI |
| `@stategraph/testing` | ESM + CJS | Remain dual — consumed by Jest and Vitest setups |
| `@stategraph/inspect` | ESM + CJS | Remain dual — devtools bridges run in Node |
| `@stategraph/model-check` | ESM + CJS | Remain dual — CLI and CI scripting |
| `@stategraph/react` | ESM + CJS | Drop CJS post-MVP once Next.js CJS interop is less common |
| `@stategraph/dom` | ESM + CJS | Drop CJS post-MVP |
| Post-MVP adapters | ESM + CJS at launch | ESM-only once the Jest/CJS tooling landscape clears |

### tsup configuration

```ts
// packages/core/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: true,      // per-chunk tree-shaking for ESM
  treeshake: true,
  clean: true,
  external: [],         // core has no peer deps
})
```

For adapter packages, add framework peer deps to `external`:

```ts
// packages/react/tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  clean: true,
  external: ['react', 'react-dom'],
})
```

### `package.json` exports map

```jsonc
{
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

`"type": "module"` ensures `.js` output is treated as ESM. CJS output uses `.cjs` extension to avoid ambiguity regardless of the `type` field.

Separate `.d.ts` and `.d.cts` declaration files ensure TypeScript resolves types correctly under both `moduleResolution: "bundler"` and `moduleResolution: "node16"`.

### File naming convention

| Output | Extension | Reason |
|---|---|---|
| ESM | `.js` | Standard with `"type": "module"` |
| CJS | `.cjs` | Explicit; avoids ambiguity in mixed repos |
| ESM types | `.d.ts` | Standard |
| CJS types | `.d.cts` | Required for correct CJS type resolution in Node16 mode |

---

## Consequences

**Positive:**
- Dual format eliminates the most common support issue: "it works in Vite but breaks in Jest."
- tsup handles both outputs in one build step; cost is negligible.
- Correct exports map supports `moduleResolution: "bundler"` (Vite/Next) and `"node16"` (strict Node.js tooling) simultaneously.

**Negative:**
- Published package size roughly doubles (ESM + CJS + two sets of declaration files). Acceptable: the runtime is small, and `files` in `package.json` is scoped to `dist/`.
- Maintaining the post-MVP "drop CJS for adapters" plan requires a minor semver bump when CJS is removed. Lock-step versioning (ADR-007) means this affects all packages simultaneously; this is acceptable at a planned `1.0` milestone.

---

## Alternatives Considered

**A. ESM-only for all packages** — clean, future-proof, but immediately breaks users on Jest without ESM mode and Angular Webpack setups. Too early given the current ecosystem state.

**B. CJS-only** — would preclude tree-shaking and native ESM consumption in Vite/Rollup. Contradicts the bundle budget requirements in TRD §14.

**C. Per-package decision in MVP** — adds cognitive overhead and inconsistent DX ("why does `@stategraph/react` need a different Jest config than `@stategraph/core`?"). Uniform dual format is simpler to document and support.
