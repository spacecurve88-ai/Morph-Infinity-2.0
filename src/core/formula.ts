import type { Collection, DataRecord, Formula } from "./model";

type Dimensions = Record<string, number>;
const signature = (d: Dimensions) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(d)
        .filter(([, n]) => n !== 0)
        .sort(),
    ),
  );
export function validateFormula(
  formula: Formula,
  collection: Collection,
  visiting = new Set<string>(),
  depth = 0,
  budget = { nodes: 0 },
): Dimensions {
  if (depth > 12 || ++budget.nodes > 100)
    throw new Error("Formula exceeds the depth or complexity limit.");
  if (formula.kind === "number") return {};
  if (formula.kind === "field") {
    const field = collection.fields.find((f) => f.id === formula.fieldId);
    if (!field) throw new Error(`Unknown field: ${formula.fieldId}`);
    if (field.type === "computed") {
      if (visiting.has(field.id)) throw new Error("Formula dependency cycle.");
      return validateFormula(
        field.formula,
        collection,
        new Set([...visiting, field.id]),
        depth + 1,
        budget,
      );
    }
    if (field.type !== "number")
      throw new Error(`“${field.name}” is not numeric.`);
    return field.unit === "number" ? {} : { [field.unit]: 1 };
  }
  const left = validateFormula(
    formula.left,
    collection,
    visiting,
    depth + 1,
    budget,
  );
  const right = validateFormula(
    formula.right,
    collection,
    visiting,
    depth + 1,
    budget,
  );
  if (formula.op === "+" || formula.op === "-") {
    if (signature(left) !== signature(right))
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
): ComputedValue {
  if (depth > 20) return { value: null, reason: "Formula too deep" };
  if (formula.kind === "number") return { value: formula.value };
  if (formula.kind === "field") {
    const field = collection.fields.find((f) => f.id === formula.fieldId);
    if (field?.type === "computed")
      return evaluate(field.formula, collection, record, depth + 1);
    const value = record.values[formula.fieldId];
    return typeof value === "number"
      ? { value }
      : { value: null, reason: "Missing input" };
  }
  const left = evaluate(formula.left, collection, record, depth + 1);
  const right = evaluate(formula.right, collection, record, depth + 1);
  if (left.value === null) return left;
  if (right.value === null) return right;
  if (formula.op === "/" && right.value === 0)
    return { value: null, reason: "Division by zero" };
  const value =
    formula.op === "+"
      ? left.value + right.value
      : formula.op === "-"
        ? left.value - right.value
        : formula.op === "*"
          ? left.value * right.value
          : left.value / right.value;
  return Number.isFinite(value)
    ? { value }
    : { value: null, reason: "Result exceeds numeric range" };
}
export function formulaText(node: Formula, collection: Collection): string {
  if (node.kind === "field")
    return (
      collection.fields.find((f) => f.id === node.fieldId)?.name ?? node.fieldId
    );
  if (node.kind === "number") return String(node.value);
  return `(${formulaText(node.left, collection)} ${node.op} ${formulaText(node.right, collection)})`;
}
