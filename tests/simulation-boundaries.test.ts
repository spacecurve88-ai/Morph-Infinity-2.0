import { afterEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { previewRecordRules, previewSimulation } from "../src/core/automation";
import { validateSnapshot } from "../src/core/validation";
import { validateRuleset } from "../src/core/rule-validation";
import { currentSnapshot, uid } from "../src/core/model";
import type { Snapshot } from "../src/core/model";
import { economicExample } from "../src/examples/economy";
import {
  Repository,
  exportBackup,
  parseBackup,
} from "../src/storage/repository";
import native from "./fixtures/native-v2.json";
afterEach(() => vi.restoreAllMocks());
function counter(count: number): Snapshot {
  return {
    collections: [
      {
        id: "counter",
        name: "Counter",
        fields: [
          { id: "n", name: "N", type: "number", unit: "number" },
          { id: "text", name: "Text", type: "text" },
        ],
        records: Array.from({ length: count }, (_, i) => ({
          id: `r-${i}`,
          values: { n: 1, text: "" },
        })),
        rules: [],
      },
    ],
    automation: {
      version: 1,
      rules: [
        {
          version: 1,
          id: "step",
          name: "Step",
          collectionId: "counter",
          enabled: true,
          trigger: { kind: "simulationStep" },
          actions: [
            {
              kind: "increment",
              fieldId: "n",
              value: { kind: "number", value: 1 },
            },
          ],
        },
      ],
    },
  };
}
describe("execution limits, upgrade evidence and adversarial boundaries", () => {
  it("rejects over 20,000 writes before publishing any input mutation", () => {
    const s = counter(7000),
      before = JSON.stringify(s);
    expect(() => previewSimulation(s, s.automation, 3)).toThrow(/change limit/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("bounds diff memory during collection, including repeated long string assignments", () => {
    const s = counter(600);
    s.automation!.rules[0].actions = [
      { kind: "setValue", fieldId: "text", value: "x".repeat(10000) },
    ];
    const before = JSON.stringify(s);
    expect(() => previewSimulation(s, s.automation)).toThrow(/memory limit/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("uses no runtime randomness or wall-clock read during simulation", () => {
    const s = economicExample();
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Unexpected clock read");
    });
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("Unexpected randomness");
    });
    expect(
      previewSimulation(s, s.automation, 2).snapshot.collections[0].records[0]
        .values.cash,
    ).toBe(4);
  });
  it("does not confuse reordered value keys, missing/null normalization or no-op edits with an update", () => {
    const s = counter(1),
      r = s.collections[0].records[0];
    s.automation!.rules[0].trigger = { kind: "recordUpdated" };
    const reordered = { id: r.id, values: { text: "", n: 1 } };
    expect(previewRecordRules(s, "counter", r.id, reordered).changes).toEqual(
      [],
    );
  });
  it("rejects legacy-managed date event triggers to prevent hidden legacy-to-general cascades", () => {
    const s = counter(1);
    s.collections[0].fields.push(
      {
        id: "status",
        name: "Status",
        type: "select",
        options: ["Open", "Done"],
      },
      { id: "captured", name: "Captured", type: "date" },
    );
    s.collections[0].rules.push({
      id: "legacy",
      triggerFieldId: "status",
      equals: "Done",
      setFieldId: "captured",
    });
    s.automation!.rules[0].trigger = {
      kind: "fieldChanged",
      fieldId: "captured",
    };
    expect(() => validateRuleset(s, s.automation)).toThrow(/cannot trigger/);
  });
  it("does not silently skip arithmetic errors in aggregated computed fields", () => {
    const s = economicExample();
    s.collections[1].fields.push({
      id: "broken",
      name: "Broken cost",
      type: "computed",
      formula: {
        kind: "binary",
        op: "/",
        left: { kind: "field", fieldId: "amount" },
        right: { kind: "number", value: 0 },
      },
    });
    const field = s.collections[0].fields.find((f) => f.id === "expenses")!;
    if (
      field.type !== "computed" ||
      field.formula.kind !== "aggregate" ||
      field.formula.op !== "sum"
    )
      throw new Error("bad fixture");
    field.formula.fieldId = "broken";
    expect(() => previewSimulation(s, s.automation)).toThrow(
      /Division by zero/,
    );
  });
  it("rejects unknown snapshot extension versions and computed values stored as records", () => {
    const s = economicExample();
    expect(() =>
      validateSnapshot({ ...s, automation: { ...s.automation, version: 2 } }),
    ).toThrow();
    s.collections[0].records[0].values.expenses = 7;
    expect(() => validateSnapshot(s)).toThrow(/computed/);
  });
  it("opens pre-extension IndexedDB data without a version bump or inserted defaults", async () => {
    const name = uid(),
      db = await openDB(name, 1, {
        upgrade(db) {
          db.createObjectStore("documents");
        },
      });
    await db.put("documents", native.document, "current");
    db.close();
    const repo = await Repository.open(name);
    try {
      const loaded = await repo.load();
      expect(loaded).toEqual(native.document);
      expect(currentSnapshot(loaded.workspaces[0])).not.toHaveProperty(
        "automation",
      );
      expect(parseBackup(exportBackup(loaded))).toEqual(native.document);
    } finally {
      repo.close();
    }
  });
});

it("invalidates aggregate caches at each frozen step boundary", () => {
  const s = counter(2);
  s.collections[0].fields.push({
    id: "total",
    name: "Total",
    type: "number",
    unit: "number",
  });
  s.automation!.rules.push({
    ...s.automation!.rules[0],
    id: "total",
    name: "Remember frozen total",
    actions: [
      {
        kind: "setNumber",
        fieldId: "total",
        value: {
          kind: "aggregate",
          op: "sum",
          collectionId: "counter",
          fieldId: "n",
        },
      },
    ],
  });
  const result = previewSimulation(s, s.automation, 3);
  expect(result.snapshot.collections[0].records[0].values).toMatchObject({
    n: 4,
    total: 6,
  });
});
