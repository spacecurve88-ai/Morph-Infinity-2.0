import { describe, expect, it } from "vitest";
import { validateSnapshot } from "../src/core/validation";
import { validateRuleset } from "../src/core/rule-validation";
import { evaluate, validateFormula } from "../src/core/formula";
import type { AutomationRule, Formula, Snapshot } from "../src/core/model";
import { parseBackup, exportBackup } from "../src/storage/repository";
import native from "./fixtures/native-v2.json";
export const domain: Snapshot = {
  collections: [
    {
      id: "tasks",
      name: "Tasks",
      fields: [
        { id: "name", name: "Name", type: "text" },
        { id: "cash", name: "Cash", type: "number", unit: "money" },
        {
          id: "state",
          name: "State",
          type: "select",
          options: ["Open", "Done"],
        },
        { id: "flag", name: "Flag", type: "boolean" },
        { id: "date", name: "Date", type: "date" },
      ],
      records: [{ id: "t1", values: { cash: 10, state: "Open" } }],
      rules: [],
    },
    {
      id: "costs",
      name: "Costs",
      fields: [
        { id: "cost", name: "Cost", type: "number", unit: "money" },
        {
          id: "owner",
          name: "Owner",
          type: "relation",
          targetCollectionId: "tasks",
        },
      ],
      records: [
        { id: "c1", values: { cost: 2, owner: "t1" } },
        { id: "c2", values: { cost: null, owner: "t1" } },
      ],
      rules: [],
    },
  ],
};
export const basicRule: AutomationRule = {
  version: 1,
  id: "rule",
  name: "Set cash",
  collectionId: "tasks",
  enabled: true,
  trigger: { kind: "simulationStep" },
  when: { kind: "compare", fieldId: "cash", op: "lte", value: 10 },
  actions: [
    {
      kind: "setNumber",
      fieldId: "cash",
      value: { kind: "number", value: 5, unit: "money" },
    },
  ],
};
const wrap = (rule: unknown) => ({ version: 1, rules: [rule] });
describe("versioned declarative rule contracts", () => {
  it("preserves old format-2 native data without adding defaults or extensions", () => {
    const parsed = parseBackup(JSON.stringify(native));
    expect(parseBackup(exportBackup(parsed))).toEqual(native.document);
    expect("automation" in parsed.workspaces[0].commits[0].snapshot).toBe(
      false,
    );
  });
  it("accepts a strict optional versioned extension with numeric, state, boolean and date actions", () => {
    const rules = [
      basicRule,
      {
        ...basicRule,
        id: "other",
        actions: [
          { kind: "transition", fieldId: "state", from: ["Open"], to: "Done" },
          { kind: "setValue", fieldId: "flag", value: true },
          { kind: "setValue", fieldId: "date", value: "2026-10-20" },
        ],
      },
    ];
    expect(
      validateSnapshot({ ...domain, automation: { version: 1, rules } })
        .automation?.rules,
    ).toHaveLength(2);
  });
  it.each([
    { ...basicRule, version: 2 },
    { ...basicRule, extra: "untrusted" },
    { ...basicRule, collectionId: "unknown" },
    { ...basicRule, trigger: { kind: "externalApi" } },
    { ...basicRule, trigger: { kind: "fieldChanged", fieldId: "missing" } },
    {
      ...basicRule,
      when: { kind: "compare", fieldId: "state", op: "gt", value: "Open" },
    },
    {
      ...basicRule,
      when: { kind: "compare", fieldId: "flag", op: "eq", value: "true" },
    },
    {
      ...basicRule,
      when: { kind: "compare", fieldId: "unknown", op: "eq", value: 1 },
    },
    {
      ...basicRule,
      actions: [{ kind: "setValue", fieldId: "state", value: "Fake" }],
    },
    {
      ...basicRule,
      actions: [{ kind: "setValue", fieldId: "date", value: "2026-02-30" }],
    },
    {
      ...basicRule,
      actions: [
        {
          kind: "setNumber",
          fieldId: "cash",
          value: { kind: "number", value: 5 },
        },
      ],
    },
    {
      ...basicRule,
      actions: [
        { kind: "transition", fieldId: "state", from: ["Fake"], to: "Done" },
      ],
    },
    {
      ...basicRule,
      actions: [
        {
          kind: "setNumber",
          fieldId: "missing",
          value: { kind: "number", value: 5 },
        },
      ],
    },
    { ...basicRule, actions: [...basicRule.actions, ...basicRule.actions] },
  ])("rejects malformed or incompatible rule %j", (rule) =>
    expect(() => validateRuleset(domain, wrap(rule))).toThrow(),
  );
  it("rejects duplicate rule IDs even if disabled", () =>
    expect(() =>
      validateRuleset(domain, {
        version: 1,
        rules: [basicRule, { ...basicRule, enabled: false }],
      }),
    ).toThrow(/Duplicate/));
  it("rejects computed writes and protects old once-only dates", () => {
    const s = structuredClone(domain);
    s.collections[0].fields.push({
      id: "calc",
      name: "Calc",
      type: "computed",
      formula: { kind: "field", fieldId: "cash" },
    });
    expect(() =>
      validateRuleset(
        s,
        wrap({
          ...basicRule,
          actions: [
            {
              kind: "setNumber",
              fieldId: "calc",
              value: { kind: "number", value: 0, unit: "money" },
            },
          ],
        }),
      ),
    ).toThrow(/writable/);
    s.collections[0].rules.push({
      id: "old",
      triggerFieldId: "state",
      equals: "Done",
      setFieldId: "date",
    });
    expect(() =>
      validateRuleset(
        s,
        wrap({
          ...basicRule,
          actions: [{ kind: "setValue", fieldId: "date", value: "2026-10-20" }],
        }),
      ),
    ).toThrow(/protected/);
  });
  it("bounds condition depth, unknown versions, prototype keys and oversized arrays", () => {
    let when: unknown = {
      kind: "compare",
      fieldId: "cash",
      op: "eq",
      value: 1,
    };
    for (let i = 0; i < 9; i++) when = { kind: "all", conditions: [when] };
    expect(() => validateRuleset(domain, wrap({ ...basicRule, when }))).toThrow(
      /depth/,
    );
    expect(() => validateRuleset(domain, { version: 2, rules: [] })).toThrow();
    expect(() =>
      validateRuleset(
        domain,
        JSON.parse('{"version":1,"rules":[],"__proto__":{}}'),
      ),
    ).toThrow(/Unsafe/);
    expect(() =>
      validateRuleset(domain, { version: 1, rules: Array(51).fill(basicRule) }),
    ).toThrow();
  });
  it("shares the existing AST for sum/count and supports correlated relation filters", () => {
    const c = domain.collections[0],
      r = c.records[0];
    const sum: Formula = {
      kind: "aggregate",
      op: "sum",
      collectionId: "costs",
      fieldId: "cost",
      where: { fieldId: "owner", sourceRecordId: true },
    };
    expect(validateFormula(sum, c, new Set(), 0, { nodes: 0 }, domain)).toEqual(
      { money: 1 },
    );
    expect(evaluate(sum, c, r, 0, domain).value).toBe(2);
    expect(
      evaluate(
        { kind: "aggregate", op: "count", collectionId: "costs" },
        c,
        r,
        0,
        domain,
      ).value,
    ).toBe(2);
    expect(
      evaluate(
        { ...sum, where: { fieldId: "cost", equals: 100 } },
        c,
        r,
        0,
        domain,
      ).value,
    ).toBe(0);
  });
  it("rejects aggregate references, incompatible filters and cross-collection formula cycles", () => {
    const s = structuredClone(domain),
      c = s.collections[0];
    for (const formula of [
      { kind: "aggregate", op: "sum", collectionId: "bad", fieldId: "cost" },
      { kind: "aggregate", op: "sum", collectionId: "costs", fieldId: "owner" },
      {
        kind: "aggregate",
        op: "count",
        collectionId: "costs",
        where: { fieldId: "cost", sourceRecordId: true },
      },
    ])
      expect(() =>
        validateFormula(formula as Formula, c, new Set(), 0, { nodes: 0 }, s),
      ).toThrow();
    c.fields.push({
      id: "a",
      name: "A",
      type: "computed",
      formula: {
        kind: "aggregate",
        op: "sum",
        collectionId: "costs",
        fieldId: "b",
      },
    });
    s.collections[1].fields.push({
      id: "b",
      name: "B",
      type: "computed",
      formula: {
        kind: "aggregate",
        op: "sum",
        collectionId: "tasks",
        fieldId: "a",
      },
    });
    expect(() => validateSnapshot(s)).toThrow(/cycle/);
  });
});
