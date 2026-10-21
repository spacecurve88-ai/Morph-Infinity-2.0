# Morph Infinity — Codex Build Plan

**Prepared:** 20 October 2026  
**Existing deployed project:** https://morph-infinity.hatchable.site  
**Hatchable project identifier:** `proj_MxRwfiEc3BH9`  
**Confirmed existing deployment:** version 8 (read-only project inspection on 20 October 2026)

## 1. Objective

Develop Morph Infinity into a **reliable, local-first, iPad-friendly malleable software workbench**. A user describes a change in plain language; the software proposes a precise, typed feature plan, validates it, previews its effects, tests it, and applies it only after the user approves. Users can create different tools (such as a reading tracker, budget, project board, or personal database), extend them with useful behaviours, retain records, and branch/restore revisions. The app must work **without paid APIs or AI**; optional on-device inference may improve language understanding.

**Important scope boundary:** Genuine arbitrary application generation is a research goal, not the minimum viable product. The first release must be excellent at a bounded set of useful feature types and truthful about what it cannot do.

## 2. Verified starting point and migration implications

The current Hatchable version 8 consists of static client-side files, including:

- `public/index.html`, `public/style.css`, `public/app.js`, `public/engine.js`
- `public/planner.js`, `public/ai-plans.js`
- `public/local-ai.js`, `public/ai-worker.js`
- `public/lite-ai.js`, `public/lite-worker.js`

It currently has **no backend functions or database tables**. It stores workspace state in browser `localStorage` under `morph-infinity-v1`, with `state.format === 1`. Its backup export uses an envelope resembling `{ "app": "Morph Infinity", "exportedAt": "...", "state": { ... } }`. Its code offers templates, fields, tables/cards/boards, simple charts, per-entry timers, records, branches, partial version history, a typed computed-field planner, and opt-in local WebGPU/CPU model paths. These are *code-level observations*, not a claim that every feature has been verified on an actual iPad.

Important deficits to address:

1. Existing state loading can silently fall back to a new empty workspace when stored JSON is invalid.
2. Existing history checkpoints save schema/design snapshots, not full historical records; restoring a design is **not** restoring historical data.
3. Legacy branches do not have robust immutable commit ancestry or conflict-aware merges.
4. The existing typed planner supports a narrow set of computed/field operations; the legacy interpreter and AI command compiler cannot generate arbitrary new behaviours.
5. Runtime inference support on the actual target iPad is unverified; local model binaries can be large. The existing optional Qwen WebGPU and MiniLM CPU paths are candidates, not guaranteed features.

**Critical cross-origin limitation:** A new Codex-developed web app cannot directly read `localStorage` belonging to the Hatchable domain. Legacy user data requires the user's exported Morph JSON backup and a properly tested migration/import workflow. Never claim otherwise. Back up current user data before switching.

**Deployment distinction:** Hatchable's `AGENTS.md` imposes no-build, own-origin and SDK restrictions. Those restrictions apply only if deploying inside Hatchable. A new independent Codex/GitHub project can use Vite, TypeScript, React, Vitest and Playwright. Do not attempt to deploy this stack unchanged to Hatchable.

## 3. Recommended technical design

- **Target:** iPad Safari first, desktop browsers second. Responsive installable PWA where supported; no required native app or paid service.
- **App:** TypeScript with strict type checking, Vite, React, accessible components, restrained custom design system. Prefer few dependencies. Avoid expensive animations and excessive memory use.
- **Data:** IndexedDB using a small reliable wrapper such as `idb` or Dexie; versioned schemas, transactional writes, verification, error UI, JSON import/export, cross-tab conflict awareness, migration journal and deterministic IDs.
- **Trusted engine:** versioned allowlisted `FeaturePlan` JSON schema; static validation; formula AST evaluator; rules engine; views, filters, sorts, aggregations, typed relations, migration calculator, dry-run preview and reversible commits.
- **Revision model:** immutable commit graph with parent IDs; separate design and data snapshots/references; safe branching, design-only restore, full-state restore, and conflict-aware merging.
- **AI:** deterministic parser/editor as the required fallback; optional model adapter for proposal generation (not execution). Do not hardcode a model until tested on target hardware. Validate model output as hostile untrusted input.
- **Security:** no `eval`, `Function`, or generated HTML/JS execution in the main application origin; no unprompted outbound data transmission; explicit user consent for model downloads and external operations. Arbitrary custom code modules require a separately reviewed sandbox design.
- **Testing:** Vitest unit/property tests, browser end-to-end tests via Playwright, keyboard and touch flows, data corruption/recovery tests; Safari/WebKit automation where feasible plus honest manual iPad test checklist.

## 4. Delivery phases and acceptance gates

| Phase | Deliverable | Evidence required |
|---|---|---|
| **0 — Baseline and preservation** | Inspect supplied v8 source; document actual functions, limitations, export schema and current tests; establish Git repository and fixtures. | Untouched legacy JSON exported; import fixtures including corrupt and edge cases; clean baseline build. |
| **1 — Dependable core** | IndexedDB repository; validated legacy JSON importer; backup/export; real branch/commit/restore model; recovery UI. | Import/export round-trip preserves records, branch IDs and values; interrupted/corrupt import never overwrites current data; restore modes are distinct; no silent reset. |
| **2 — New behaviour engine** | Versioned FeaturePlan, strict schemas, formula calculations, typed conditions/actions, views, filters, sorts, time-based aggregations and relations. | Supported scenarios work end-to-end with saved data; invalid/stale/unauthorized plans reject without side effects; existing records survive compatible schema changes. |
| **3 — Interactive product UI** | Polished iPad-first application: workspace explorer, prompt composer, plan diff, live preview, data canvas, record inspector, branch/history browser, backup center and diagnostics. | Usable at 768–1024px touch widths; forms and previews are genuinely interactive; keyboard accessibility; no false-success indicators. |
| **4 — Optional local AI** | Compare existing deterministic parser, compact CPU semantic route, and WebGPU generative route against held-out tasks on supported devices. | Actual semantic success/failure, cold start, downloads and memory reported; consent/cancel/fallback work; no AI response directly executes. |
| **5 — Experimental custom modules** | Explore generated widgets/modules only inside a hardened separately isolated environment; permission broker and explicit approval. | Independent isolation tests show no unauthorized storage, parent DOM, network or API access. If not demonstrated, do not enable this phase. |

**Build order:** Ship phases 0–3 as a robust first product before prioritizing local AI or dynamic code generation. Each phase should be independently runnable and should have a git commit, tests and a clear readiness assessment.

## 5. Required demonstration scenarios

1. **Reading workspace:** create a books collection; add pages read and minutes; request reading speed in pages/minute; formula displays correctly and handles zero/null minutes.
2. **Abandonment tracker:** set status to Abandoned; automatically save an abandonment date once; show a monthly abandoned-books bar chart using actual record dates.
3. **Budget workspace:** add Income and Expenses numeric fields; add calculated Balance = Income - Expenses; sort, filter and change to table/card view without deleting data.
4. **Relational workspace:** create Books and Authors collections and connect Books to Authors; validate linked records, deletion behavior and branch restoration.
5. **Branching:** fork a workspace, change fields/records independently, compare revisions, restore just the design and restore design plus records explicitly, merge without silent conflict loss.
6. **Legacy migration:** import a representative v8 JSON backup containing several branches; export and reimport; verify identities, values, schema and ancestry preservation.
7. **Adversarial honesty:** requests for reminders, external API calls, deleting data or unsupported custom code must either generate a genuine supported, permitted implementation or return a clear 'not available' message **without claiming success or mutating data**.

## 6. Delivery artifacts

- Executable source repository and README with development/build commands.
- Architecture/decision record, project file map and `AGENTS.md` for future Codex sessions.
- JSON import/export specification and reversible migration notes.
- Test suite and browser compatibility matrix; recorded results rather than unsupported claims.
- A working installable/static web build and instructions for using a free hosting option if deployment is requested.
- Release notes, known limitations, next milestones and exact commands to resume work.

## 7. Cost, privacy and limitations

- Do not require any purchase, paid inference API, paid hosting, login, GitHub Actions paid minutes or mandatory native app installation.
- Static hosting free tiers and open-source dependencies are preferred but not guaranteed to remain unlimited; name constraints accurately.
- Keep user workspace content on-device by default and never send it to inference providers without explicit informed consent.
- An A16 iPad and Safari are target constraints, not proof that a particular WebGPU language model will work.
- A large model alone does not make Morph capable of arbitrary feature generation: the trusted execution engine must implement each supported operation.

## 8. Working with Codex

**Best route:** create a GitHub repository with the current Morph v8 source files (or upload a source ZIP to Codex), then submit the companion master prompt. Codex should first inspect the actual source and record verified facts. A live application URL does **not** give Codex authenticated source access. If the source is unavailable, Codex may implement a compatible clean-room foundation but must explicitly label it a rebuild, not a migration.

**First session success:** a running app with safe local persistence, working legacy import, at least one end-to-end generated feature, a clean UI and passing automated tests. Continue through remaining phases in future Codex sessions using the same repository and its `AGENTS.md`.