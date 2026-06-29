# @stategraph/migrate-xstate

> **Post-MVP - not yet published.** This package is specified but not implemented.

XState to StateGraph migration tooling. This package provides analysis, best-effort conversion, codemods, and migration reports for teams moving from XState v4 or v5 to StateGraph.

It is compatibility tooling, not a runtime shim and not a core authoring surface.

## Scope

The package should help users understand and automate the safe parts of a migration while making unsupported features explicit.

```ts
import { analyzeXState, convertXState, runCodemod } from "@stategraph/migrate-xstate";

const analysis = await analyzeXState(["src/**/*.ts"]);
const result = await convertXState(sourceText);
await runCodemod({ files: ["src/**/*.ts"], write: false });
```

## API Contract

### `analyzeXState(files, options?)`

Scans source files and reports XState usage.

Required behavior:

- Detects XState v4 and v5 imports.
- Finds machine definitions, interpreted services, actors, guards, actions, services, invokes, delays, and subscriptions.
- Produces a machine-readable report with counts, file locations, migration complexity, and unsupported features.
- Does not modify files.

### `convertXState(source, options?)`

Converts a single source string when the source contains supported patterns.

Required behavior:

- Converts `createMachine(...)` to `setup(...).createMachine(...)` where safe.
- Moves inline guards, actions, and service implementations into `setup()` implementations when they can be named safely.
- Converts `interpret(machine)` to `createActor(machine)`.
- Converts `service.onTransition(...)` to `actor.subscribe(...)`.
- Preserves TypeScript syntax, comments, imports, and formatting as much as the selected AST library allows.
- Returns transformed source plus diagnostics.

### `runCodemod(options)`

Runs the migration over one or more files.

```ts
await runCodemod({
  files: ["src/**/*.ts", "src/**/*.tsx"],
  write: false,
  reportFile: "stategraph-migration-report.json",
});
```

Required behavior:

- Supports dry-run mode by default.
- Requires explicit `write: true` before modifying files.
- Produces a JSON report and optional human-readable Markdown summary.
- Is deterministic for repeated runs on the same input.

## Supported Conversions

Initial support should cover:

- `createMachine(config)` to `setup({}).createMachine(config)`.
- `createMachine(config, implementations)` to `setup(implementations).createMachine(config)`.
- Inline string action and guard references.
- Simple inline action and guard functions that can be extracted and named.
- `interpret(machine)` to `createActor(machine)`.
- `service.start()` to `actor.start()`.
- `service.stop()` to `actor.stop()`.
- `service.send(event)` to `actor.send(event)`.
- `service.onTransition(listener)` to `actor.subscribe(listener)`.
- `service.state` to `actor.getSnapshot()`.
- `state.matches("name")` to `snapshot.configuration.has("machine.name")` when the target machine ID is known.

## Unsupported Features

The tool must emit explicit diagnostics for features that are not safely converted:

- Dynamic machine construction that cannot be statically analyzed.
- Inline implementations that capture unsafe lexical state.
- History states.
- Activities.
- Actor spawning patterns without a StateGraph equivalent.
- XState invoke semantics that cannot map to StateGraph effects.
- Delayed transitions and cancellable sends when semantics differ.
- Custom interpreters, custom clocks, and scheduler internals.
- Code depending on exact XState state object internals.

## Report Shape

Migration reports must be suitable for CI and editor tooling.

```ts
interface MigrationDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  file: string;
  start?: number;
  end?: number;
  feature?: string;
  suggestedAction?: string;
}

interface MigrationReport {
  filesScanned: number;
  filesChanged: number;
  machinesFound: number;
  xstateVersion: "v4" | "v5" | "mixed" | "unknown";
  diagnostics: MigrationDiagnostic[];
}
```

## CLI Contract

The package should expose a CLI once implemented.

```sh
stategraph-migrate-xstate analyze "src/**/*.{ts,tsx}"
stategraph-migrate-xstate codemod "src/**/*.{ts,tsx}" --dry-run
stategraph-migrate-xstate codemod "src/**/*.{ts,tsx}" --write
```

CLI requirements:

- Dry-run is the default.
- `--write` is required for file edits.
- `--report json|markdown|both` controls report output.
- Exit code is non-zero when `--fail-on-unsupported` is set and unsupported features are found.

## Conformance Tests

The package must include tests covering:

- XState v4 import and API detection.
- XState v5 import and API detection.
- Supported machine conversion.
- Implementation extraction into `setup()`.
- Actor/service API conversion.
- Dry-run behavior with no writes.
- Write behavior in a temporary fixture.
- Unsupported-feature diagnostics.
- Stable JSON and Markdown report generation.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, fixture coverage, AST dependency review, and CLI safety checks are complete.
