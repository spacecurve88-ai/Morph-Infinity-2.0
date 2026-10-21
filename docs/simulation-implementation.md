# Deterministic simulation engine — review branch

This branch adds an isolated `src/core/automation.ts` kernel and a Vitest suite.

## Execution contract
- Accepts a typed snapshot, rule definitions and a bounded number of steps (1–100).
- Evaluates all rules against the **start-of-step** snapshot; writes become visible together at the end of the step.
- Supports numeric field expressions, finite arithmetic, cross-collection sums, conditional comparisons, numeric assignments and select-state transitions.
- Rejects nonfinite values, division by zero, conflicting writes and unbounded change counts.
- Returns a preview and change log. It **never persists** or mutates input records.
- Rules are reusable for economics, task workflows and other domains; company terminology is not embedded in the engine.

## Integration work still required
1. Review and harden untrusted input validation: Zod schemas, expression-node limits, collection/field type checks, dimensional units, action safety and aggregate cost limits.
2. Create a versioned, validated plan format and safe persistence strategy. Do not silently change format-2 backups. Run old backup-import tests.
3. Expose visual rule creation, multi-step preview, approval and commit history in the workbench.
4. Validate entire resulting snapshot and all referential-integrity constraints before committing.
5. Add rollback, stale-revision and failure-injection tests, plus WebKit browser coverage.
6. Only then merge to `main` and publish the GitHub Pages build.

**This is deliberately a reviewable first engineering increment, not a completed user-facing feature.**
