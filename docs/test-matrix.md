# Validation evidence

Validated in this cloud machine with Node 24.19.0, npm 11.9.0 and system Chromium. These results apply to the current implementation, not the original Hatchable deployment or physical iPad Safari.

| Check | Outcome | Evidence |
| --- | --- | --- |
| `npm ci --cache /workspace/.cache/npm` | Passed | Fresh dependency installation from the committed lockfile; followed by build and unit tests |
| `npm run build` | Passed | Strict TypeScript compilation, Vite production bundle and PWA asset precache generation |
| `npm test` | 34 passed, 0 skipped | 21 core cases and 13 storage cases across two files; parameterized cases count individually |
| `npm run test:e2e -- --project=chromium` | 14 passed, 0 skipped | Production app, two workers, fresh isolated contexts |
| Development server | Passed | HTTP 200 and actual React first-load screen verified in isolated Chromium context |
| `npm run format:check` | Passed | Source, tests and configuration match Prettier formatting |
| `npm audit --omit=dev` | Passed | No production dependency advisories reported by registry |
| WebKit installation in this cloud workspace | Blocked | HTTP 403 `Domain forbidden` from `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`; no WebKit tests ran |
| Public HTTPS preview CI | 6 passed | Chromium and WebKit each passed 390×844, 768×1024 and 1024×768 against the live GitHub Pages URL |
| Physical iPad / Safari / WebGPU | Unrun | Device unavailable; no compatibility or model-performance claim |
| Genuine v8 migration | Unrun | Original source and real exports absent; synthetic envelope only establishes safe rejection |

## Deterministic coverage

Unit tests exercise plan preview without mutation, explicit apply, live calculations, missing/zero inputs, overflow, arithmetic precedence and nested dependencies, many finite arithmetic inputs, unknown/nonnumeric fields, incompatible units, cycles, excessive depth/expanded complexity, stale revisions/branches, unknown operations, extra properties, conflicting writes, unsupported requests without side effects, date capture once, no backfill, monthly grouping, branch isolation, immutable ancestry, distinct restore modes, unsafe design restore rejection, relation validation, restrict deletion and malformed document rejection.

Storage tests exercise close/reopen persistence, stale concurrent writes, fixture round-trip and stable IDs, atomic import with prior-state retention, corrupt/foreign/legacy/malicious/oversized/deep import rejection, damaged startup with no reset, raw recovery export, deliberate restoration with damaged-state retention, valid-state recovery-route rejection, quota-triggered transaction rollback including the recovery slot, and invalid-write rejection. Fake IndexedDB tests prove application transaction logic, not real Safari eviction behavior.

## Browser coverage (Chromium)

1. Reading records, plan sample preview, approval, normal/zero/missing calculations, reload persistence, downloadable export and native reimport.
2. Unsupported reminders leave records and revision counts unchanged.
3. Abandonment date captured once, read-only managed date and actual local-month chart.
4. Budget calculation, numeric sort, filtering, table/cards, preserved values.
5. Branch isolation, comparison and full restore.
6. Corrupt/legacy rejection, native replacement only after approval, recovery of the pre-import copy.
7. Two real tabs attempting stale edits; losing write rejects and winning record persists.
8. 768px and 390px layout, no page overflow, dialog focus and Escape dismissal.
9. Production service worker offline reload, existing records, new offline writes and another reload.
10. Design-only restore keeps current record values; full restore recovers historical ones.
11. User-created Authors relation, linked title display and referenced-target deletion rejection.
12. Simulated storage access denial opens recovery without a blank workspace.
13. Simulated quota failure leaves the prior saved record intact after reload.
14. Deliberately corrupted IndexedDB opens recovery, exports the raw stored object and restores a validated native fixture.

Screenshots were inspected at desktop and narrow widths. Browser automation is not manual assistive-technology or physical-device testing.

## Manual iPad checklist (all pending)

- Online first load and Add to Home Screen over HTTPS; relaunch offline after closing Safari.
- Landscape/portrait at 768–1024px; scroll wide tables without page overflow; tap targets and hardware keyboard.
- VoiceOver labels, modal focus/return, error announcements, contrast/readability and reduced-motion preference.
- IndexedDB blocked/private browsing, storage pressure/eviction, quota recovery and preserving an exported backup.
- Export to Files and native reimport; verify IDs and values in all branches.
- Background/relaunch and cross-tab conflicts without silent reset.
- Large record histories within documented limits and memory pressure.
- No inference, model download or WebGPU benchmark is currently enabled.

## Public preview verification

Live URL: https://spacecurve88-ai.github.io/Morph-Infinity-2.0/

GitHub Pages deployment succeeded in [run 39533785549](https://github.com/spacecurve88-ai/Morph-Infinity-2.0/actions/runs/39533785549). The published files exactly match the locally tested `dist/` built with `npm run build -- --base=/Morph-Infinity-2.0/`.

[Public-site browser verification run 39534068233](https://github.com/spacecurve88-ai/Morph-Infinity-2.0/actions/runs/39534068233) completed successfully. The `scripts/verify-deployment.mjs` check executed all six engine/viewport combinations: Chromium and WebKit at 390×844, 768×1024, and 1024×768 with touch emulation. Each required HTTP 200, application rendering, workspace/record creation, explicit computed-field approval, exact calculation value 3, records and calculations retained after reload, no page overflow, activated service worker, successful offline reload, and no uncaught JavaScript errors. Screenshots and structured results were uploaded as the workflow's `public-preview-verification` artifact (7-day retention).

The cloud workspace itself still cannot directly fetch the GitHub Pages hostname under its currently applied network policy. Public URL verification therefore ran in the repository's standard GitHub-hosted CI, not through this workspace. No TLS verification was disabled.

The complete product release gates are not met. Real legacy migration, the full browser suite on WebKit, and physical iPad checks remain outstanding. Successful automated WebKit smoke tests do not establish iPad hardware compatibility.
