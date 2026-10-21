import { openDB } from "idb";
import type { IDBPDatabase } from "idb";
import { z } from "zod";
import { boundedInput, emptyDocument, uid } from "../core/model";
import type { Document } from "../core/model";
import { validateDocument } from "../core/validation";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const envelopeSchema = z
  .object({
    app: z.literal("Morph Infinity"),
    exportedAt: z.iso.datetime(),
    document: z.unknown(),
  })
  .strict();
export function exportBackup(document: Document): string {
  return JSON.stringify(
    {
      app: "Morph Infinity",
      exportedAt: new Date().toISOString(),
      document: validateDocument(document),
    },
    null,
    2,
  );
}
export function parseBackup(text: string): Document {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("Backup exceeds the 5 MB limit.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Backup is not valid JSON. No data has been changed.");
  }
  boundedInput(raw);
  if (raw && typeof raw === "object" && "state" in raw)
    throw new Error(
      "Legacy v8 backups are not supported yet. Keep the original export; a real v8 fixture is needed to validate migration safely.",
    );
  return validateDocument(envelopeSchema.parse(raw).document);
}
export class Repository {
  private constructor(private db: IDBPDatabase) {}
  static async open(name = "morph-infinity-2"): Promise<Repository> {
    const db = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("documents");
      },
      blocking() {
        db.close();
      },
    });
    const tx = db.transaction("documents", "readwrite");
    const exists = await tx.store.getKey("current");
    if (exists === undefined) await tx.store.add(emptyDocument(), "current");
    await tx.done;
    return new Repository(db);
  }
  async load(): Promise<Document> {
    const raw = await this.db.get("documents", "current");
    if (raw === undefined)
      throw new Error(
        "Workspace data is missing. Restore a backup; no reset has been performed.",
      );
    try {
      return validateDocument(raw);
    } catch {
      throw new Error(
        "Stored data failed validation. Download the recovery copy before restoring a known-good backup. Your stored data has not been reset.",
      );
    }
  }
  async rawRecovery(): Promise<string> {
    return JSON.stringify(
      {
        app: "Morph Infinity recovery",
        exportedAt: new Date().toISOString(),
        raw: await this.db.get("documents", "current"),
      },
      null,
      2,
    );
  }
  async beforeImport(): Promise<Document | undefined> {
    const raw = await this.db.get("documents", "before-import");
    return raw === undefined ? undefined : validateDocument(raw);
  }
  async save(
    next: Document,
    expectedRevision: string,
    preservePrevious = false,
  ): Promise<Document> {
    const validated = validateDocument({ ...next, revision: uid() });
    // Use compact JSON to bound persisted state and exported import size, including history.
    if (
      new TextEncoder().encode(exportBackup(validated)).length >
      MAX_BACKUP_BYTES
    )
      throw new Error(
        "Workspace history exceeds the 5 MB backup limit. Export your current data before continuing.",
      );
    const tx = this.db.transaction("documents", "readwrite");
    try {
      const current: unknown = await tx.store.get("current");
      if (
        !current ||
        typeof current !== "object" ||
        !("revision" in current) ||
        current.revision !== expectedRevision
      ) {
        throw new Error(
          "Another tab changed this workspace. Reload the latest version before saving; your edit has not been applied.",
        );
      }
      if (preservePrevious) await tx.store.put(current, "before-import");
      await tx.store.put(validated, "current");
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Transaction may already be aborted. */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
    return validated;
  }
  async replaceDamagedData(backup: Document): Promise<Document> {
    const validated = validateDocument({ ...backup, revision: uid() });
    if (
      new TextEncoder().encode(exportBackup(validated)).length >
      MAX_BACKUP_BYTES
    )
      throw new Error("Backup exceeds the 5 MB limit.");
    const tx = this.db.transaction("documents", "readwrite");
    const raw = await tx.store.get("current");
    // Recovery is allowed only when the current state actually fails validation.
    let valid = false;
    try {
      validateDocument(raw);
      valid = true;
    } catch {
      /* Preserve damaged bytes below. */
    }
    if (valid) {
      await tx.done;
      throw new Error(
        "Stored data is valid. Reload and use the normal import preview.",
      );
    }
    await tx.store.put(raw, "damaged-recovery");
    await tx.store.put(validated, "current");
    await tx.done;
    return validated;
  }
  close() {
    this.db.close();
  }
}
