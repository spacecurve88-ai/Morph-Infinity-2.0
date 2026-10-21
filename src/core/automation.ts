/**
 * Deterministic simulation engine. Experimental: not connected to production UI.
 * All reads within a step use the same snapshot; writes take effect simultaneously.
 * A caller must validate and explicitly approve the returned snapshot before commit.
 */
import type { Snapshot, Collection, DataRecord } from "./model";

export type Expr =
  | { kind: "constant"; value: number }
  | { kind: "field"; fieldId: string }
  | { kind: "sum"; collectionId: string; fieldId: string }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr };
export type Predicate = { left: Expr; op: "<" | "<=" | "=" | ">=" | ">"; right: Expr };
export type Rule = {
  id: string; collectionId: string; when?: Predicate;
  actions: Array<
    | { kind: "setNumber"; fieldId: string; value: Expr }
    | { kind: "setStatus"; fieldId: string; value: string }
  >;
};
export type Definition = { version: 1; rules: Rule[] };
export type Change = {
  step: number; collectionId: string; recordId: string; fieldId: string;
  before: number | string | boolean | null; after: number | string;
};
const ident = /^[a-zA-Z0-9_-]{1,80}$/;
function collection(s: Snapshot, id: string): Collection {
  const c = s.collections.find(c => c.id === id);
  if (!c) throw Error("Unknown collection: " + id);
  return c;
}
function finite(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw Error("Nonfinite or missing numeric value.");
  return v;
}
function evaluate(e: Expr, s: Snapshot, r: DataRecord, c: Collection, budget: { n: number }): number {
  if (--budget.n < 0) throw Error("Expression complexity exceeded.");
  let v: number;
  switch (e.kind) {
    case "constant": v = e.value; break;
    case "field": {
      if (c.fields.find(f => f.id === e.fieldId)?.type !== "number") throw Error("Not a numeric field.");
      v = finite(r.values[e.fieldId]); break;
    }
    case "sum": {
      const other = collection(s, e.collectionId);
      if (other.fields.find(f => f.id === e.fieldId)?.type !== "number") throw Error("Not a numeric aggregate.");
      v = other.records.reduce((total, item) => total + finite(item.values[e.fieldId]), 0);
      break;
    }
    case "binary": {
      const a = evaluate(e.left, s, r, c, budget), b = evaluate(e.right, s, r, c, budget);
      if (e.op === "/" && b === 0) throw Error("Division by zero.");
      v = e.op === "+" ? a + b : e.op === "-" ? a - b : e.op === "*" ? a * b : a / b;
      break;
    }
    default: throw Error("Unsupported expression.");
  }
  return finite(v);
}
function condition(p: Predicate, s: Snapshot, r: DataRecord, c: Collection): boolean {
  const a = evaluate(p.left, s, r, c, { n: 100 }), b = evaluate(p.right, s, r, c, { n: 100 });
  switch (p.op) {
    case "<": return a < b;
    case "<=": return a <= b;
    case "=": return a === b;
    case ">=": return a >= b;
    case ">": return a > b;
    default: throw Error("Invalid comparison.");
  }
}
export function previewSimulation(input: Snapshot, definition: Definition, steps = 1):
  { snapshot: Snapshot; changes: Change[]; steps: number } {
  if (definition?.version !== 1 || !Array.isArray(definition.rules) ||
      definition.rules.length > 100 || !Number.isInteger(steps) || steps < 1 || steps > 100)
    throw Error("Invalid simulation definition or step count.");
  if (new Set(definition.rules.map(r => r.id)).size !== definition.rules.length)
    throw Error("Duplicate rule.");
  let current: Snapshot = structuredClone(input);
  const changes: Change[] = [];
  for (let step = 1; step <= steps; step++) {
    const next = structuredClone(current);
    const written = new Set<string>();
    for (const rule of definition.rules) {
      if (!ident.test(rule.id) || !ident.test(rule.collectionId) ||
          !Array.isArray(rule.actions) || rule.actions.length < 1 || rule.actions.length > 20)
        throw Error("Invalid rule.");
      const source = collection(current, rule.collectionId);
      const destination = collection(next, rule.collectionId);
      for (const oldRecord of source.records) {
        if (rule.when && !condition(rule.when, current, oldRecord, source)) continue;
        const newRecord = destination.records.find(r => r.id === oldRecord.id)!;
        for (const action of rule.actions) {
          const field = source.fields.find(f => f.id === action.fieldId);
          if (!field || (action.kind === "setNumber" && field.type !== "number") ||
              (action.kind === "setStatus" && (field.type !== "select" ||
              !field.options.includes(action.value))))
            throw Error("Incompatible action target.");
          if (action.kind !== "setNumber" && action.kind !== "setStatus") throw Error("Unknown action.");
          const v = action.kind === "setNumber"
            ? evaluate(action.value, current, oldRecord, source, { n: 100 }) : action.value;
          const key = rule.collectionId + ":" + oldRecord.id + ":" + action.fieldId;
          if (written.has(key)) throw Error("Conflicting writes in same step.");
          written.add(key);
          const before = oldRecord.values[action.fieldId] ?? null;
          if (before !== v) {
            newRecord.values[action.fieldId] = v;
            changes.push({ step, collectionId: rule.collectionId, recordId: oldRecord.id,
              fieldId: action.fieldId, before, after: v });
            if (changes.length > 20000) throw Error("Change limit exceeded.");
          }
        }
      }
    }
    current = next;
  }
  return { snapshot: current, changes, steps };
}
