# Backup format and migration evidence

Native backups use `{ "app": "Morph Infinity", "exportedAt": "<ISO timestamp>", "document": { "format": 2, "revision": "…", "workspaces": [] } }`. Strict schemas validate every field, record type, formula, relation and history edge before import. The import preview reports workspace/record counts and requires explicit replacement approval. The previous document is retained atomically as a pre-import recovery point. Imported identities, commits and branches are preserved; the root revision is refreshed to invalidate stale edits.

The documented v8 envelope is `{ "app": "Morph Infinity", "exportedAt": "…", "state": { "format": 1, "…": "unknown" } }`. Nested schemas and real exports were not supplied. A fabricated nested schema would endanger records. Legacy imports are therefore identified and rejected with an explanation, never guessed or silently reset. Provide a sanitized genuine backup and original source in a later task to implement and test migration. Synthetic legacy envelopes in tests establish safe rejection only.

The new origin cannot read the Hatchable origin's localStorage. Keep the original deployment and exported files until migration has been independently verified. Native exports should be downloaded regularly, particularly before full restore or import.
