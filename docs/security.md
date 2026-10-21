# Security boundaries

User requests, imported JSON and proposal objects are untrusted. Strict Zod objects reject extra fields; identifiers reject prototype keys; bounded traversal precedes recursive parsing. Unknown operations, stale revision/branch IDs, duplicate IDs and names, missing parents, formula cycles, incompatible units, invalid values and dangling relations reject before writes. A plan cannot create prepopulated records or rules through the collection operation.

The evaluator interprets a small AST, never JavaScript. React escapes values. There is no eval, Function, raw HTML injection, telemetry, account, remote inference, or API key requirement. Numeric formulas and date capture are bounded trusted capabilities. Relations use restrict deletion. Date capture uses the device's local calendar date on a real status transition and never overwrites an already captured value.

JSON import has a 5 MB limit and requires approval before replacement. A same-transaction pre-import recovery copy remains accessible. Exported documents may contain personal data; users control their files. Browser IndexedDB is not encryption or a substitute for backups. Browser storage eviction and compromised same-origin scripts remain risks. A deployment should serve HTTPS and apply a restrictive CSP and other security headers; these are hosting responsibilities, not verified by a local development run.

The offline service worker caches application assets only. No workspace contents are cached by a remote service. No arbitrary generated modules, cross-origin integrations, scheduled notifications, or AI downloads are enabled.
