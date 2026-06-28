# Inspect Trace Tasks

- [x] Define `TraceEnvelope`, `BaseTrace`, and `TraceEvent` TypeScript types.
- [x] Implement Zod schemas for trace envelope v1 and trace event v1.
- [x] Implement `UnsupportedSchemaVersionError`.
- [x] Implement `parseTraceEnvelope(raw)` with major-version dispatch.
- [x] Implement JSON serialize and deserialize helpers that validate on import.
- [x] Implement local inspector transport without browser-extension dependencies.
- [x] Export trace types, parser, errors, and helpers from the package barrel.
- [x] Add tests for valid trace envelopes and all MVP trace event kinds.
- [x] Add tests for unsupported major version rejection.
- [x] Add tests for invalid envelope and invalid event payload diagnostics.
- [x] Add tests for JSON round trip and local transport behavior.
