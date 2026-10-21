# Deterministic simulation delivery plan and PR #1 audit

Authoritative specification: `docs/codex-simulation-handoff.md` (read in full). Work continues on PR #1's `feature/deterministic-simulation-core` branch, with latest main merged in. The exploratory kernel is not production evidence.

## Audit

The draft's separate expression language, TypeScript-only validation, per-expression budget, repeated aggregate scans, incomplete target checks and absence of persistence/UI integration require replacement. Preserve the frozen-step approach and explicit conflict rejection. Re-run all real suites; five exploratory tests establish no release readiness.

## Milestones

1. M1: Extend the existing numeric AST with bounded sum/count aggregates and typed, optional correlated filters. Add strict version-1 trigger/condition/action/rule schemas, unit/reference/cycle checks and malicious-input tests. Keep format 2: an optional `snapshot.automation` extension is absent in old snapshots and is never inserted on read. Preserve legacy date rules and native fixture bytes/data; unknown fields/versions still reject without mutation.
2. M2: Replace the exploratory executor with pure frozen-step execution, fixed ID ordering, one global work budget, bounded output and explicit conflict handling. Add general workflow and economic fixtures plus 1/2/5/100-step, event, aggregate, error and immutability tests.
3. M3: Add typed rule-edit/simulation/record-change plans; revalidate revision and branch at approval, recompute previews and append one branch-local snapshot. Exercise transactional quota/stale-write rejection, history/restore and backup round-trip.
4. M4: Add accessible rule/condition/expression forms, enable/disable controls, bounded step input, sample/diff/error views and explicit Apply/Cancel. Route record-triggered side effects through the same approval preview. Offer the economic example as a proposed, separately identified collection/ruleset, never engine-specific behavior.
5. M5: Run npm ci, all unit tests, build, formatting and the full Chromium/WebKit suites including three touch sizes. Use GitHub-hosted CI where local network blocks WebKit. Merge PR #1 only after gates pass. Build the repository subpath, fast-forward the separate gh-pages branch, verify deployment and live simulation smoke tests. Record exact results and physical-device limits.

## Semantic choices

Simulation rules run only on explicit bounded steps; record events never cascade from rule writes. All reads in a step use its initial snapshot. Bankruptcy observes crossing zero on the next step; inactive-state conditions stop later cash updates. Two matched actions reserving the same target reject, including no-op assignments. Rule actions cannot modify computed values or legacy-managed dates. Numeric literals can carry explicit units; existing unitless literals retain their old semantics. Missing aggregate inputs are skipped, empty sums/counts are zero; arithmetic errors fail the whole preview. No random/clock reads in simulation. Legacy date capture uses the explicitly frozen local date of the user's record-change preview. No automatic migration, AI, external APIs, arbitrary execution or branch merging.
