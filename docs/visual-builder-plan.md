# Morph Infinity 2.1 implementation plan

Baseline: simulation release acce101; latest main 722e801 adds the visual-builder handoff. The user's 2.1 mission and docs/codex-visual-builder-handoff.md guide this increment. User reports six physical-iPad simulation workflows passed; builder hardware coverage remains unverified.

1. M1: strict version-1 application/page/component/binding/action contracts; optional format-2 `applications` extension, no defaults or reinterpretation of old snapshots. Structural corruption rejects safely; missing live references become inspectable diagnostics rather than making the entire workspace unrecoverable.
2. M2: one controlled registry, generic recursive renderer, bounded typed queries using existing conditions/formulas, runtime selection/navigation, and an allowlisted dispatcher returning existing feature-plan operations. All persistent runtime writes use preview/approval and repository CAS.
3. M3: integrated Build/Run modes; page/component palette, selectable canvas, touch move/reparent/delete, property forms, shared condition/expression editors and isolated draft preview. Draft cancellation changes no stored state.
4. M4: approved application upsert/removal plans, revision-bound drafts, branch/history/design/full restore, native backups and offline worker integration. No IndexedDB upgrade or destructive migration.
5. M5: economic dashboard, task manager and resource simulation, composed only of generic documents, collections and rules. Add reading/budget compatibility dashboards as handoff acceptance fixtures.
6. M6: adversarial/budget/recovery and all-component unit tests; full Chromium/WebKit regression and complete demo workflows at 390/768/1024px; reviewable PR, gated merge, guarded Pages publish, source-checked live verification.

Limits: at most 5 applications per snapshot, 8 pages/application, 200 total nodes/application, nesting depth 6, 12 displayed fields/component, 100 displayed rows/component, 50 chart points and one shared 200,000-unit render budget. Existing 5 MB backup, 200-commit history and 100-step simulation limits remain. Queries fail visibly without partial writes. No arbitrary HTML/JS/CSS, URLs, external APIs, models or new data-mutation store.

Historical charts show available branch revision checkpoints, not invented intermediate values. No time/random dependencies in execution. A user-triggered existing rule action selects an enabled simulation-step rule and explicitly previews its one-step effects; event rules continue to run only on real record edits.
