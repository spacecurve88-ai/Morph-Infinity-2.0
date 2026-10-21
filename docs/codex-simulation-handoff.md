# Codex engineering handoff — Morph Infinity 2.0, deterministic simulation phase
**Prepared:** 2026-10-20 (project handoff)  
**Repository:** https://github.com/spacecurve88-ai/Morph-Infinity-2.0  
**Live site:** https://spacecurve88-ai.github.io/Morph-Infinity-2.0/  
**Experimental draft PR:** https://github.com/spacecurve88-ai/Morph-Infinity-2.0/pull/1 (`feature/deterministic-simulation-core`)  

## 1. Mission
Finish and ship the next development increment: a **general-purpose, deterministic, typed rule + simulation engine** that works end-to-end inside Morph's existing workbench. Users should configure or request conditional actions, preview outcomes, explicitly approve, and create recoverable history commits. Reuse generic capabilities; do **not** hardcode an economic simulation. Do not begin local/remote AI, arbitrary JavaScript execution, external API access, notifications, or automatic branch merging in this phase.

## 2. Baseline and hard constraints
- The current production app is a React/TypeScript/Vite, offline-capable, IndexedDB-based **format-2** local-first application. Existing workspaces, history, branches, restored revisions, imports and exports must remain compatible. Existing Hatchable v8 legacy migration is **not** proven; do not claim or silently attempt it.
- User reports **all six manual physical-iPad checks passed**: creation of a reading collection, editing books, calculated fields, reload persistence, branch isolation, and JSON export. This is user-reported baseline evidence; it is not proof of other Safari behaviors.
- Current deployed original Hatchable Morph and current GitHub Pages 2.0 are different apps; **do not modify the Hatchable original**.
- No paid API, mandatory account, hosted execution backend, required native installation, or external AI model. Static GitHub Pages deployment must remain viable.
- Never allow generated model text/user-authored expressions to execute as JS or HTML. Use data-only, typed, validated plans.
- No unapproved writes. Avoid false success messages; distinguish proposal, validation, preview, actual commit, and deployed status.
- Protect browser-only storage: export and restore remain intact, never auto-reset on corruption, and preserve recoverability across failures.

## 3. Source map (verify against current HEAD)
- `src/core/model.ts`: Zod schemas for format-2 documents, workspaces, collections, existing date rules and formula AST.
- `src/core/validation.ts`: nested integrity checks, relations, formulas, records, histories.
- `src/core/formula.ts`: bounded numeric expressions, unit/dimension checks.
- `src/core/engine.ts`: feature-plan preview/apply, records, commit snapshots, branching, restoration.
- `src/planner/parse.ts`: existing limited natural-language requests.
- `src/storage/repository.ts`: transactional IndexedDB persistence, import and recovery.
- `src/ui/App.tsx` and related UI components: preview/approval and workbench.
- `tests/engine.test.ts`, `tests/storage.test.ts`, `tests/e2e/`: regression suite.
- `docs/architecture.md`, `docs/feature-plan-schema.md`, `docs/security.md`, `docs/roadmap.md`, `docs/deployment.md`: existing architecture and release constraints.
- PR #1 adds `src/core/automation.ts`, `tests/automation.test.ts`, `docs/simulation-implementation.md`. **Treat this as untrusted exploratory code; review it, replace it if necessary, and run the real project suite.** A previous claim of five passing standalone local tests does not establish repository Vitest, TypeScript, or browser compatibility.

## 4. Immediate procedure
1. Sync latest `main`; inspect README, roadmap, schemas, UI, tests, and PR #1 diff before coding. Check CI / actual GitHub branch state.
2. Create a short written implementation plan, noting changes to format-2 and recovery. Then implement; do not stop at design.
3. Work on the PR branch or create a clean replacement branch and reference/close PR #1 clearly. Do not merge a failing or unreviewed draft. Keep all updates committed and pushed.
4. Run unit tests, production typecheck/build, formatting and browser tests after meaningful milestones. Fix failures.
5. Show a reviewable draft preview before applying any data changes in the UI; maintain end-user approval gates.
6. Once acceptance gates pass, merge safely, verify GitHub Pages workflow and live HTTPS site, and report exact commit SHA, test outcomes, residual caveats, and live URL. No force pushes or silent history replacement.

## 5. Feature specifications

### A. Versioned rule model
Implement a bounded, versioned **declarative** rule language with IDs and explicit:
- Trigger: record created/updated; field changed; or explicit **simulation step**. Make semantics unambiguous, including whether rules run on already-matching records or only on transitions.
- Conditions: typed field comparisons, numerical threshold tests, boolean composition (AND/OR with bounded depth), and named field references. Unsupported conditions must fail clearly.
- Actions: set compatible numeric/select/boolean/date fields, numeric increments/decrements using finite formula expressions, and safe state transitions. Allow a rule to use a cross-collection aggregate in expressions subject to cost and reference validation.
- Conflict policy: deterministic order or explicit rejection of two rules writing the same target in the same step. Document policy and test it. Prevent recursive event loops and unbounded cascades.

The current old `captureDateOnce` behavior MUST remain correct. Prefer translating legacy rule schemas into a runtime representation instead of breaking old saved workspaces. Do not silently break format-2 backups or overwrite unknown data. If new schema version is necessary, implement explicit migration + tested backward compatibility + export semantics, or keep new definitions in a compatible versioned extension where safe.

### B. Simulation executor
- Implement `previewSimulation(snapshot, ruleset, steps)` or equivalent pure, deterministic interface.
- Freeze reads per logical step (or deliberately document and test another consistent model); atomic publication of writes at the step boundary.
- Fixed iteration order and explicit record IDs, no random or wall-clock dependencies by default; optional seed only if needed and explicitly specified.
- Bounded steps, rules, expression depth, aggregate work, modifications, and memory footprint; reject malformed/cyclic/unsupported inputs.
- Return step-by-step diff and final snapshot without mutating original input. Validate final snapshot and relation integrity before returning it.
- Distinguish simulation step from commit transaction: **one preview may cover N steps, but no persistent mutation occurs until approval**. Approved commit is a single recoverable, branch-local revision.
- Error handling: division by zero, nonfinite values, inconsistent units, missing fields/references, invalid select values, duplicate IDs, conflicting writes, quotas, and stale document revisions.
- A simulation must not quietly turn into an unbounded recurring browser loop.

### C. Aggregations and formulas
Extend existing safe AST rather than creating a separate inconsistent arithmetic language where possible. Include sum/count (and average only if sound) across records and linked collections, with explicit selection/filters if implemented. Validate target types and units; define empty-set / null semantics; cap computational cost. Include cross-collection tests and missing-reference errors.

### D. UI and plan lifecycle
- Users can add/edit a rule via an accessible iPad-friendly form even when no language model is available.
- Basic supported natural-language templates may compile into the exact same typed rules, but never invent unsupported behavior.
- Provide readable rule summary, rule enable/disable if supported, dry-run sample or step preview, before/after diff, number of affected records, and explicit **Apply** / **Cancel** controls.
- Provide a bounded step control (for example 1–10 default; configurable maximum based on performance), a progress/error view, and change details.
- Save approved changes through the existing IndexedDB transaction/revision check and commit history. UI must clearly distinguish “previewed”, “saved”, and “published”.
- Accessible, touch-sized controls and sensible narrow-screen layout; no off-screen Apply button or silent browser crash on iPad.

### E. Economic integration fixture (not bespoke code)
Use generic collection schemas to define a small company model with:
- Companies: cash/capital, employees, revenue, expenses, price, operational state (e.g. Active/Bankrupt).
- A deterministic step rule adjusting cash by revenue minus expenses.
- A threshold/state rule that marks a company Bankrupt when cash is exhausted; choose and document whether this occurs in the same step or the next based on frozen-step semantics.
- A cross-collection aggregate, such as summing costs from a separate Expenses collection.
- Repeatable N-step execution, differences by step, branch isolation, approval, restore and export/import.

Avoid claiming emergent economic intelligence, forecasting accuracy, or genuine strategic optimization: this example tests generic software behaviour, not real economic validity.

## 6. Concrete acceptance tests / release gates
- Existing 34 unit + 14 Chromium browser tests (baseline count as originally reported), **all actual current tests**, plus new tests pass. Do not assume original counts are unchanged.
- Same input + plan + seed/clock policy => identical final data and ordered change log. Inputs remain byte-equivalent after preview.
- Repeatable 1, 2, 5 and max-bounded step tests; multi-rule dependency/ordering verified.
- Trigger transitions and old abandonment-date once-only semantics behave correctly.
- Conflicting writes rejected or deterministically resolved per documented policy; never order-dependent accidentally.
- Validate invalid schemas, prototype pollution, unknown IDs, computed-field writes, formula cycles, divide-by-zero, overflow, unit mismatch, huge arrays, malicious inputs and excessive aggregate budgets.
- No unintended mutation on cancel, preview error, stale revision, quota exhaustion, tab collision, or failed storage transaction.
- Verify rollback/full restore, design-only restore, import/export roundtrip, offline reload, and existing data across upgrade; use fixtures generated from the current format-2 schema. Do not substitute fake v8 migration evidence.
- Browser E2E on Chromium **and WebKit** at mobile/tablet sizes (390, 768, 1024 or equivalent); check long rules, orientation, accessible buttons and no horizontal overflow. Physical iPad may require manual user confirmation: report that honestly.
- Run actual `npm ci`, `npm test`, `npm run build`, `npm run format:check`, `npm run test:e2e` with browser setup as appropriate; include exact results and any skipped suites.
- Verify GitHub Pages uses the repo subpath: existing instructions specify `npm run build -- --base=/Morph-Infinity-2.0/` for this deployment. Ensure service-worker scope and offline cache paths are correct. Confirm deployed SHA and smoke-test live URL.

## 7. Specific review risks in PR #1
Carefully check:
- No Zod schema validates externally supplied simulation rules; TypeScript types alone do not validate runtime input.
- Expression/evaluation budget resets per expression and cross-collection aggregation may cost more than expected; add global work budgets and meaningful limits.
- `sum` currently adds every record without optional filter and assumes each value is present and numeric; define missing-data semantics.
- All rules may act on all records on every step, including records whose state is Bankrupt. Define no-operation/exclusion rules explicitly in the example.
- Each-step reads are frozen: bankruptcy may trigger only one step after cash crosses zero. Explain/test this rather than implying immediate triggering.
- Same-step write conflict detection currently triggers even when a write would not change a value; determine the desired rule.
- No unit/dimensional validation or verification of complete resulting snapshot.
- No UI integration, preview→approval→commit, stale revision checks, or migration wiring.
- Tests were not run in the actual repository environment during exploratory work, and current GitHub Pages production is not updated by that branch.

## 8. Milestone order
**M1: Harden domain and validate rules** — safe AST / Zod schemas / unit and integrity checks; domain tests.
**M2: Simulate reproducibly** — bounded pure engine, aggregation, event semantics, robust tests.
**M3: Integrate into plans/transaction history** — preview, explicit approval, stale-revision rejection, atomic commit, restore and branch tests.
**M4: Build touch-first UI** — rule editor, run controls, before/after diffs, readable diagnostics.
**M5: E2E and release** — Chromium + WebKit, regression/migration checks, GitHub Pages publish, live smoke test.

Keep each milestone runnable and commit incremental progress. If limits make full scope infeasible, prioritize a complete and tested M1–M3 slice over broad but unverified features, and report precisely what remains.

## 9. Required final delivery report
- Exact implementation branch, PR, merged commit SHA, and GitHub Pages deployment link/run.
- Files changed and which generalized capabilities now work **in the UI**.
- Exact commands/tests run and pass/fail/skip counts; whether a physical iPad was tested.
- Economic integration scenario and expected vs observed results.
- Backup compatibility and failure/recovery evidence.
- Honest missing capabilities, risks and recommended next phase.

**Do not report success solely because a module compiles or five unit tests pass. The completion condition is an actually deployed, user-operable, recoverable deterministic simulation workflow.**
