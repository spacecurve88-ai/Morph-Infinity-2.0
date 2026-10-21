# Morph Infinity development

Read `Morph_Infinity_Codex_Master_Prompt.md` as primary product instructions and `Morph_Infinity_Codex_Build_Plan.md` as technical specification.

This is an independent successor. The repository initially contained only three Markdown files. No original v8 source or genuine legacy backup has been supplied. Never claim verified migration compatibility, access to another origin's storage, or iPad hardware validation.

Use the existing checkout; cloud tasks are already isolated. Do not create worktrees unless explicitly requested.

## Commands and map

Node 22.12+ (validated here with 24). `npm ci`; `npm run dev`; `npm run build`; `npm test`; `npm run test:e2e`. If the home npm cache is unwritable use `--cache /workspace/.cache/npm`. Browser tests use system Chromium when present; install Playwright WebKit with `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit`.

- `src/core`: strict contracts, validation, bounded formula AST, immutable snapshots, branch/restore operations, rules.
- `src/storage`: versioned IndexedDB, compare-and-swap, bounded JSON backups, import recovery.
- `src/planner`: deterministic allowlisted proposal parser. No AI or generated execution.
- `src/ui`: React workbench, record editor, previews, backups, history.
- `tests`: Vitest with fake IndexedDB; Playwright browser flows.
- `docs`: architecture, security, migration evidence, exact test outcomes and roadmap.

## Safety and scope

Keep all data on-device. No paid services, telemetry, model downloads, deployment, or remote inference by default. Never use eval, Function or raw HTML to execute proposals. All proposals need strict validation, a preview, explicit approval, and a transaction with stale-revision rejection. Imports must not silently reset data. Preserve old exports; do not weaken tests to claim compatibility. UI success follows completed durable writes. Keep design-only and full restore distinct. Optional local AI and arbitrary modules remain deferred.

Run relevant tests and build before committing stable progress. Record actual browser and manual-device coverage in `docs/test-matrix.md`. Follow `docs/roadmap.md` for remaining work; do not describe an incomplete first slice as a finished release.
