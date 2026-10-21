# Deterministic simulation acceptance matrix

The current suites retain the original 34 unit tests and 14 browser scenarios. The simulation increment adds 64 unit cases and 9 browser scenarios (the economic case has three explicit touch widths). No tests are skipped or disabled. Physical-device claims remain separate from automation.

## Reproducible gate commands

```sh
npm ci --cache /workspace/.cache/npm
npm test
npm run build
npm run format:check
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

The cloud workspace's applied network policy blocks WebKit downloads, so the full two-engine gate runs in the public repository's standard GitHub-hosted CI. [Simulation acceptance workflow and actual run results](https://github.com/spacecurve88-ai/Morph-Infinity-2.0/actions/workflows/simulation-checks.yml). npm ci, unit tests, build and formatting run there before browser setup. JSON reports, screenshots and traces are uploaded as `simulation-acceptance-results` with seven-day retention. `--max-failures=1` makes a failing CI run stop early; only a complete zero-failure/zero-skip run is a release gate. Playwright retries are disabled.

| Suite | Current case count | Required release outcome |
| --- | ---: | --- |
| `tests/engine.test.ts` | 21 | All pass |
| `tests/storage.test.ts` | 13 | All pass |
| `tests/rule-schema.test.ts` | 21 | All pass |
| `tests/automation.test.ts` | 24 | All pass |
| `tests/simulation-plans.test.ts` | 10 | All pass |
| `tests/simulation-boundaries.test.ts` | 9 | All pass |
| Unit total | **98** | 98 passed, 0 failed, 0 skipped |
| Chromium E2E | **23** | 23 passed, 0 failed, 0 skipped |
| WebKit E2E | **23** | 23 passed, 0 failed, 0 skipped |
| Full browser total | **46** | 46 passed, 0 failed, 0 skipped |

Local verification completed with 98 unit passes and 23 Chromium passes on Node 24.19.0/npm 11.9.0, plus build and formatting success. The earlier M4 two-engine CI gate also completed successfully with 89 unit cases and 44 browser cases before the additional release-boundary/pagination checks. Final merge requires the complete current counts above on the current implementation. Actual CI runs and artifacts establish the final result; a configured case count alone does not.

## Domain and storage evidence

- Strict versioned rules, triggers, actions and typed condition trees; numeric units; stored/computed targets; invalid select/date/reference rejection; duplicate IDs; conflicting/no-op write attempts; prototype keys, unknown schemas/versions and excessive arrays/depth.
- Shared AST sum/count, typed literal/source-field/related-record filters, empty/missing semantics, cross-collection cycles, arithmetic errors, overflows, correlated aggregate work and fixed-step ordering.
- Repeated 1/2/5/100-step outcomes; byte-equivalent original inputs; no clock/random reads; no event cascades; actual field transitions; old once-only abandonment dates; cache invalidation across step boundaries.
- Single-commit approval, stale revision/branch rejection, branch isolation, full/design-only restore, native backup identities/history/rules, failed persistence/quota/tab collisions, output/write/work limits and unchanged pre-extension IndexedDB documents.

## Browser evidence

Both engine projects execute all 14 baseline workflows: reading/budget formulas, reload, export/import, rejection honesty, legacy date chart, sorting/filter/cards, branches/restores, relation integrity, malformed/legacy imports, tab conflicts, narrow layout/focus, offline loading, denied/corrupt storage and quota recovery.

New scenarios run the economic preview/cancel/apply/reload/offline workflow at **390×1024, 768×1024 and 1024×1024**, including orientation change to 1024×768. Other cases exercise a non-economic field-change rule with explicit event-effect approval, form-created related aggregates, a long rule editor at 390×844, edit/disable/remove, sample errors/conflicts/no-op runs, branch isolation and both restore modes, extended backup round-trip, stale/quota simulation approval and 101-record old-format pagination/filtering. Baseline WebKit uses the desktop Safari preset; the dedicated simulation cases explicitly enable touch/mobile mode.

## Published-site gate

`node scripts/verify-deployment.mjs` checks HTTPS in Chromium and WebKit at **390×844, 768×1024 and 1024×768**. With `MORPH_EXPECTED_SOURCE_SHA`, it first requires the live `deployment.json` marker to match the merged source commit. Each combination must complete reading compatibility, economic creation, preview/cancel/apply, A cash −2/Bankrupt and B cash 18 after five steps, branch isolation, full rollback, reload persistence, offline reload, no page overflow and zero uncaught errors. Six successful combinations are required. Screenshots/results are attached to the public-preview workflow. This gate runs after publication, not before merging.

## Physical iPad and remaining manual work

The handoff records **user-reported success** on six previous baseline physical-iPad checks: reading collection creation, book editing, computed fields, reload persistence, branch isolation and JSON export. We did not independently repeat those hardware checks. They establish no claim about the new simulation interface.

Still pending on an actual iPad: new nested rule forms, orientation/touch/VoiceOver, long previews, install/update/relaunch behavior, storage eviction/private browsing/quota, memory pressure and export/import through Files. WebKit automation is engine coverage, not physical Safari/iPadOS certification. No model/WebGPU performance is claimed. Genuine Hatchable v8 source/exports remain absent; synthetic legacy envelopes only prove safe rejection.
