# CODEX MASTER PROMPT — MORPH INFINITY NEXT

You are the lead software architect and implementation engineer for **Morph Infinity**, a local-first, adaptive software workbench. **Build an actual runnable application, not a mockup, static landing page, or high-level concept document.** You are authorized to inspect, create, edit, test and commit code in the accessible workspace. Do not assume access to credentials or services that are not connected.

## Mission

Turn Morph Infinity into an iPad-friendly application that lets a user create and evolve genuinely useful software through natural-language requests. Example:

1. "Build me a reading tracker."
2. "Add a timer for each book."
3. "Calculate reading speed using pages read and minutes read."
4. "When I mark a book abandoned, record today's date."
5. "Show how many books I abandoned each month."
6. "Try a different design on another branch without changing my existing records."

Each supported request must become a typed, testable feature plan. The app must explain what will change, preview the effects, and apply changes only after explicit approval. It must preserve existing data, allow reliable rollback, and be truthful about unsupported requests. **The goal is new working behaviour, not merely adding fields or displaying convincing but inert interface elements.**

## Existing project and source fidelity

There is a deployed Hatchable project at https://morph-infinity.hatchable.site, project ID `proj_MxRwfiEc3BH9`, currently version **8** as of 20 October 2026. Source files confirmed to exist:

- `public/index.html`, `public/style.css`, `public/app.js`, `public/engine.js`
- `public/planner.js`, `public/ai-plans.js`
- `public/local-ai.js`, `public/ai-worker.js`
- `public/lite-ai.js`, `public/lite-worker.js`

The current application stores `state.format === 1` under localStorage key `morph-infinity-v1`. It exports `{ app: "Morph Infinity", exportedAt: ISO_DATE, state: ... }`. It has templates, records, table/card/board views, timers, simple charts, branches, schema-only history, a limited typed computed-field planner, and two optional local-model strategies (WebGPU Qwen and CPU semantic embeddings). Current source code may not be in your workspace; **a live URL is not proof you can read or change the source**.

**First inspect the files actually available in the working directory.** If Morph v8 source or an archive is supplied, inventory it and reuse sound components and compatible data formats. If source is absent, build a clearly labeled independent successor and provide a backwards-compatible importer based on the documented export envelope and user-supplied examples; never claim a full, validated v8 migration without real fixtures. Do not overwrite the original deployed project or user data. If a supplied repository has unrelated code, keep it isolated.

Do **not** assume the Hatchable deployment rules govern an independent GitHub/Codex app. Hatchable disallows build steps and certain frameworks, but a standalone source repository may use a normal open-source front-end toolchain. Conversely, do not claim that a Vite/React build can be deployed directly into Hatchable unchanged.

## Nonnegotiable constraints

- **Zero mandatory payment:** no paid API, purchase, hosted model subscription, billing setup or mandatory paid hosting.
- **iPad/Safari first:** responsive touch interface for iPad A16 and modern desktop browsers; avoid mandatory native binaries. Make it usable without AI.
- **Local-first and private:** IndexedDB is the canonical data store; offline work after initial app load; user records never leave device by default. Model downloads, remote inference, deployment, telemetry and outbound integrations require explicit opt-in.
- **Data integrity:** never silently replace an invalid workspace with a blank one. Preserve legacy backups; validate imports before writing; give preview, recoverable failure, export, restore and clear error states. A different domain cannot directly access Hatchable's localStorage: importing exported JSON is required.
- **Security:** treat model text, feature plans, imported backups and custom components as untrusted. Never run model-generated JavaScript via `eval`, `new Function`, unsanitized HTML, or privileged same-origin injection. Never enable arbitrary generated code during the first release.
- **Honesty:** do not report success when only a field or placeholder was added instead of requested behaviour. Unsupported requests return clear errors with no side effects.
- **Practicality:** use free open-source libraries; keep the architecture understandable and testable. No speculative microservices, mandatory user accounts, or needless vendor integrations.

## Architecture — implement, don't merely describe

Use TypeScript (`strict`), React, Vite, IndexedDB with a small well-supported wrapper (`idb` or Dexie), Vitest and Playwright or equivalent open-source tooling. Prefer a static PWA architecture with no mandatory backend. Use a modular, typed codebase with boundaries at least for:

- `core`: versioned schema and operation contracts, formula AST and evaluator, condition/action rules, plan validation, revision control, and domain types;
- `storage`: IndexedDB transactions, migrations, typed repositories, import/export, backups, integrity and recovery;
- `planner`: deterministic intent/command parser, feature planning, preview/diff, compatibility analysis and optional model adapters;
- `ui`: workspaces, canvas/views, editor, command composer, preview review, timeline, branch selector, diagnostics and responsive styling;
- `tests`: unit tests, migration fixtures, adversarial plan tests and browser end-to-end tests.

Architecture should explicitly separate **untrusted proposal** from **trusted execution**:

```
User's instruction
  -> deterministic parser / optional model proposing a FeaturePlan
  -> strict JSON schema and capability validation
  -> static type and dependency checking
  -> dry-run on disposable branch and synthetic/real read-only fixtures
  -> visual diff, warnings, expected record effects and executable acceptance tests
  -> explicit user approval
  -> IndexedDB transaction and immutable commit record
  -> verified result, undo/restore metadata and durable export
```

Make a versioned, bounded `FeaturePlan` structure; reject malformed operations, unknown fields, cycles, excessively deep formulas, stale revision hashes, conflicting writes and unsupported capabilities. All state mutations must pass through deterministic validated operations and a transaction boundary. No implicit deployment, network I/O or data deletion via a model command. If requested behaviour cannot be implemented correctly, reject rather than approximate dishonestly.

## Features required for first substantial release

### A. Data and versioning

Create multiple collections and user-defined fields (text, number, money, date, boolean, select, timer, computed and relations); stable record IDs; create/edit/delete with confirmation and recovery options; independently editable branches; durable immutable commits with parent IDs; design-only restore and full design-plus-data restore as separate, explicit actions; branch comparison and conflict-aware merge when implemented. Implement validated legacy JSON import and versioned JSON export. Import must not damage currently open records if the file is corrupt, incomplete, oversized, incompatible or the browser storage quota is hit.

### B. A genuinely new behaviour engine

Support allowlisted typed operations that can build these behaviours end-to-end:

1. Computed fields with arithmetic expressions, dependency graph, null/zero handling and clear error values.
2. Conditional rules: on a supported record event, evaluate typed conditions and set fields using bounded, idempotent actions (for example, capture `abandoned_on` only once when status becomes Abandoned).
3. Sorting, filtering, derived views and grouping.
4. Aggregations and charts: counts/sums/averages and monthly groups, plus a working pie/bar visual representation when semantically appropriate.
5. Relations between collections with explicit referential integrity and deletion policy.
6. Interactive forms, tables, cards, kanban boards and a simple dashboard assembled from trusted component definitions.

Do not implement reminders or background notifications by merely adding date fields. Only call a reminder feature 'supported' if real scheduling/permission/delivery behaviour is implemented and verified. Otherwise present a precise unavailable message.

### C. Product design

Build a polished **software workbench, not a generic dashboard**. Use a workspace explorer on the left (collapsible for iPad), a prominent natural-language command bar, a central interactive application canvas, and a context panel for data/fields/preview/history. Include clear undo/redo where valid, branch tree/timeline, change diffs, implementation status, diagnostics, backup manager and empty-state onboarding. Explain features in plain language. Touch targets, responsive layouts, reduced-motion support, keyboard accessibility, readable typography, and nonblocking error states are mandatory. Avoid decorative animations that compromise memory or performance on iPad.

### D. Optional on-device AI — later phase

Keep AI disabled by default. The existing v8 project experiments with Qwen3-0.6B through WebGPU and a CPU MiniLM embeddings classifier; inspect and benchmark these only if source is available. Do not assume iPad Safari WebGPU inference will work simply because `navigator.gpu` exists. Use device checks, explicit consent and cancellation, show approximate download sizes, provide fallback to deterministic editors and do not send workspace contents remotely. Compare at least two inference approaches against a held-out semantic task suite before selecting any default. AI may **propose** typed plans; it cannot authorize or execute them.

### E. Experimental arbitrary modules — not part of the initial release

Place any later LLM-authored custom code behind an isolated, independently reviewed sandbox and narrowly defined capability permissions. Require a distinct execution origin, strong CSP, restricted messaging and network behaviour, memory/time limits, automated adversarial tests, explicit approval and rollback. If robust isolation cannot be demonstrated, ship without arbitrary code execution. Do not misrepresent the bounded feature-engine MVP as an unrestricted AI software generator.

## Required development phases

**Phase 0 — baseline and evidence.** Inspect supplied source, list actual working behaviour and deficits, inspect backup schema, initialize docs/AGENTS.md and version control, preserve examples; establish deterministic tests. Document absent sources explicitly.

**Phase 1 — runnable vertical slice.** Produce a polished standalone app that opens in a browser, saves data to IndexedDB, creates a workspace/collection/record, adds a computed field through a typed plan with preview/approval, exports JSON, and passes tests. Do not stop at project scaffolding.

**Phase 2 — data integrity and revision system.** Complete safe import/export, v8-compatible legacy import where evidenced, immutable commits, branches, correct restore semantics, conflict/error handling, and corrupt/quota tests.

**Phase 3 — rich behaviours and views.** Deliver typed rules, filters, sorting, monthly aggregation, charts, relations and interactive UI, each covered by real user-flow tests. Show unsupported feature errors honestly.

**Phase 4 — evaluated optional AI.** Only after phases 1–3 are stable, implement consent-based model adapters, held-out evaluation, Safari compatibility/fallback and real performance measurements.

**Phase 5 — research track.** Optional isolated custom-module experiments only after threat modeling and successful isolation tests; never block the reliable core product on this research.

Work **incrementally**, commit stable progress and keep the project runnable. You may continue autonomously through successive phases while resources permit; when the environment limits progress, finish a tested vertical slice rather than claiming the entire roadmap was completed. Do not request routine confirmations for implementation decisions; make reasonable, documented choices. Ask only when genuinely blocked by missing user-owned source, credentials, external permissions, or an irreversible operation.

## Mandatory functional acceptance tests

Automate these scenarios as much as possible and describe manual iPad checks when browser automation cannot establish real hardware compatibility:

- Create a Reading collection with Pages Read and Minutes Read. Request `Reading Speed = Pages Read / Minutes Read`; see correct values for normal, missing and zero inputs; save/reload/recalculate.
- Create status `Abandoned` rule to store the local date once; changing away and back does not unexpectedly overwrite the original date. Show number of books abandoned **by actual month** in a working chart.
- Create a Budget with Income, Expenses and calculated Balance; filter, sort, switch between table/cards and preserve records.
- Create Authors and Books with a typed relation; verify connected records, deleted-target policy and restore behavior.
- Fork a branch, independently edit schema and records, compare branches; restore design only versus design + historical data with clearly different results; reject unsafe merges.
- Import a valid historical Morph Infinity export; export/reimport it without changed record values or IDs. Reject corrupted, foreign or malicious JSON without destroying pre-import data.
- Request `Remind me three days before a deadline` when notifications are unsupported; app must explicitly decline, create no fake reminder and leave state untouched.
- Test formulas with cycles, unknown references, very deep expressions, invalid units, division by zero, and stale baseRevision; all must fail safely or return well-defined null/error results.
- Simulate storage unavailable, quota exceeded, cross-tab concurrent edits, failed migration and app restart; never silently return to a blank workspace.
- Test the main workflows on Chromium and WebKit; include clear manual iPad Safari tests for touch, orientation, storage, on-device model compatibility, memory and offline use.

Release gates: all automated deterministic data-integrity, security and migration tests must pass; no known false-success commands in the supplied adversarial suite; successful end-to-end reproduction of at least the Reading, Budget, Abandonment, branch and backup scenarios. Record exact test commands, results and any unavailable environmental capabilities. **Never fabricate passed tests, live deployment, local model execution or Safari measurements.**

## Repository deliverables and reporting

Create/maintain:

- Working complete project source, package manifest and scripts: development, production build, unit tests and browser tests.
- Clear README with exact setup, local usage, optional free hosting/deployment, iPad instructions and data recovery.
- `AGENTS.md` with stable constraints, project map, safe development workflows and outstanding work.
- `docs/architecture.md`, `docs/feature-plan-schema.md`, `docs/legacy-migration.md`, `docs/security.md`, `docs/test-matrix.md`, `docs/roadmap.md`.
- Fixture backups and versioned migration tests (never real personal data in the repository).
- Commit history with intelligible checkpoints, descriptions of what was actually implemented and how to revert.

At the end of each substantial step, state:
1. What was implemented and where.
2. How to run or view it, with commands/URL only if verified.
3. What tests ran and their results.
4. What still does not work and why.
5. The next highest-value development step.

**Begin now:** inspect workspace and available Morph source, produce the architecture and risk inventory, then implement Phase 1 immediately. Prioritize a **working tested app** over extensive speculative documentation. Continue to subsequent phases when safe and feasible.