# Public HTTPS preview

The independent Morph Infinity 2.0 preview is hosted on GitHub Pages:

https://spacecurve88-ai.github.io/Morph-Infinity-2.0/

The original `https://morph-infinity.hatchable.site` deployment and its data are untouched. No custom domain was changed. This is a separate origin and cannot read the original deployment's localStorage. Records are local to each browser profile; they do not sync to the repository or between devices.

## Published artifact

- Application source: `0e3ef03030c66627428f41e87eeee119da424f08`.
- Static output branch: `gh-pages`.
- Initial artifact commit: `a85943865cb8ef03b63e9bfaed5342095621969f`.
- Build: `npm run build -- --base=/Morph-Infinity-2.0/`.
- Published directory: contents of `dist/`, with `.nojekyll` and a non-secret `deployment.json` source marker.
- GitHub Pages build/deployment: https://github.com/spacecurve88-ai/Morph-Infinity-2.0/actions/runs/39533785549 (completed successfully).

The base path is required for assets, manifest scope and the service worker on this repository project site. A plain root-path build is unsuitable for this URL. No application source modification was required for this deployment.

## Browser verification

`node scripts/verify-deployment.mjs` checks the public HTTPS URL by default. It creates isolated browser contexts and synthetic records only; it never reads a real user's browser profile. The check covers 390×844, 768×1024 and 1024×768 touch viewports for Chromium and WebKit, requiring HTTP 200, application rendering, workspace and record creation, approved calculation, reload persistence, no page overflow, offline reload and no uncaught page errors. Reports and screenshots are written to ignored `test-results/deployment/`.

The `Verify public preview` GitHub Actions workflow installs both browser engines and runs that check against the live site. It can also be started manually in the repository's Actions tab. This public repository uses GitHub's free public-repository Actions and Pages facilities, subject to their service limits.

To check another deployment explicitly:

```sh
MORPH_PREVIEW_URL=https://your-preview.example/ node scripts/verify-deployment.mjs
```

The local deployment preparation check passed all three viewports in Chromium against the exact Pages build, including retained records/calculated values and offline reload. The [public-site CI run](https://github.com/spacecurve88-ai/Morph-Infinity-2.0/actions/runs/39534068233) completed successfully: all six Chromium/WebKit viewport combinations passed against the live URL. See `docs/test-matrix.md` for scope and limitations.

## Test on iPad

Open the HTTPS URL in Safari once online. Create a workspace, approve a template, save a record, and reload to check persistence. Use Share → Add to Home Screen if offered. Export backups regularly using Backups & recovery: Safari may clear or evict browser storage, and private browsing has different retention behavior. Do not import original v8 backups yet; native format-2 backups are supported, while genuine v8 migration remains unverified.

WebKit automation approximates the engine and viewport, not real iPad Safari hardware, installation behavior, OS storage policy, memory pressure, VoiceOver or WebGPU. AI and model downloads remain disabled. Keep the original deployment and its backups until a tested migration is available.
