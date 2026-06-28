# Model Check Tasks

- [ ] Define `ModelCheckConfig`, `ModelCheckResult`, and `ModelCheckDiagnostic` public types.
- [ ] Implement ADR-006 default config and partial config merge.
- [ ] Implement machine/IR normalization input helper.
- [ ] Implement unreachable state detection.
- [ ] Implement dead state detection for non-final states with no outgoing transitions.
- [ ] Implement dead transition detection for superseded transition candidates.
- [ ] Implement invalid target detection.
- [ ] Implement nondeterministic transition detection.
- [ ] Implement missing initial declaration detection.
- [ ] Implement optional `effectsWithoutCancel` warning check.
- [ ] Implement opt-in bounded BFS/DFS with configured limits.
- [ ] Set `stats.hitLimit` when bounded analysis reaches any configured limit.
- [ ] Return stable diagnostics with code, severity, message, and location metadata.
- [ ] Add tests for each structural diagnostic.
- [ ] Add tests for bounded analysis completion and limit-hit behavior.
- [ ] Add tests proving warning-only results do not fail `passed`.
