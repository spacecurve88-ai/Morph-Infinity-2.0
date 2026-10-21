# Architecture and initial evidence

The baseline (e4b180a) contained README and two plans, no executable source, manifests, tests, v8 backups or backend. This application is a clean-room successor. The deployed Hatchable project and its data are untouched.

React + strict TypeScript + Vite render a static client. `idb` provides transaction semantics; Zod validates every imported document and planned operation. The deterministic planner only proposes explicitly supported operations. No request executes JavaScript. The formula AST permits finite constants, numeric field references and bounded arithmetic; dimensional checks reject incompatible addition/subtraction. Missing inputs, zero division and overflow produce explicit empty results with reasons.

A format-2 document holds workspaces. Each workspace has named branches pointing to immutable commits. Each commit stores a full design-and-data snapshot and its parent ID. Editing appends a snapshot and advances only the active branch. Forking shares ancestry. Full restores append the selected snapshot; design-only restores retain current records and reject destructive or incompatible changes. Automatic merge is deliberately absent.

One IndexedDB readwrite transaction checks the expected document revision before replacing the root. This makes concurrent writes conflict rather than lose data. Import preserves the previous root in the same transaction. Validation failures, transaction aborts and quota failures leave the previous root intact. Opening malformed state never creates a replacement blank workspace. A recovery screen exports raw stored data and can restore a validated backup while retaining damaged state.

Limits are explicit: 5 MB backup, 20 workspaces, 30 collections per snapshot, 40 fields, 10,000 records, 30 branches, 200 commits per workspace, formula depth 12 and expanded node budget 100. Full snapshots favor auditability over scale. History compaction is a future feature; reaching a limit fails safely.

Risk inventory: legacy compatibility lacks evidence; Safari and physical iPad need separate verification; browser storage can be evicted so JSON exports remain necessary; snapshot history grows with edits; dependencies and offline caching need maintenance. AI, background reminders and arbitrary code are unsupported.

## Deterministic simulation phase

`src/core/contracts.ts` owns the shared expression, condition, trigger and action contracts. The optional version-1 snapshot `automation` extension preserves existing format-2 data without migrations or inserted defaults. `rule-validation.ts` validates units, reference graphs, typed predicates and writable targets. `automation.ts` is a pure bounded executor; no economic-specific branching, clock, randomness, recursive event delivery or storage lives there. The Companies/Expenses fixture resides in `src/examples/economy.ts`.

Generalized plans compose rule definitions, simulations and event-bearing record edits with the existing revision/branch checks and transaction boundary. `plan-worker.ts` runs preview and approval rechecks in a dedicated local worker. Cancelling a preview terminates the worker; no background recurring loop or partial persistent result exists. Only the main thread's existing compare-and-swap repository publishes an approved document.

UI responsibilities are split between `SimulationWorkbench`, recursive typed rule/expression editors, readable summaries and the existing plan/history/backup interface. Simulation diffs retain step summaries and a capped visible detailed list. The production service worker precaches the worker bundle. An explicit update notice offers a confirmed reload when a newer worker is waiting; saved data is retained and editing dialogs block the update button.
