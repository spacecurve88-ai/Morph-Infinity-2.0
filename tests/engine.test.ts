import { describe, expect, it } from "vitest";
import {
  applyPlan,
  deleteRecord,
  forkBranch,
  monthlyCounts,
  previewPlan,
  restoreCommit,
  saveRecord,
  switchBranch,
} from "../src/core/engine";
import { currentSnapshot, uid } from "../src/core/model";
import type {
  Collection,
  DataRecord,
  Document,
  Field,
  Formula,
} from "../src/core/model";
import { setup } from "./helpers";
import { evaluate } from "../src/core/formula";
import { validateDocument, validateSnapshot } from "../src/core/validation";
import {
  basePlan,
  parseFormula,
  propose,
  template,
} from "../src/planner/parse";

function collection(d: Document, cid: string) {
  return currentSnapshot(d.workspaces[0]).collections.find(
    (c) => c.id === cid,
  )!;
}
function field(c: Collection, name: string) {
  return c.fields.find((f) => f.name === name)!.id;
}
function addFormula(
  d: Document,
  cid: string,
  request = "Reading Speed = Pages Read / Minutes Read",
) {
  return applyPlan(d, propose(d, d.workspaces[0], cid, request));
}

describe("typed proposals and calculations", () => {
  it("previews without mutation; requires explicit application", () => {
    const { d, cid, c } = setup();
    const before = JSON.stringify(d);
    const plan = propose(
      d,
      d.workspaces[0],
      cid,
      "Calculate reading speed using pages read and minutes read",
    );
    expect(previewPlan(d, plan).collections[0].fields).toHaveLength(
      c.fields.length + 1,
    );
    expect(JSON.stringify(d)).toBe(before);
    const applied = applyPlan(d, plan);
    expect(applied.workspaces[0].commits).toHaveLength(
      d.workspaces[0].commits.length + 1,
    );
    expect(JSON.stringify(d)).toBe(before);
  });
  it("evaluates normal, absent, and zero inputs truthfully", () => {
    const { d, cid, c } = setup();
    const updated = collection(addFormula(d, cid), cid);
    const f = updated.fields.at(-1)!;
    if (f.type !== "computed") throw Error("missing computed field");
    expect(
      evaluate(f.formula, updated, {
        id: uid(),
        values: {
          [field(c, "Pages Read")]: 120,
          [field(c, "Minutes Read")]: 30,
        },
      }).value,
    ).toBe(4);
    expect(evaluate(f.formula, updated, { id: uid(), values: {} })).toEqual({
      value: null,
      reason: "Missing input",
    });
    expect(
      evaluate(f.formula, updated, {
        id: uid(),
        values: { [field(c, "Pages Read")]: 10, [field(c, "Minutes Read")]: 0 },
      }),
    ).toEqual({ value: null, reason: "Division by zero" });
  });
  it("implements precedence and nested computed dependencies without code execution", () => {
    const { d, cid } = setup("budget");
    const updated = addFormula(d, cid, "Balance = Income - Expenses");
    const c = collection(updated, cid);
    const f = parseFormula("(Balance + Income) / 2", c);
    expect(
      evaluate(f, c, {
        id: uid(),
        values: { [field(c, "Income")]: 100, [field(c, "Expenses")]: 30 },
      }).value,
    ).toBe(85);
    expect(() =>
      parseFormula('Income; fetch("https://example.com")', c),
    ).toThrow();
  });
  it("matches arithmetic for many finite inputs", () => {
    const { d, cid } = setup("budget");
    const c = collection(
      addFormula(d, cid, "Balance = Income - Expenses"),
      cid,
    );
    const f = c.fields.at(-1)!;
    if (f.type !== "computed") throw Error("missing formula");
    for (let n = 0; n < 80; n++)
      expect(
        evaluate(f.formula, c, {
          id: uid(),
          values: {
            [field(c, "Income")]: n * 7.5,
            [field(c, "Expenses")]: n / 4,
          },
        }).value,
      ).toBe(n * 7.5 - n / 4);
  });
  it("reports overflow", () => {
    const { c } = setup();
    expect(
      evaluate(
        {
          kind: "binary",
          op: "*",
          left: { kind: "number", value: Number.MAX_VALUE },
          right: { kind: "number", value: 2 },
        },
        c,
        { id: uid(), values: {} },
      ).reason,
    ).toBe("Result exceeds numeric range");
  });
  it("rejects unknown fields, nonnumeric references, and incompatible units", () => {
    const { d, cid } = setup();
    for (const request of [
      "Speed = Pages Read / Unknown",
      "Wrong = Book + 1",
      "Wrong = Pages Read + Minutes Read",
    ])
      expect(() => addFormula(d, cid, request)).toThrow();
  });
  it("rejects cycles and excessive depth or expanded complexity", () => {
    const { c } = setup();
    const self = {
      id: "cycle",
      name: "Cycle",
      type: "computed" as const,
      formula: { kind: "field" as const, fieldId: "cycle" },
    };
    expect(() =>
      validateSnapshot({
        collections: [{ ...c, fields: [...c.fields, self] }],
      }),
    ).toThrow(/cycle/);
    let formula: Formula = { kind: "number", value: 1 };
    for (let i = 0; i < 15; i++)
      formula = {
        kind: "binary",
        op: "+",
        left: formula,
        right: { kind: "number", value: 1 },
      };
    expect(() =>
      validateSnapshot({
        collections: [{ ...c, fields: [...c.fields, { ...self, formula }] }],
      }),
    ).toThrow();
    const many = structuredClone(c);
    many.fields.push({
      id: "a",
      name: "a",
      type: "computed",
      formula: { kind: "number", value: 1 },
    });
    for (let i = 1; i < 9; i++)
      many.fields.push({
        id: `a${i}`,
        name: `a${i}`,
        type: "computed",
        formula: {
          kind: "binary",
          op: "+",
          left: { kind: "field", fieldId: i === 1 ? "a" : `a${i - 1}` },
          right: { kind: "field", fieldId: i === 1 ? "a" : `a${i - 1}` },
        },
      });
    expect(() => validateSnapshot({ collections: [many] })).toThrow(
      /complexity/,
    );
  });
  it("rejects stale revision, wrong branch, unknown operations and extra properties", () => {
    const { d, cid } = setup();
    const plan = propose(
      d,
      d.workspaces[0],
      cid,
      "Speed = Pages Read / Minutes Read",
    );
    expect(() => previewPlan({ ...d, revision: uid() }, plan)).toThrow(/stale/);
    expect(() => previewPlan(d, { ...plan, branchId: uid() })).toThrow(/stale/);
    expect(() => previewPlan(d, { ...plan, execute: "evil" })).toThrow();
    expect(() =>
      previewPlan(d, { ...plan, operations: [{ type: "deleteEverything" }] }),
    ).toThrow();
  });
  it("rejects duplicate fields and conflicting multi-operation plans", () => {
    const { d, cid } = setup();
    const plan = propose(
      d,
      d.workspaces[0],
      cid,
      "Speed = Pages Read / Minutes Read",
    );
    expect(() =>
      previewPlan(d, {
        ...plan,
        operations: [...plan.operations, ...plan.operations],
      }),
    ).toThrow(/Duplicate/);
    const applied = applyPlan(d, plan);
    expect(() =>
      propose(
        applied,
        applied.workspaces[0],
        cid,
        "Speed = Pages Read / Minutes Read",
      ),
    ).toThrow(/unique/);
  });
  it.each([
    "Remind me three days before a deadline",
    "Fetch my bank balance",
    "Delete all records",
    "Create a budget and delete everything",
    "Build me an arbitrary JavaScript widget",
  ])("rejects unsupported request without mutations: %s", (request) => {
    const { d, cid } = setup();
    const before = JSON.stringify(d);
    expect(() => propose(d, d.workspaces[0], cid, request)).toThrow(
      /not supported/,
    );
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe("records, rules, relations, and revisions", () => {
  it("captures a local abandonment date once and groups real record dates by month", () => {
    const { d, wid, cid, c } = setup();
    let updated = applyPlan(
      d,
      propose(
        d,
        d.workspaces[0],
        cid,
        "When I mark a book abandoned, record today's date",
      ),
    );
    let record: DataRecord = {
      id: uid(),
      values: {
        [field(c, "Book")]: "A book",
        [field(c, "Status")]: "Abandoned",
      },
    };
    updated = saveRecord(updated, wid, cid, record, "2026-09-30");
    const dateId = field(collection(updated, cid), "Abandoned on");
    record = structuredClone(collection(updated, cid).records[0]);
    record.values[field(c, "Status")] = "Reading";
    updated = saveRecord(updated, wid, cid, record, "2026-10-01");
    record.values[field(c, "Status")] = "Abandoned";
    updated = saveRecord(updated, wid, cid, record, "2026-10-02");
    expect(collection(updated, cid).records[0].values[dateId]).toBe(
      "2026-09-30",
    );
    updated = saveRecord(
      updated,
      wid,
      cid,
      { id: uid(), values: { [field(c, "Status")]: "Abandoned" } },
      "2026-10-02",
    );
    expect(monthlyCounts(collection(updated, cid), dateId)).toEqual([
      ["2026-09", 1],
      ["2026-10", 1],
    ]);
  });
  it("does not backfill a date merely because an already matching record was edited", () => {
    const { d, wid, cid, c } = setup();
    const record = { id: uid(), values: { [field(c, "Status")]: "Abandoned" } };
    let updated = saveRecord(d, wid, cid, record);
    updated = applyPlan(
      updated,
      propose(
        updated,
        updated.workspaces[0],
        cid,
        "When I mark a book abandoned, record today's date",
      ),
    );
    updated = saveRecord(updated, wid, cid, record);
    expect(
      collection(updated, cid).records[0].values[
        field(collection(updated, cid), "Abandoned on")
      ],
    ).toBeNull();
  });
  it("preserves identities and immutable ancestry across branch edits", () => {
    const { d, wid, cid } = setup();
    const main = d.workspaces[0].activeBranchId;
    const old = JSON.stringify(d);
    let updated = forkBranch(d, wid, "Try it");
    updated = addFormula(updated, cid);
    expect(collection(updated, cid).fields).toHaveLength(5);
    updated = switchBranch(updated, wid, main);
    expect(collection(updated, cid).fields).toHaveLength(4);
    expect(JSON.stringify(d)).toBe(old);
    expect(validateDocument(updated)).toEqual(updated);
  });
  it("distinguishes design-only and full restores and keeps recovery history", () => {
    const { d, wid, cid, c } = setup();
    const id = uid();
    const one = saveRecord(d, wid, cid, {
      id,
      values: { [field(c, "Book")]: "First" },
    });
    const target = one.workspaces[0].commits.at(-1)!;
    let two = saveRecord(one, wid, cid, {
      id,
      values: { [field(c, "Book")]: "Second" },
    });
    two = addFormula(two, cid);
    const design = restoreCommit(two, wid, target.id, "design");
    expect(collection(design, cid).fields).toHaveLength(4);
    expect(collection(design, cid).records[0].values[field(c, "Book")]).toBe(
      "Second",
    );
    const full = restoreCommit(two, wid, target.id, "full");
    expect(collection(full, cid).records[0].values[field(c, "Book")]).toBe(
      "First",
    );
    expect(full.workspaces[0].commits).toHaveLength(
      two.workspaces[0].commits.length + 1,
    );
  });
  it("rejects destructive design-only restores", () => {
    const { d, wid, cid, c } = setup();
    expect(() =>
      restoreCommit(
        saveRecord(d, wid, cid, {
          id: uid(),
          values: { [field(c, "Book")]: "Keep me" },
        }),
        wid,
        d.workspaces[0].commits[0].id,
        "design",
      ),
    ).toThrow(/remove a collection/);
  });
  it("validates relations and restricts deleting referenced records", () => {
    const { d, wid, cid, c } = setup();
    const authors = template("blank", "Authors");
    const author = {
      id: uid(),
      values: { [authors.fields[0].id]: "Ursula Le Guin" },
    };
    let updated = applyPlan(
      d,
      basePlan(d, d.workspaces[0], "Authors", [
        { type: "addCollection", collection: authors },
      ]),
    );
    updated = saveRecord(updated, wid, authors.id, author);
    const relation: Field = {
      id: uid(),
      name: "Author",
      type: "relation",
      targetCollectionId: authors.id,
    };
    updated = applyPlan(
      updated,
      basePlan(updated, updated.workspaces[0], "Link author", [
        { type: "addField", collectionId: cid, field: relation },
      ]),
    );
    updated = saveRecord(updated, wid, cid, {
      id: uid(),
      values: {
        [field(c, "Book")]: "The Dispossessed",
        [relation.id]: author.id,
      },
    });
    expect(() => deleteRecord(updated, wid, authors.id, author.id)).toThrow(
      /references/,
    );
    expect(() =>
      saveRecord(updated, wid, cid, {
        id: uid(),
        values: { [relation.id]: "nonexistent" },
      }),
    ).toThrow(/Related record/);
  });
  it("rejects malformed history, invalid values, duplicate IDs and unsafe keys", () => {
    const { d, cid } = setup();
    const corrupt = structuredClone(d);
    corrupt.workspaces[0].commits[0].parentId = uid();
    expect(() => validateDocument(corrupt)).toThrow(/missing parent/);
    const invalid = structuredClone(d);
    collection(invalid, cid).records.push({
      id: uid(),
      values: { unknown: "bad" },
    });
    expect(() => validateDocument(invalid)).toThrow();
    expect(() => validateDocument(JSON.parse('{"__proto__":{}}'))).toThrow(
      /Unsafe/,
    );
    const duplicate = structuredClone(d);
    duplicate.workspaces.push(duplicate.workspaces[0]);
    expect(() => validateDocument(duplicate)).toThrow(/Duplicate/);
  });
});
