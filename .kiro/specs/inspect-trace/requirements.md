# Inspect Trace Requirements

## Introduction

This spec defines `@stategraph/inspect`, the package that owns trace schemas, trace envelope parsing, serialization, import/export helpers, and local inspector transport foundation.

## Requirements

### Requirement 1: Trace Envelope

**User story:** As a devtools author, I want a versioned trace envelope so that saved traces can be parsed safely across schema changes.

#### Acceptance Criteria

1. WHEN a trace is exported THEN it SHALL be wrapped in a `TraceEnvelope`.
2. WHEN a trace envelope is created THEN it SHALL include `schemaVersion`, `sessionId`, `machineId`, `actorId`, `createdAt`, and `events`.
3. WHEN `schemaVersion` is assigned THEN it SHALL use `MAJOR.MINOR` format.

### Requirement 2: Trace Events

**User story:** As a debugger, I want structured trace events so that actor execution can be inspected and replayed.

#### Acceptance Criteria

1. WHEN trace events are emitted THEN each event SHALL include `seq`, `ts`, and `actorId`.
2. WHEN trace event types are defined THEN they SHALL use the reserved `@namespace.verb` pattern.
3. WHEN user event definitions are validated THEN event types beginning with `@` SHALL be rejected.
4. WHEN effects run THEN started, done, error, and cancelled trace events SHALL be representable.

### Requirement 3: Schema Validation

**User story:** As a replay tool, I want trace validation so that corrupt or incompatible traces fail before use.

#### Acceptance Criteria

1. WHEN `parseTraceEnvelope(raw)` is called THEN it SHALL validate the envelope with Zod.
2. WHEN an unsupported major schema version is parsed THEN it SHALL throw `UnsupportedSchemaVersionError`.
3. WHEN older minor versions omit optional fields THEN parsing SHALL tolerate them.
4. WHEN invalid payloads are parsed THEN validation SHALL fail with actionable diagnostics.

### Requirement 4: Import, Export, and Transport

**User story:** As a tooling engineer, I want trace utilities independent of browser extension APIs.

#### Acceptance Criteria

1. WHEN trace serialization helpers are used THEN output SHALL be JSON-compatible.
2. WHEN trace import helpers are used THEN they SHALL call `parseTraceEnvelope` before returning a trace.
3. WHEN local transport is implemented THEN it SHALL NOT depend on a specific browser extension runtime.
4. WHEN core emits trace events THEN inspect SHALL consume public trace contracts only.
