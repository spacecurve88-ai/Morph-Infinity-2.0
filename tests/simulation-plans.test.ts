import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPlan,
  createWorkspace,
  previewPlanDetails,
  previewPlan,
  saveRecord,
  forkBranch,
  switchBranch,
  restoreCommit,
} from "../src/core/engine";
import { currentSnapshot, emptyDocument, uid } from "../src/core/model";
import type { AutomationRule, Document } from "../src/core/model";
import { basePlan } from "../src/planner/parse";
import { economicExample } from "../src/examples/economy";
import {
  Repository,
  exportBackup,
  parseBackup,
} from "../src/storage/repository";
function setup() {
  let d = createWorkspace(emptyDocument(), "Simulation");
  d = applyPlan(
    d,
    basePlan(d, d.workspaces[0], "Add economic example", [
      { type: "addBundle", snapshot: economicExample() },
    ]),
  );
  return d;
}
function plan(d: Document, steps = 5) {
  return basePlan(d, d.workspaces[0], `Run ${steps} steps`, [
    { type: "simulate", steps },
  ]);
}
const head = (d: Document) => currentSnapshot(d.workspaces[0]);
const repos: Repository[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  repos.splice(0).forEach((r) => r.close());
});
describe("approved plans, storage and rollback", () => {
  it("previews purely and applies N steps as exactly one branch-local commit", () => {
    const d = setup(),
      before = JSON.stringify(d),
      p = plan(d),
      preview = previewPlanDetails(d, p);
    expect(preview.simulation?.steps).toBe(5);
    expect(preview.changes).toHaveLength(10);
    expect(JSON.stringify(d)).toBe(before);
    const applied = applyPlan(d, p);
    expect(applied.workspaces[0].commits).toHaveLength(
      d.workspaces[0].commits.length + 1,
    );
    expect(head(applied)).toEqual(preview.snapshot);
  });
  it("rules require approval; edits/enabling/removal are versioned and do not backfill data", () => {
    const d = setup(),
      rule = head(d).automation!.rules[0];
    const p = basePlan(d, d.workspaces[0], "Disable rule", [
      { type: "upsertRule", rule: { ...rule, enabled: false } },
    ]);
    expect(head(d).automation!.rules[0].enabled).toBe(true);
    const changed = applyPlan(d, p);
    expect(head(changed).collections).toEqual(head(d).collections);
    expect(head(changed).automation!.rules[0].enabled).toBe(false);
    const removed = applyPlan(
      changed,
      basePlan(changed, changed.workspaces[0], "Remove rule", [
        { type: "removeRule", ruleId: rule.id },
      ]),
    );
    expect(head(removed).automation!.rules).toHaveLength(1);
  });
  it("record-change preview freezes the edit and event writes until a single approved commit", () => {
    let d = setup();
    const c = head(d).collections[0],
      record = c.records[0];
    const rule: AutomationRule = {
      version: 1,
      id: "event",
      name: "Reprice when employees change",
      collectionId: c.id,
      enabled: true,
      trigger: { kind: "fieldChanged", fieldId: "employees" },
      actions: [
        {
          kind: "setNumber",
          fieldId: "price",
          value: { kind: "number", value: 9, unit: "money" },
        },
      ],
    };
    d = applyPlan(
      d,
      basePlan(d, d.workspaces[0], "Add event rule", [
        { type: "upsertRule", rule },
      ]),
    );
    const edited = { ...record, values: { ...record.values, employees: 5 } },
      before = JSON.stringify(d);
    const p = basePlan(d, d.workspaces[0], "Edit and run rules", [
      {
        type: "saveRecord",
        collectionId: c.id,
        record: edited,
        date: "2026-10-20",
      },
    ]);
    const preview = previewPlanDetails(d, p);
    expect(preview.changes).toHaveLength(1);
    expect(JSON.stringify(d)).toBe(before);
    expect(
      head(applyPlan(d, p)).collections[0].records[0].values,
    ).toMatchObject({ employees: 5, price: 9 });
  });
  it("rechecks stale revisions and branches and rejects mixed execution plans", () => {
    const d = setup(),
      p = plan(d);
    expect(() => applyPlan({ ...d, revision: uid() }, p)).toThrow(/stale/);
    expect(() =>
      applyPlan(forkBranch(d, d.workspaces[0].id, "Other"), p),
    ).toThrow(/stale/);
    expect(() =>
      previewPlan(d, {
        ...p,
        operations: [...p.operations, { type: "simulate", steps: 1 }],
      }),
    ).toThrow(/exactly one/);
  });
  it("forks isolate simulation writes; design-only and full restore keep their distinct data semantics", () => {
    const d = setup(),
      w = d.workspaces[0],
      main = w.activeBranchId,
      prior = w.commits.at(-1)!;
    let fork = forkBranch(d, w.id, "Experiment");
    fork = applyPlan(fork, plan(fork));
    expect(head(fork).collections[0].records[0].values.cash).toBe(-2);
    expect(head(switchBranch(fork, w.id, main))).toEqual(head(d));
    expect(
      head(restoreCommit(fork, w.id, prior.id, "design")).collections[0]
        .records[0].values.cash,
    ).toBe(-2);
    expect(head(restoreCommit(fork, w.id, prior.id, "full"))).toEqual(head(d));
  });
  it("round-trips extended format-2 backups with definitions, IDs, history and results", () => {
    const d = setup(),
      applied = applyPlan(d, plan(d));
    expect(parseBackup(exportBackup(applied))).toEqual(applied);
  });
  it("rejects no-op simulations instead of reporting a committed result", () => {
    const d = createWorkspace(emptyDocument(), "Empty");
    const p = plan(d, 1);
    expect(previewPlanDetails(d, p).changes).toEqual([]);
    expect(() => applyPlan(d, p)).toThrow(/no data changes/);
  });
  it("quota failure and stale-tab collision preserve the entire document, rules and history", async () => {
    const repo = await Repository.open(uid());
    repos.push(repo);
    const initial = await repo.load(),
      d = await repo.save(setup(), initial.revision),
      p = plan(d);
    const original = IDBObjectStore.prototype.put;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        if (key === "current")
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, value, key);
      });
    await expect(repo.save(applyPlan(d, p), d.revision)).rejects.toThrow(
      /Quota/,
    );
    expect(await repo.load()).toEqual(d);
    spy.mockRestore();
    const newer = await repo.save(
      forkBranch(d, d.workspaces[0].id, "Other tab"),
      d.revision,
    );
    await expect(repo.save(applyPlan(d, p), d.revision)).rejects.toThrow(
      /Another tab/,
    );
    expect(await repo.load()).toEqual(newer);
  });
  it("preview errors and invalid definitions have no persistence side effects", async () => {
    const repo = await Repository.open(uid());
    repos.push(repo);
    const before = await repo.load();
    expect(() =>
      previewPlanDetails(before, {
        version: 1,
        operations: [{ type: "runJs", code: "evil" }],
      }),
    ).toThrow();
    expect(await repo.load()).toEqual(before);
  });
  it("legacy record operations remain functional without an automation extension", () => {
    const d = setup(),
      c = head(d).collections[0];
    const edited = saveRecord(d, d.workspaces[0].id, c.id, {
      ...c.records[0],
      values: { ...c.records[0].values, employees: 6 },
    });
    expect(head(edited).collections[0].records[0].values.employees).toBe(6);
  });
});
