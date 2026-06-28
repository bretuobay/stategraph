# Inspect Trace Tasks

- [ ] Define `TraceEnvelope`, `BaseTrace`, and `TraceEvent` TypeScript types.
- [ ] Implement Zod schemas for trace envelope v1 and trace event v1.
- [ ] Implement `UnsupportedSchemaVersionError`.
- [ ] Implement `parseTraceEnvelope(raw)` with major-version dispatch.
- [ ] Implement JSON serialize and deserialize helpers that validate on import.
- [ ] Implement local inspector transport without browser-extension dependencies.
- [ ] Export trace types, parser, errors, and helpers from the package barrel.
- [ ] Add tests for valid trace envelopes and all MVP trace event kinds.
- [ ] Add tests for unsupported major version rejection.
- [ ] Add tests for invalid envelope and invalid event payload diagnostics.
- [ ] Add tests for JSON round trip and local transport behavior.
