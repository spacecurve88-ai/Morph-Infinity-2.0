import { describe, expect, it } from "vitest";
import { previewSimulation } from "../src/core/automation";
import type { Snapshot } from "../src/core/model";
const numberField = (id: string) => ({ id, name: id, type: "number" as const, unit: "money" as const });
const source: Snapshot = { collections: [{
  id: "firms", name: "Firms", fields: [
    numberField("cash"), numberField("revenue"), numberField("cost"),
    { id: "status", name: "status", type: "select", options: ["Active", "Bankrupt"] },
  ], records: [
    { id: "one", values: { cash: 10, revenue: 4, cost: 7, status: "Active" } },
    { id: "two", values: { cash: 8, revenue: 5, cost: 3, status: "Active" } },
  ], rules: [],
}] };
const field = (fieldId: string) => ({kind: "field" as const, fieldId});
const literal = (value: number) => ({kind: "constant" as const, value});
const rules = { version: 1 as const, rules: [
  { id: "cash-flow", collectionId: "firms", actions: [{
    kind: "setNumber" as const, fieldId: "cash", value: {
      kind: "binary" as const, op: "+" as const, left: field("cash"), right: {
        kind: "binary" as const, op: "-" as const, left: field("revenue"), right: field("cost"),
      },
    },
  }] },
  { id: "bankruptcy", collectionId: "firms",
    when: { left: field("cash"), op: "<=" as const, right: literal(0) },
    actions: [{ kind: "setStatus" as const, fieldId: "status", value: "Bankrupt" }],
  },
] };
describe("deterministic simulation preview", () => {
  it("runs repeatably, with step-boundary reads and no mutation", () => {
    const first = previewSimulation(source, rules, 3);
    expect(first).toEqual(previewSimulation(source, rules, 3));
    expect(first.snapshot.collections[0].records[0].values.cash).toBe(1);
    expect(first.snapshot.collections[0].records[1].values.cash).toBe(14);
    expect(source.collections[0].records[0].values.cash).toBe(10);
  });
  it("transitions state based on the previous step", () => {
    expect(previewSimulation(source, rules, 5).snapshot.collections[0].records[0].values.status).toBe("Bankrupt");
  });
  it("rejects conflicting actions without mutating records", () => {
    const conflicting = { ...rules, rules: [
      ...rules.rules,
      { id: "duplicate", collectionId: "firms", actions: [{
        kind: "setNumber" as const, fieldId: "cash", value: literal(5),
      }] },
    ] };
    expect(() => previewSimulation(source, conflicting)).toThrow(/Conflicting/);
    expect(source.collections[0].records[0].values.cash).toBe(10);
  });
  it("supports cross-collection aggregation", () => {
    const extended: Snapshot = {collections: [
      ...source.collections,
      {id:"costs",name:"Costs",fields:[numberField("value")],
        records:[{id:"a",values:{value:2}},{id:"b",values:{value:3}}],rules:[]},
    ]};
    const aggregate = {version:1 as const,rules:[{id:"sum",collectionId:"firms",actions:[{
      kind:"setNumber" as const,fieldId:"cost",value:{kind:"sum" as const,collectionId:"costs",fieldId:"value"},
    }]}]};
    expect(previewSimulation(extended,aggregate).snapshot.collections[0].records[0].values.cost).toBe(5);
  });
  it("rejects unbounded step counts and divide by zero", () => {
    expect(() => previewSimulation(source,rules,101)).toThrow(/Invalid/);
    const invalid = {version:1 as const,rules:[{id:"divide",collectionId:"firms",actions:[{
      kind:"setNumber" as const,fieldId:"cash",value:{kind:"binary" as const,op:"/" as const,
        left:literal(1),right:literal(0)},
    }]}]};
    expect(() => previewSimulation(source,invalid)).toThrow(/Division by zero/);
  });
});
