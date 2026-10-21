# FeaturePlan version 1

The runtime schema is `planSchema` in `src/core/engine.ts`. A plan has exactly: `version: 1`, `baseRevision`, `workspaceId`, `branchId`, `summary`, and 1–10 `operations`. It applies only to the document revision and active branch that were previewed.

Allowlisted operations:

- `addCollection`: a strict empty collection definition, fields, no seeded records or rules.
- `addField`: collection ID and a strict typed field (text, number with unit, date, boolean, select, computed AST, or single-record relation).
- `captureDateOnce`: collection ID, select/text trigger, matching value, new date field, unique rule ID. Captures local date only on future transitions into the value, never overwrites a captured date and does not backfill existing matches.

Formulas have three node shapes: `{kind:"number",value:finiteNumber}`, `{kind:"field",fieldId}`, or `{kind:"binary",op:"+"|"-"|"*"|"/",left,right}`. Field references must resolve to numeric or computed fields; cycles, excessive depth/complexity and incompatible units reject. Unit dimensions combine for multiplication and division. Formula cells are derived, not stored.

`previewPlan` executes against a disposable clone and validates the resulting entire snapshot. Approval reruns the same validation and writes a new immutable commit through the repository's compare-and-swap transaction. Record edits, branches and restore controls use separate typed, validated operations and explicit controls, not natural-language authority.
