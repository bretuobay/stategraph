# @stategraph/model-check

Static structural analysis for StateGraph machine IR. Catches unreachable states, dead transitions, invalid targets, nondeterminism, and missing `initial` declarations at build or CI time — before they become runtime surprises.

## Installation

```sh
pnpm add -D @stategraph/model-check @stategraph/core
```

## Usage

```ts
import { check } from "@stategraph/model-check";
import { machine } from "./my-machine";

const result = check(machine); // or check(machine.toIR())

if (!result.passed) {
  for (const d of result.diagnostics) {
    console.error(`[${d.severity}] ${d.code}: ${d.message}`);
  }
}
```

## Checks

### Structural checks (on by default, O(V+E))

| Check | Code | What it catches |
|---|---|---|
| `unreachableStates` | `E001` | States that cannot be reached from the initial configuration |
| `deadStates` | `E002` | Non-final states with no outgoing transitions |
| `deadTransitions` | `E003` | Transitions that can never fire (dominated by a prior guard-free sibling) |
| `invalidTargets` | `E004` | Transitions that point to non-existent state IDs |
| `nondeterminism` | `W001` | Multiple unguarded transitions on the same event from the same source |
| `missingInitial` | `E005` | Compound states that declare children but no `initial` |

### Bounded reachability (opt-in)

BFS/DFS exploration of the reachable state space up to configurable limits. Disabled by default because it can be expensive for large machines.

```ts
check(machine, {
  bounded: {
    enabled: true,
    maxPathDepth: 20,
    maxStatesExplored: 10_000,
    maxTransitions: 50_000,
    maxCycleLength: 10,
    timeoutMs: 5_000,
  },
});
```

### `effectsWithoutCancel` (off by default)

Warns when a `fromPromise` or `fromCallback` effect is used in a state that has no explicit exit to cancel it. Disabled by default because many valid machines use fire-and-complete patterns.

## API

### `check(input, config?)`

```ts
function check(input: MachineIR | { toIR(): MachineIR }, config?: Partial<ModelCheckConfig>): ModelCheckResult
```

Returns a `ModelCheckResult`:

```ts
interface ModelCheckResult {
  passed: boolean;
  diagnostics: ModelCheckDiagnostic[];
  stats: {
    statesAnalyzed: number;
    transitionsAnalyzed: number;
    durationMs: number;
    bounded: boolean;    // whether bounded reachability ran
    hitLimit: boolean;   // whether a bound was reached before full exploration
  };
}
```

Each diagnostic:

```ts
interface ModelCheckDiagnostic {
  severity: "error" | "warning";
  code: string;           // E001–E005, W001, …
  message: string;        // human-readable description
  stateId?: string;       // affected state (where applicable)
  transitionSource?: string;
  transitionEvent?: string;
}
```

### `mergeConfig(partial)`

Merge a partial config with the defaults (all structural checks enabled, bounded off):

```ts
import { mergeConfig } from "@stategraph/model-check";

const config = mergeConfig({ checks: { nondeterminism: false } });
```

## CI integration

```ts
// vitest / jest setup file, or a standalone script
import { check } from "@stategraph/model-check";
import { machine } from "./src/machine";

const result = check(machine);
if (!result.passed) {
  throw new Error(
    result.diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"),
  );
}
```
