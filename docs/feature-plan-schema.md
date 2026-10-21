# FeaturePlan version 1

The runtime schema is `planSchema` in `src/core/engine.ts`. A plan has exactly: `version: 1`, `baseRevision`, `workspaceId`, `branchId`, `summary`, and 1–10 `operations`. It applies only to the document revision and active branch that were previewed.

Allowlisted operations:

- `addCollection`: a strict empty collection definition, fields, no seeded records or rules.
- `addField`: collection ID and a strict typed field (text, number with unit, date, boolean, select, computed AST, or single-record relation).
- `captureDateOnce`: collection ID, select/text trigger, matching value, new date field, unique rule ID. Captures local date only on future transitions into the value, never overwrites a captured date and does not backfill existing matches.

Formulas have three node shapes: `{kind:"number",value:finiteNumber}`, `{kind:"field",fieldId}`, or `{kind:"binary",op:"+"|"-"|"*"|"/",left,right}`. Field references must resolve to numeric or computed fields; cycles, excessive depth/complexity and incompatible units reject. Unit dimensions combine for multiplication and division. Formula cells are derived, not stored.

`previewPlan` executes against a disposable clone and validates the resulting entire snapshot. Approval reruns the same validation and writes a new immutable commit through the repository's compare-and-swap transaction. Record edits, branches and restore controls use separate typed, validated operations and explicit controls, not natural-language authority.

## Deterministic automation extension

Version-1 plans also permit `upsertRule`, `removeRule`, `simulate`, `saveRecord`, and `addBundle`. Upsert/disable/remove modify the optional version-1 snapshot automation extension after approval. `addBundle` appends new collections/records/rules with full validation; it never replaces existing IDs. The economic example is ordinary data passed through that generic operation.

A simulation plan has exactly one `{type:"simulate",steps:1..100}` operation. It reads approved rules from the bound snapshot, returns step diffs, and recomputes at approval before one history commit. A record-change plan also has exactly one operation, with a strict record and explicit calendar date frozen at preview. It previews the user's edit plus single-pass record-rule effects. Both reject stale document revisions/branches. No-op simulations cannot append a misleading commit.

The shared Formula AST now supports explicit optional units on number nodes and `aggregate` sum/count nodes with typed literal/source-field/related-record filters. Runtime definitions and limits are in `src/core/contracts.ts`, `rule-validation.ts` and `automation.ts`; see `simulation-implementation.md`. Unknown shapes, versions and unsupported capabilities reject before writes.
