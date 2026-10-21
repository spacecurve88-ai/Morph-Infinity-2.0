import type {
  AggregateFilter,
  Collection,
  DataRecord,
  Formula,
  Snapshot,
} from "./model";
import { assertValue, valueType } from "./values";

export type Dimensions = Record<string, number>;
export const dimensionKey = (d: Dimensions) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(d)
        .filter(([, n]) => n !== 0)
        .sort(),
    ),
  );
const dimensions = (unit: string) => (unit === "number" ? {} : { [unit]: 1 });
export type WorkBudget = { remaining: number };
export const workBudget = (remaining = 200000): WorkBudget => ({ remaining });
export function spend(budget: WorkBudget, amount = 1): void {
  if ((budget.remaining -= amount) < 0)
    throw new Error(
      "Global execution work budget exceeded. Reduce records, rules, aggregates, or steps.",
    );
}
export function aggregateCollection(
  snapshot: Snapshot,
  id: string,
): Collection {
  const result = snapshot.collections.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown aggregate collection: ${id}`);
  return result;
}
export function validateFilter(
  filter: AggregateFilter | undefined,
  target: Collection,
  source: Collection,
  snapshot: Snapshot,
): void {
  if (!filter) return;
  const field = target.fields.find((f) => f.id === filter.fieldId);
  if (!field || field.type === "computed")
    throw new Error("Aggregate filters require a stored target field.");
  if ("equals" in filter) assertValue(field, filter.equals);
  else if ("sourceRecordId" in filter) {
    if (field.type !== "relation" || field.targetCollectionId !== source.id)
      throw new Error(
        "A correlated record-ID filter requires a relation to the source collection.",
      );
  } else {
    const from = source.fields.find((f) => f.id === filter.sourceFieldId);
    if (
      !from ||
      from.type === "computed" ||
      valueType(from) !== valueType(field)
    )
      throw new Error(
        "Aggregate filter field references have incompatible types.",
      );
    if (
      from.type === "number" &&
      field.type === "number" &&
      from.unit !== field.unit
    )
      throw new Error("Aggregate filter units do not match.");
    if (
      from.type === "relation" &&
      field.type === "relation" &&
      from.targetCollectionId !== field.targetCollectionId
    )
      throw new Error("Aggregate relation targets do not match.");
  }
  if (
    "equals" in filter &&
    filter.equals !== null &&
    field.type === "relation" &&
    !aggregateCollection(snapshot, field.targetCollectionId).records.some(
      (r) => r.id === filter.equals,
    )
  )
    throw new Error("Unknown record reference in aggregate filter.");
}
export function validateFormula(
  formula: Formula,
  collection: Collection,
  visiting = new Set<string>(),
  depth = 0,
  budget = { nodes: 0 },
  snapshot: Snapshot = { collections: [collection] },
): Dimensions {
  if (depth > 12 || ++budget.nodes > 100)
    throw new Error("Formula exceeds the depth or complexity limit.");
  if (formula.kind === "number") return dimensions(formula.unit ?? "number");
  if (formula.kind === "aggregate") {
    const other = aggregateCollection(snapshot, formula.collectionId);
    validateFilter(formula.where, other, collection, snapshot);
    if (formula.op === "count") return {};
    return validateFormula(
      { kind: "field", fieldId: formula.fieldId },
      other,
      visiting,
      depth + 1,
      budget,
      snapshot,
    );
  }
  if (formula.kind === "field") {
    const field = collection.fields.find((f) => f.id === formula.fieldId);
    if (!field) throw new Error(`Unknown field: ${formula.fieldId}`);
    if (field.type === "computed") {
      const ref = `${collection.id}/${field.id}`;
      if (visiting.has(ref) || (depth === 0 && visiting.has(field.id)))
        throw new Error("Formula dependency cycle.");
      return validateFormula(
        field.formula,
        collection,
        new Set([...visiting, ref]),
        depth + 1,
        budget,
        snapshot,
      );
    }
    if (field.type !== "number")
      throw new Error(`“${field.name}” is not numeric.`);
    return dimensions(field.unit);
  }
  const left = validateFormula(
    formula.left,
    collection,
    visiting,
    depth + 1,
    budget,
    snapshot,
  );
  const right = validateFormula(
    formula.right,
    collection,
    visiting,
    depth + 1,
    budget,
    snapshot,
  );
  if (formula.op === "+" || formula.op === "-") {
    if (dimensionKey(left) !== dimensionKey(right))
      throw new Error("Addition and subtraction require matching units.");
    return left;
  }
  const result = { ...left };
  for (const [k, v] of Object.entries(right))
    result[k] = (result[k] ?? 0) + (formula.op === "/" ? -v : v);
  return result;
}
export type ComputedValue = { value: number | null; reason?: string };
export function evaluate(
  formula: Formula,
  collection: Collection,
  record: DataRecord,
  depth = 0,
  snapshot: Snapshot = { collections: [collection] },
  budget = workBudget(),
): ComputedValue {
  try {
    return calculate(formula, collection, record, depth, snapshot, budget);
  } catch (error) {
    return {
      value: null,
      reason: error instanceof Error ? error.message : "Calculation failed",
    };
  }
}
function calculate(
  formula: Formula,
  c: Collection,
  r: DataRecord,
  depth: number,
  snapshot: Snapshot,
  budget: WorkBudget,
): ComputedValue {
  spend(budget);
  if (depth > 20) throw new Error("Formula too deep");
  if (formula.kind === "number") return { value: formula.value };
  if (formula.kind === "aggregate") {
    const other = aggregateCollection(snapshot, formula.collectionId);
    let value = 0;
    for (const item of [...other.records].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      spend(budget);
      const filter = formula.where;
      if (filter) {
        const expected =
          "equals" in filter
            ? filter.equals
            : "sourceRecordId" in filter
              ? r.id
              : (r.values[filter.sourceFieldId] ?? null);
        if ((item.values[filter.fieldId] ?? null) !== expected) continue;
      }
      if (formula.op === "count") value++;
      else {
        const result = calculate(
          { kind: "field", fieldId: formula.fieldId },
          other,
          item,
          depth + 1,
          snapshot,
          budget,
        );
        if (result.value === null) {
          if (result.reason === "Missing input") continue;
          return result;
        }
        value += result.value;
      }
      if (!Number.isFinite(value))
        throw new Error("Result exceeds numeric range");
    }
    return { value };
  }
  if (formula.kind === "field") {
    const f = c.fields.find((f) => f.id === formula.fieldId);
    if (!f) throw new Error("Unknown numeric field");
    if (f.type === "computed")
      return calculate(f.formula, c, r, depth + 1, snapshot, budget);
    const value = r.values[f.id];
    return typeof value === "number" && Number.isFinite(value)
      ? { value }
      : { value: null, reason: "Missing input" };
  }
  const a = calculate(formula.left, c, r, depth + 1, snapshot, budget),
    b = calculate(formula.right, c, r, depth + 1, snapshot, budget);
  if (a.value === null) return a;
  if (b.value === null) return b;
  if (formula.op === "/" && b.value === 0)
    return { value: null, reason: "Division by zero" };
  const value =
    formula.op === "+"
      ? a.value + b.value
      : formula.op === "-"
        ? a.value - b.value
        : formula.op === "*"
          ? a.value * b.value
          : a.value / b.value;
  return Number.isFinite(value)
    ? { value }
    : { value: null, reason: "Result exceeds numeric range" };
}
export function formulaText(
  node: Formula,
  c: Collection,
  snapshot: Snapshot = { collections: [c] },
): string {
  if (node.kind === "field")
    return c.fields.find((f) => f.id === node.fieldId)?.name ?? node.fieldId;
  if (node.kind === "number")
    return `${node.value}${node.unit && node.unit !== "number" ? ` ${node.unit}` : ""}`;
  if (node.kind === "aggregate") {
    const target = snapshot.collections.find((t) => t.id === node.collectionId);
    const column =
      node.op === "sum"
        ? (target?.fields.find((f) => f.id === node.fieldId)?.name ??
          node.fieldId)
        : "records";
    return `${node.op}(${target?.name ?? node.collectionId}.${column}${node.where ? " · filtered" : ""})`;
  }
  return `(${formulaText(node.left, c, snapshot)} ${node.op} ${formulaText(node.right, c, snapshot)})`;
}
