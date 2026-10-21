import { afterEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { createWorkspace, saveRecord } from "../src/core/engine";
import { currentSnapshot, emptyDocument, uid } from "../src/core/model";
import {
  exportBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  Repository,
} from "../src/storage/repository";
import { setup } from "./helpers";
import native from "./fixtures/native-v2.json";
import legacy from "./fixtures/legacy-envelope-unverified.json";

const repos: Repository[] = [];
async function open(name = uid()) {
  const repo = await Repository.open(name);
  repos.push(repo);
  return repo;
}
afterEach(() => {
  vi.restoreAllMocks();
  repos.splice(0).forEach((r) => r.close());
});

describe("transactional persistence and backups", () => {
  it("persists, closes and reopens without losing records or computed values", async () => {
    const name = uid();
    const repo = await open(name);
    const initial = await repo.load();
    const { d, wid, cid, c } = setup();
    const record = {
      id: uid(),
      values: {
        [c.fields[0].id]: "Saved book",
        [c.fields[1].id]: 10,
        [c.fields[2].id]: 5,
      },
    };
    const next = saveRecord(d, wid, cid, record);
    const saved = await repo.save(next, initial.revision);
    repo.close();
    const again = await open(name);
    expect(await again.load()).toEqual(saved);
    expect(
      currentSnapshot((await again.load()).workspaces[0]).collections[0]
        .records[0],
    ).toEqual(record);
  });
  it("rejects cross-tab stale writes atomically", async () => {
    const name = uid();
    const first = await open(name),
      second = await open(name);
    const before = await first.load();
    const saved = await first.save(
      createWorkspace(before, "First tab"),
      before.revision,
    );
    await expect(
      second.save(createWorkspace(before, "Stale tab"), before.revision),
    ).rejects.toThrow(/Another tab/);
    expect(await second.load()).toEqual(saved);
  });
  it("round-trips strict native fixture with stable IDs, ancestry, and branch heads", () => {
    const imported = parseBackup(JSON.stringify(native));
    expect(parseBackup(exportBackup(imported))).toEqual(imported);
    expect(imported.workspaces[0].branches[0].head).toBe("commit-books");
  });
  it("restores native backup and retains the previous state in one transaction", async () => {
    const repo = await open(),
      initial = await repo.load();
    const existing = await repo.save(
      createWorkspace(initial, "Keep this"),
      initial.revision,
    );
    const restored = await repo.save(
      parseBackup(JSON.stringify(native)),
      existing.revision,
      true,
    );
    expect(await repo.beforeImport()).toEqual(existing);
    expect((await repo.load()).workspaces).toEqual(restored.workspaces);
  });
  it.each([
    '{"broken":',
    '{"app":"Foreign","exportedAt":"2026-10-20T00:00:00.000Z","document":{}}',
    JSON.stringify(legacy),
    '{"app":"Morph Infinity","__proto__":{}}',
  ])(
    "rejects corrupt, foreign, legacy, or malicious backups without writes",
    async (text) => {
      const repo = await open();
      const before = await repo.load();
      expect(() => parseBackup(text)).toThrow();
      expect(await repo.load()).toEqual(before);
    },
  );
  it("rejects oversized or deeply nested JSON", () => {
    expect(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toThrow(/5 MB/);
    expect(() => parseBackup("[".repeat(50) + "0" + "]".repeat(50))).toThrow(
      /deeply nested/,
    );
  });
  it("does not replace corrupt stored state on startup; exports raw recovery and restores deliberately", async () => {
    const name = uid();
    const db = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("documents");
      },
    });
    const raw = { format: 999, valuable: "preserve this" };
    await db.put("documents", raw, "current");
    const repo = await open(name);
    await expect(repo.load()).rejects.toThrow(/not been reset/);
    expect(JSON.parse(await repo.rawRecovery()).raw).toEqual(raw);
    expect(await db.get("documents", "current")).toEqual(raw);
    const restored = await repo.replaceDamagedData(
      parseBackup(JSON.stringify(native)),
    );
    expect(await repo.load()).toEqual(restored);
    expect(await db.get("documents", "damaged-recovery")).toEqual(raw);
    db.close();
  });
  it("cannot use the damaged-state recovery route to overwrite a valid document", async () => {
    const repo = await open();
    const before = await repo.load();
    await expect(repo.replaceDamagedData(emptyDocument())).rejects.toThrow(
      /normal import preview/,
    );
    expect(await repo.load()).toEqual(before);
  });
  it("rolls back import and its recovery slot when quota aborts the final write", async () => {
    const repo = await open(),
      before = await repo.load();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (key === "current")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(
      repo.save(createWorkspace(before, "Quota test"), before.revision, true),
    ).rejects.toThrow(/Quota/);
    expect(await repo.load()).toEqual(before);
    expect(await repo.beforeImport()).toBeUndefined();
  });
  it("refuses invalid writes and preserves the current state", async () => {
    const repo = await open(),
      before = await repo.load();
    await expect(
      repo.save({ ...before, format: 7 } as never, before.revision),
    ).rejects.toThrow();
    expect(await repo.load()).toEqual(before);
  });
});
