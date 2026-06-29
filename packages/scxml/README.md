# @stategraph/scxml

> **Post-MVP - not yet published.** This package is specified but not implemented.

SCXML interoperability for StateGraph machines. This package is compatibility tooling for import/export workflows, not a core authoring surface.

## Scope

The package converts between a supported SCXML subset and StateGraph machine definitions.

```ts
import { fromSCXML, toSCXML } from "@stategraph/scxml";

const result = fromSCXML(xmlString);

if (result.ok) {
  const xml = toSCXML(result.machine);
}
```

The first implementation should favor predictable diagnostics over broad partial conversion.

## API Contract

### `fromSCXML(xml, options?)`

Parses an SCXML document into a StateGraph machine definition.

```ts
const result = fromSCXML(xml, {
  id: "checkout",
  strict: true,
});
```

Required behavior:

- Returns a structured result with `ok`, `machine`, `diagnostics`, and optional source mapping.
- Does not throw for unsupported SCXML constructs in normal conversion mode.
- Supports strict mode that fails the result when diagnostics include unsupported constructs.
- Preserves stable state IDs and transition targets.
- Emits diagnostics with location, code, severity, and suggested remediation where possible.

### `toSCXML(machine, options?)`

Exports a StateGraph machine definition to SCXML XML.

```ts
const xml = toSCXML(machine.definition, {
  pretty: true,
});
```

Required behavior:

- Emits deterministic XML for stable snapshot tests.
- Exports only the supported subset.
- Emits diagnostics for unsupported StateGraph features when a lossless export is impossible.
- Supports pretty and compact output.

### `validateSCXML(xml, options?)`

Validates an SCXML document against the supported subset without producing a machine.

```ts
const validation = validateSCXML(xml);
```

## Supported Subset

Initial import/export support must cover:

- `<scxml>` root with `initial`.
- Atomic `<state>` elements.
- Nested compound states.
- `<parallel>` states.
- `<final>` states.
- Evented `<transition>` elements with `event`, `target`, and guard expression text.
- Initial transitions represented through StateGraph `initial`.
- Entry and exit action references when they can be represented as string action names.

## Unsupported Constructs

The package must diagnose, not silently ignore:

- Executable SCXML scripts and arbitrary XML payload mutation.
- Data model expressions that cannot map to StateGraph context.
- History states until StateGraph has explicit history-state support.
- Invoked services that cannot map to StateGraph effects.
- Delayed sends, cancellation, and internal event queues that do not match StateGraph semantics.
- XML namespaces or vendor extensions outside the supported subset.

## Round-Trip Requirements

Supported subset machines must round-trip:

```text
SCXML -> StateGraph definition -> SCXML -> StateGraph definition
```

Round-trip equivalence is structural, not byte-for-byte XML equality. Tests should compare normalized state IDs, initial states, transition topology, guard references, action references, and final states.

## Diagnostics Shape

Diagnostics must be machine-readable.

```ts
interface SCXMLDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
  location?: {
    line: number;
    column: number;
  };
  unsupportedConstruct?: string;
}
```

## Conformance Tests

The package must include tests covering:

- Supported subset import.
- Supported subset export.
- Supported subset round trips.
- Unsupported construct diagnostics.
- Strict-mode failures.
- Deterministic XML output.
- Invalid XML parse diagnostics.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, tests, parser dependency review, and XML security review are complete.
