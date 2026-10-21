# Codex handoff — Morph Infinity 2.0 visual application builder

## Mission
Implement and deploy a genuine visual application builder on top of the existing deterministic Morph engine. Do not stop at planning. Use the current GitHub repository, inspect actual HEAD and existing UI, and preserve all format-2 user data, branching, restore, backups, simulations, and offline functionality.

## Product outcome
A user on iPad Safari can create a dashboard, place components in a responsive layout, bind components to collections/fields and simulation actions, preview changes, approve them, and restore an earlier version. The builder must be reusable for reading trackers, budget dashboards, project workflows, and economic simulations, with no application-specific hardcoding.

## Architecture
- Implement a strictly validated, versioned declarative UI schema (page, layout, component, binding, interaction) rather than executing arbitrary HTML/JS.
- Component primitives: headings/text, record tables, cards, data-bound metrics, charts, forms, buttons for explicitly allowlisted actions, and responsive sections.
- Bindings must reference validated workspace/collection/field IDs and existing safe computed values or aggregate functions. Missing references produce actionable errors, not silent failure.
- Interactive buttons may invoke only typed allowlisted actions: create/edit records, switch views, or preview simulation; never bypass existing approval/revision checks.
- Implement touch-first selection/reordering and property editing with accessible alternatives to drag-and-drop; no dependence on hover, mouse, keyboard, or paid services.
- Live preview is isolated from committed state. Approval produces an atomic branch-local revision; cancel changes nothing. Stale previews must fail safely.
- Maintain safe import/export and explicit migration if schema changes. Do not silently alter existing format-2 backup semantics.
- Bound component counts, nesting depth, query work, rendering costs and chart data. Reject malformed, oversized, cyclic or malicious schema.
- Keep the app functional offline and with no AI. Do not add external AI, arbitrary code execution, backend dependencies, or paid APIs in this phase.

## Milestones
M1. Inspect architecture, current deployed SHA, tests, and simulation integration. Produce a brief implementation plan and threat/compatibility assessment.
M2. Build and validate the declarative component and binding schemas; unit-test unsafe input, invalid references, missing data and bounds.
M3. Build an accessible visual page editor with templates, layout inspector, responsive preview and touch-safe controls.
M4. Integrate real data binding, forms, metrics, charts and allowlisted simulation actions. All writes require explicit approval and existing atomic persistence.
M5. Integrate version history, branching, design/full restore, export/import and offline caching; add regression and failure-injection tests.
M6. Run all unit tests, production build, formatting, Chromium and WebKit E2E including mobile/tablet widths. Fix failures. Publish to GitHub Pages only after gates pass and verify the live site.

## Acceptance scenarios
1. Reading dashboard: title, editable book table, reading-progress metric, monthly chart; save/reload/restore.
2. Budget dashboard: income, expenses, balance metric, filtered expense table and form; correct calculations and responsive layout.
3. Economic simulation control panel: company table, cash chart, bounded step control, preview, explicit approval and rollback. Reuse existing simulation engine; no special-case economic UI.
4. Branch an interface design, change layout, verify original branch remains unchanged; export/import roundtrip.
5. Cancel, invalid binding, stale revision, quota/storage failure, malformed input and offline reload never corrupt or silently discard data.
6. Touch-only use at 390px, 768px and 1024px in Chromium and WebKit; keyboard/VoiceOver-accessible controls. Physical iPad remains a manual user acceptance gate unless actually tested.

## Release reporting
Provide exact merged commit SHA, PR, CI run links, unit and browser pass/fail/skip counts, deployment workflow run and live URL. Clearly separate implemented capabilities from deferred functionality. Do not claim physical iPad validation without user testing. Leave original Hatchable deployment untouched.

## Scope control
Complete a genuinely usable, tested M2–M4 vertical slice before adding optional polish. If migration or storage risks arise, pause deployment and preserve the current live release. Update roadmap and README to reflect actual status.
