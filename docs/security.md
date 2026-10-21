# Security boundaries

User requests, imported JSON and proposal objects are untrusted. Strict Zod objects reject extra fields; identifiers reject prototype keys; bounded traversal precedes recursive parsing. Unknown operations, stale revision/branch IDs, duplicate IDs and names, missing parents, formula cycles, incompatible units, invalid values and dangling relations reject before writes. A plan cannot create prepopulated records or rules through the collection operation.

The evaluator interprets a small AST, never JavaScript. React escapes values. There is no eval, Function, raw HTML injection, telemetry, account, remote inference, or API key requirement. Numeric formulas and date capture are bounded trusted capabilities. Relations use restrict deletion. Date capture uses the device's local calendar date on a real status transition and never overwrites an already captured value.

JSON import has a 5 MB limit and requires approval before replacement. A same-transaction pre-import recovery copy remains accessible. Exported documents may contain personal data; users control their files. Browser IndexedDB is not encryption or a substitute for backups. Browser storage eviction and compromised same-origin scripts remain risks. A deployment should serve HTTPS and apply a restrictive CSP and other security headers; these are hosting responsibilities, not verified by a local development run.

The offline service worker caches application assets only. No workspace contents are cached by a remote service. No arbitrary generated modules, cross-origin integrations, scheduled notifications, or AI downloads are enabled.

## Simulation-specific boundaries

Untrusted rule definitions receive strict runtime parsing before type/reference/unit validation. Simulation steps, condition/expression expansion, global execution work, writes and output bytes are bounded. Correlated aggregate filters are typed and can only read authorized same-workspace collection data. Computed-field cycles across collections reject. Arbitrary code, remote I/O, unbounded timers and recursive rule events remain unavailable.

Same-step write conflicts reject even for attempted no-op writes. Frozen reads and stable ASCII identifier ordering remove incidental evaluation order. Legacy date targets cannot be overwritten or used as hidden event triggers. Worker cancellation, preview errors and failed persistence do not publish partial snapshots. Rule sample failures are visibly separate from saving a valid rule definition; a sample's record changes are never committed by definition approval.
