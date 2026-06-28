# @stategraph/scxml

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

SCXML interoperability for StateGraph machines. Will provide import (SCXML XML → `MachineDefinition`) and export (`MachineDefinition` → SCXML XML) converters, enabling round-trip compatibility with other SCXML-compliant runtimes and visual editors.

## Planned API

```ts
import { fromSCXML, toSCXML } from "@stategraph/scxml";

// Import an SCXML document into a StateGraph machine definition
const machine = fromSCXML(xmlString);

// Export a StateGraph machine to SCXML
const xml = toSCXML(machine.definition);
```

## Status

Stub package. Not installable from the registry. Watch the repository for the SCXML milestone.
