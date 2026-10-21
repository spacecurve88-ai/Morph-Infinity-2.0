# Rules and deterministic simulations

Open **Rules & simulations** in a workspace. The editor works without AI. Changes remain local to that browser; there is no hosted execution or recurring timer.

## Configure a rule

Choose **Add rule**, give it a name and collection, and select an explicit simulation step, record-created, record-updated, or field-changed trigger. Conditions can compare a field with a compatible value, compare numeric expressions, or compose bounded AND/OR groups. An always-match rule needs no condition.

Choose a writable field and action: set a number, increase/decrease it by an expression, set a compatible literal, or transition a select field from one of the selected states. Expressions use fields, typed numeric constants, arithmetic and sum/count across a collection. Aggregates can include every record, match a literal/source field, or select records linked to the current record through a relation. Computed fields and legacy-managed dates cannot be written. Use **+ Field → Computed expression** to create a derived cross-collection calculation directly.

**Preview rule** shows the readable definition and schema diff. Simulation rules also attempt a one-step sample against current data. A sample error is a warning that execution cannot currently complete; saving the definition does not apply the sample's record changes. Cancel leaves saved rules/data unchanged. **Approve & apply** saves one recoverable definition revision. Edit, enable/disable and remove use the same approval lifecycle.

When an explicit record edit has enabled event rules, **Save record** opens a combined edit-and-effects preview. Approve that preview to save the edit and all side effects atomically, or cancel to retain the previous record. Rule writes never generate recursive events or run in the background. Already matching records are not backfilled when a rule is added.

## Run a simulation

Choose 1–100 **Simulation steps**, then **Preview simulation**. A cancellable local worker computes the result. Inspect the affected-record count, ordered before/after changes and per-step summaries. The first 150 detailed changes are displayed; the complete resulting state is retained. No state changes until **Approve & apply** completes its IndexedDB transaction. A no-op run offers nothing to apply. Stale edits, conflicts, invalid expressions, exceeded limits and storage failures report errors and retain the previous saved revision.

All reads use the start of each logical step. Writes publish together at the step boundary. A threshold can therefore respond on the following step. Conflicting attempted writes to the same field reject rather than choosing a winner. Different fields can update in the same step; those actions still read the initial values.

## Economic integration example

**Preview economic example** proposes two new collections and two generic rules. Approval adds them without replacing existing collections. The Companies collection has cash, employees, revenue, computed linked expenses, price and operational state. The separate Expenses collection links each cost to its company.

Starting values and expected results:

| Steps | Company A cash | A state | Company B cash |
| --- | ---: | --- | ---: |
| 0 | 10 | Active | 8 |
| 1 | 7 | Active | 10 |
| 2 | 4 | Active | 12 |
| 4 | -2 | Active | 16 |
| 5 | -2 | Bankrupt | 18 |
| 100 | -2 | Bankrupt | 208 |

Cash flow runs only for Active companies with positive starting cash. The threshold rule marks an exhausted company Bankrupt on the next step. Changing linked costs changes later calculations through ordinary aggregates; no economic logic exists in the engine. This is an integration test, not a forecasting or strategic optimization tool.

## Recover and preserve data

Fork a branch before experimenting. Simulations on one branch leave other heads unchanged. History comparison includes rule definitions. **Restore design only** restores fields/rules while retaining current record values and rejects incompatible changes. **Restore design + records** restores the selected entire snapshot. Both append a revision, preserving recovery history.

Native format-2 backups include new definitions in an optional versioned extension. Older native backups load unchanged. Unknown extensions/versions reject safely. New-rule backups need this app version or newer; keep exports before downgrading. Original Hatchable v8 migration remains unsupported pending genuine fixtures. The original Hatchable deployment is untouched.

See `simulation-implementation.md` for exact limits and semantics. Physical iPad evidence in the handoff covers the older six manual baseline checks only; the new simulation UI still requires physical-device confirmation, even when automated WebKit tests pass.
