# Morph Infinity 2.0

A local-first software workbench for creating and evolving useful personal tools. This is an **independent successor**, built from the repository's implementation documents. The original Hatchable source and real legacy backups have not been supplied, and the existing deployment is untouched.

## Run locally

Node.js 22.12+ (developed with 24.19.0), npm, and a modern browser:

```sh
npm ci
npm run dev
```

Open the development server address printed by Vite. No account, API key, backend, payment, or model is required. If the npm home cache is unwritable in a cloud task, use `npm ci --cache /workspace/.cache/npm`.

```sh
npm test                         # deterministic domain and IndexedDB transaction tests
npm run build                    # strict TypeScript check + static/PWA build
npm run preview                  # serve the built app; offline caching works in this mode
npm run test:e2e -- --project=chromium
```

Browser tests use `/usr/bin/chromium` if available, otherwise Playwright's Chromium. Install browsers on a normal machine using `npx playwright install --with-deps chromium webkit`. In this cloud environment use `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` for downloaded browser storage. WebKit's download currently needs additional network domains; see [test coverage](docs/test-matrix.md). `npm run test:e2e` selects both Chromium and WebKit and requires both browsers installed. The browser tests serve an existing production build; run `npm run build` first.

## Try the workbench

1. Create a named workspace and preview a Reading tracker or Budget template; approve it.
2. Add and edit records. For Reading, enter a book, Pages Read, Minutes Read, and Status.
3. Request `Reading Speed = Pages Read / Minutes Read` (or `Calculate reading speed using pages read and minutes read`). Inspect the diff and live sample calculations, then approve. Zero or missing inputs show an explicit reason instead of a fabricated number.
4. Request `When I mark a book abandoned, record today's date`. Subsequent transitions to Abandoned capture the local date once and populate a monthly chart. Existing Abandoned records are not backfilled.
5. For Budget, request `Balance = Income - Expenses`. Filter records, sort numerically, and switch between tables and cards.
6. Use **+ Field** for text, number with units, date, boolean, select, or a single-record relation. Referenced records cannot be deleted until their links are removed. Use the composer for computed fields.
7. Fork a branch, edit independently, compare it in History & restore, and switch back. Design-only restore keeps current records and rejects incompatible changes; full restore restores historical records too. Both create a recoverable new revision. Automatic merging is not implemented.
8. Export JSON in Backups & recovery. Import native backups only after reviewing the replacement preview. The previous document is retained atomically and can be previewed and restored from that panel.

Requests outside the deterministic grammar explicitly fail without changing data. Reminders, external API calls, arbitrary code and AI are unsupported. This is an early working slice, not the complete roadmap.

## Rules and deterministic simulations

Open **Rules & simulations** to create/edit conditions and actions through forms, choose explicit record or simulation triggers, and enable/disable rules through preview and approval. Numeric expressions support arithmetic and sum/count across collections, including related-record filters. **+ Field → Computed expression** also exposes those calculations without a language model.

Choose 1–100 steps and **Preview simulation**. Inspect affected records, ordered before/after changes and step summaries; cancel to preserve current data or approve a single recoverable branch-local revision. Record edits with enabled event rules also preview their side effects before approval. Rule writes never recurse or run on a background timer.

**Preview economic example** adds separate Companies/Expenses collections and two ordinary rules. After five steps, Company A has cash −2 and state Bankrupt; Company B has cash 18. Frozen-step reads mean bankruptcy follows the zero crossing on the next step. This example is an integration fixture, not a forecast. See the [user guide](docs/simulation-guide.md) and [execution contract](docs/simulation-implementation.md).

## Data, recovery, and iPad use

IndexedDB is the canonical store. Data is private to this browser profile and origin; it does **not** sync between devices. Export JSON regularly: browsers can clear or evict storage. Native backups contain all workspaces, branch heads, immutable design/data snapshots and record IDs. Imports are limited to 5 MB. Current limits include 200 commits per workspace; see [architecture](docs/architecture.md).

Malformed stored data opens a recovery screen rather than a new empty workspace. Download the raw recovery copy, then choose a known-good native backup. That recovery route also retains damaged state locally. Quota and stale-tab failures keep the previous saved revision; close the editor and reload before retrying a stale edit.

Production builds cache app assets for offline use after the first successful online load. Serve over HTTPS (localhost is accepted during development). On iPad Safari, open the production app once online, then use **Share → Add to Home Screen** if available. The user reported the six original baseline iPad checks passed (creation, editing, calculation, reload, branch isolation and export). The new simulation UI, storage eviction, installability and WebGPU have not been physically verified; follow the [manual checklist](docs/test-matrix.md). No model download is enabled.

**Legacy v8 imports are intentionally blocked pending real fixtures.** Keep the original deployment and its backups. A new origin cannot read the Hatchable origin's localStorage. See [migration evidence](docs/legacy-migration.md).

## Build and hosting

`npm run build` creates `dist/`, a static application suitable for HTTPS static hosting such as Cloudflare Pages or Netlify under their current free-tier limits. Use build command `npm run build` and output directory `dist`; serve fallback routes to `index.html`. The independent [public HTTPS preview](https://spacecurve88-ai.github.io/Morph-Infinity-2.0/) is deployed on GitHub Pages; see [deployment details and verification](docs/deployment.md). For this GitHub Pages project URL, build with `npm run build -- --base=/Morph-Infinity-2.0/` so assets and the service worker use the repository path. Plain `npm run build` targets root-path hosting. A Vite build cannot be deployed unchanged inside Hatchable.

## Project documents

- [Master prompt](Morph_Infinity_Codex_Master_Prompt.md) — primary product instructions.
- [Development plan](Morph_Infinity_Codex_Build_Plan.md) — technical specification.
- [Architecture](docs/architecture.md), [typed plans](docs/feature-plan-schema.md), [security](docs/security.md).
- [Tests and device coverage](docs/test-matrix.md), [roadmap](docs/roadmap.md), [release notes](docs/release-notes.md).

Existing prototype: https://morph-infinity.hatchable.site. This repository does not modify it or its user data.
