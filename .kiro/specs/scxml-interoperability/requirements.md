# SCXML Interoperability Requirements

## Introduction

This spec defines `@stategraph/scxml`, the optional legacy interoperability package for converting between SCXML and StateGraph machine definitions. It remains outside the core runtime and is not a first-class authoring surface.

## Requirements

### Requirement 1: Import

**User story:** As a migration or tooling engineer, I want to import SCXML into StateGraph so that existing statechart assets can be reused.

#### Acceptance Criteria

1. WHEN `fromSCXML(xml)` is called THEN it SHALL convert supported SCXML documents into a StateGraph machine definition or intermediate representation.
2. WHEN the SCXML document contains unsupported constructs THEN the importer SHALL report them explicitly.
3. WHEN import succeeds THEN the result SHALL preserve state hierarchy, parallelism, history, transitions, and metadata where supported.

### Requirement 2: Export

**User story:** As a tooling engineer, I want to export StateGraph machines to SCXML so that I can interoperate with legacy editors and runtimes.

#### Acceptance Criteria

1. WHEN `toSCXML(machine)` is called THEN it SHALL emit SCXML for supported machine structures.
2. WHEN the machine contains unsupported constructs THEN the exporter SHALL report them explicitly rather than silently dropping them.
3. WHEN round-tripping supported machines THEN the result SHALL remain structurally consistent across import and export.

### Requirement 3: Boundaries

**User story:** As a maintainer, I want SCXML interoperability isolated so it does not shape the core runtime or primary authoring API.

#### Acceptance Criteria

1. WHEN the package imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the package is used THEN it SHALL remain optional and outside the core runtime dependency graph.
3. WHEN documentation references SCXML THEN it SHALL present the package as legacy interoperability rather than a primary authoring path.

### Requirement 4: Testing

**User story:** As a maintainer, I want conversion tests so the importer and exporter stay predictable.

#### Acceptance Criteria

1. WHEN package tests run THEN they SHALL cover import, export, round-trip, and unsupported-construct diagnostics.
2. WHEN supported fixtures are used THEN the output SHALL be deterministic.
