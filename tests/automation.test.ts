import { describe, expect, it } from "vitest";
import {
  previewSimulation,
  previewRecordRules,
  SIMULATION_LIMITS,
} from "../src/core/automation";
import { economicExample } from "../src/examples/economy";
import type { AutomationRule, Formula, Snapshot } from "../src/core/model";
const records = (s: Snapshot) => s.collections[0].records;
const run = (s: Snapshot, n = 1) =>
  previewSimulation(s, s.automation ?? { version: 1, rules: [] }, n);
function simple(): Snapshot {
  return {
    collections: [
      {
        id: "items",
        name: "Items",
        fields: [
          { id: "n", name: "N", type: "number", unit: "number" },
          {
            id: "state",
            name: "State",
            type: "select",
            options: ["Open", "Done"],
          },
          { id: "flag", name: "Flag", type: "boolean" },
          { id: "date", name: "Date", type: "date" },
        ],
        records: [
          { id: "b", values: { n: 1, state: "Open", flag: false } },
          { id: "a", values: { n: 2, state: "Open", flag: false } },
        ],
        rules: [],
      },
    ],
    automation: {
      version: 1,
      rules: [
        {
          version: 1,
          id: "increment",
          name: "Increment",
          collectionId: "items",
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
describe("pure deterministic simulations", () => {
  it.each([1, 2, 5, 100])(
    "repeats %i steps identically with immutable inputs and no wall clock",
    (n) => {
      const s = economicExample(),
        before = JSON.stringify(s),
        first = run(s, n);
      expect(first).toEqual(run(s, n));
      expect(JSON.stringify(s)).toBe(before);
      const a = records(first.snapshot)[0],
        b = records(first.snapshot)[1];
      expect(a.values.cash).toBe(n < 4 ? 10 - 3 * n : -2);
      expect(a.values.state).toBe(n >= 5 ? "Bankrupt" : "Active");
      expect(b.values.cash).toBe(8 + 2 * n);
      expect(first.summaries).toHaveLength(n);
    },
  );
  it("freezes all reads for a step and stops inactive firms; crossing zero triggers next step", () => {
    const s = economicExample();
    expect(records(run(s, 4).snapshot)[0].values).toMatchObject({
      cash: -2,
      state: "Active",
    });
    expect(records(run(s, 5).snapshot)[0].values).toMatchObject({
      cash: -2,
      state: "Bankrupt",
    });
    expect(records(run(s, 100).snapshot)[0].values.cash).toBe(-2);
  });
  it("orders changes by stable rule, record and field IDs rather than input array ordering", () => {
    const s = simple(),
      other = structuredClone(s);
    other.collections[0].records.reverse();
    other.automation!.rules.reverse();
    expect(run(s).changes).toEqual(run(other).changes);
    expect(run(s).changes.map((c) => c.recordId)).toEqual(["a", "b"]);
  });
  it("rejects conflicts including no-op writes without changing inputs", () => {
    const s = simple();
    s.automation!.rules.push({
      ...s.automation!.rules[0],
      id: "noop",
      name: "No-op",
      actions: [
        {
          kind: "setNumber",
          fieldId: "n",
          value: { kind: "field", fieldId: "n" },
        },
      ],
    });
    const before = JSON.stringify(s);
    expect(() => run(s)).toThrow(/Conflicting/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("honors disabled rules, typed AND/OR conditions, transitions, booleans and fixed dates", () => {
    const s = simple(),
      rule = s.automation!.rules[0];
    rule.when = {
      kind: "any",
      conditions: [
        { kind: "compare", fieldId: "n", op: "gt", value: 1 },
        { kind: "compare", fieldId: "flag", op: "eq", value: true },
      ],
    };
    rule.actions = [
      { kind: "transition", fieldId: "state", from: ["Open"], to: "Done" },
      { kind: "setValue", fieldId: "flag", value: true },
      { kind: "setValue", fieldId: "date", value: "2026-10-20" },
    ];
    const next = run(s).snapshot;
    expect(records(next).find((r) => r.id === "a")!.values).toMatchObject({
      state: "Done",
      flag: true,
      date: "2026-10-20",
    });
    expect(records(next).find((r) => r.id === "b")!.values.state).toBe("Open");
    rule.enabled = false;
    expect(run(s).changes).toEqual([]);
  });
  it("uses related costs only for each company; empty sums/counts are zero and null inputs are skipped", () => {
    const s = economicExample();
    s.collections[1].records[0].values.amount = null;
    expect(records(run(s).snapshot)[0].values.cash).toBe(12);
    expect(records(run(s).snapshot)[1].values.cash).toBe(10);
    s.collections[1].records = [];
    expect(records(run(s).snapshot)[0].values.cash).toBe(14);
  });
  it.each([0, -1, 1.1, 101, Infinity, NaN])(
    "rejects invalid step count %s",
    (n) => expect(() => run(simple(), n)).toThrow(/step count/),
  );
  it.each(["zero", "overflow", "missing"] as const)(
    "fails atomically on numeric %s",
    (kind) => {
      const s = simple(),
        rule = s.automation!.rules[0];
      const expression: Formula =
        kind === "zero"
          ? {
              kind: "binary",
              op: "/",
              left: { kind: "number", value: 1 },
              right: { kind: "number", value: 0 },
            }
          : kind === "overflow"
            ? {
                kind: "binary",
                op: "*",
                left: { kind: "number", value: Number.MAX_VALUE },
                right: { kind: "number", value: 2 },
              }
            : { kind: "field", fieldId: "n" };
      rule.actions = [{ kind: "setNumber", fieldId: "n", value: expression }];
      if (kind === "missing") delete s.collections[0].records[0].values.n;
      const before = JSON.stringify(s);
      expect(() => run(s)).toThrow();
      expect(JSON.stringify(s)).toBe(before);
    },
  );
  it("enforces one global budget across rules, records, steps and aggregate scans", () => {
    const s = economicExample();
    expect(() =>
      previewSimulation(s, s.automation, 5, { workLimit: 50 }),
    ).toThrow(/work budget/);
    expect(() =>
      previewSimulation(s, s.automation, 1, {
        workLimit: SIMULATION_LIMITS.work + 1,
      }),
    ).toThrow(/work limit/);
    const large = simple();
    large.collections[0].records = Array.from({ length: 10000 }, (_, i) => ({
      id: `r${i}`,
      values: { n: 1 },
    }));
    large.automation!.rules[0].actions = [
      {
        kind: "setNumber",
        fieldId: "n",
        value: {
          kind: "aggregate",
          op: "sum",
          collectionId: "items",
          fieldId: "n",
        },
      },
    ];
    expect(() => run(large)).toThrow(/work budget/);
  });
  it("rejects unvalidated inputs, invalid snapshots, unknown operations and resulting dangling relations", () => {
    expect(() =>
      previewSimulation(
        { collections: [] },
        { version: 1, rules: [{ foo: "untrusted" }] },
      ),
    ).toThrow();
    const s = simple();
    s.collections[0].records[0].values.fake = "unknown";
    expect(() => run(s)).toThrow();
  });
});
describe("single-pass explicit record events", () => {
  function event(kind: AutomationRule["trigger"]): Snapshot {
    const s = simple();
    s.automation!.rules[0].trigger = kind;
    return s;
  }
  it("runs recordCreated only for a newly created record", () => {
    const s = event({ kind: "recordCreated" }),
      r = records(s)[0];
    expect(
      previewRecordRules(s, "items", r.id, undefined).changes,
    ).toHaveLength(1);
    expect(previewRecordRules(s, "items", r.id, r).changes).toHaveLength(0);
  });
  it("runs recordUpdated only on changed explicit user edits and never cascades", () => {
    const s = event({ kind: "recordUpdated" }),
      before = structuredClone(records(s)[0]);
    records(s)[0].values.flag = true;
    expect(
      previewRecordRules(s, "items", before.id, before).snapshot.collections[0]
        .records[0].values.n,
    ).toBe(2);
    expect(
      previewRecordRules(s, "items", before.id, records(s)[0]).changes,
    ).toEqual([]);
    expect(run(s, 100).changes).toEqual([]);
  });
  it("fieldChanged requires an existing record and a real change to that field", () => {
    const s = event({ kind: "fieldChanged", fieldId: "state" }),
      before = structuredClone(records(s)[0]);
    expect(
      previewRecordRules(s, "items", before.id, undefined).changes,
    ).toEqual([]);
    records(s)[0].values.flag = true;
    expect(previewRecordRules(s, "items", before.id, before).changes).toEqual(
      [],
    );
    records(s)[0].values.state = "Done";
    expect(
      previewRecordRules(s, "items", before.id, before).changes,
    ).toHaveLength(1);
  });
  it("does not synthesize record events from simulation writes", () => {
    const s = simple();
    s.automation!.rules.push({
      ...s.automation!.rules[0],
      id: "event",
      trigger: { kind: "recordUpdated" },
      actions: [{ kind: "setValue", fieldId: "flag", value: true }],
    });
    expect(records(run(s, 2).snapshot)[0].values.flag).toBe(false);
  });
});
