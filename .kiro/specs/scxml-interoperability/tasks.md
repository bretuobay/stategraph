# SCXML Interoperability Tasks

- [ ] Define SCXML interoperability public types and package barrel exports.
- [ ] Implement `fromSCXML(xml)`.
- [ ] Implement `toSCXML(machine)`.
- [ ] Implement explicit diagnostics for unsupported SCXML constructs.
- [ ] Preserve hierarchy, parallel regions, history, transitions, and metadata where supported.
- [ ] Ensure adapter imports only from `@stategraph/core` public barrel.
- [ ] Add import, export, and round-trip tests for supported fixtures.
- [ ] Add tests for unsupported-construct diagnostics.
- [ ] Add tests proving deterministic output for supported fixtures.
