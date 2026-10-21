import { automationSchema, conditionSchema } from "./contracts";
import { boundedInput, unique } from "./model";
import type {
  AutomationRule,
  Collection,
  Condition,
  Ruleset,
  Snapshot,
} from "./model";
import { aggregateCollection, dimensionKey, validateFormula } from "./formula";
import { assertValue } from "./values";
export function validateCondition(
  input: Condition,
  c: Collection,
  snapshot: Snapshot,
  depth = 0,
  budget = { nodes: 0 },
): void {
  if (depth > 6 || ++budget.nodes > 64)
    throw new Error("Condition exceeds depth or complexity limit.");
  if ("conditions" in input) {
    for (const p of input.conditions)
      validateCondition(p, c, snapshot, depth + 1, budget);
    return;
  }
  if (input.kind === "numeric") {
    if (
      dimensionKey(
        validateFormula(input.left, c, new Set(), 0, { nodes: 0 }, snapshot),
      ) !==
      dimensionKey(
        validateFormula(input.right, c, new Set(), 0, { nodes: 0 }, snapshot),
      )
    )
      throw new Error("Numeric condition units do not match.");
    return;
  }
  const f = c.fields.find((f) => f.id === input.fieldId);
  if (!f) throw new Error("Unknown condition field.");
  assertValue(f, input.value, true);
  if (
    !["eq", "ne"].includes(input.op) &&
    (input.value === null || !["number", "computed", "date"].includes(f.type))
  )
    throw new Error("Ordered comparisons require numeric or date values.");
  if (
    f.type === "relation" &&
    input.value !== null &&
    !aggregateCollection(snapshot, f.targetCollectionId).records.some(
      (r) => r.id === input.value,
    )
  )
    throw new Error("Unknown condition record reference.");
}
export function validateRuleset(snapshot: Snapshot, input: unknown): Ruleset {
  boundedInput(input);
  const definition = automationSchema.parse(input);
  unique(definition.rules, "automation rule");
  for (const rule of definition.rules) validateRule(snapshot, rule);
  return definition;
}
export function validateRule(snapshot: Snapshot, rule: AutomationRule): void {
  const c = aggregateCollection(snapshot, rule.collectionId);
  const trigger = rule.trigger;
  if (
    trigger.kind === "fieldChanged" &&
    !c.fields.some((f) => f.id === trigger.fieldId && f.type !== "computed")
  )
    throw new Error("Field-change trigger requires a stored field.");
  if (
    trigger.kind === "fieldChanged" &&
    c.rules.some((r) => r.setFieldId === trigger.fieldId)
  )
    throw new Error("Legacy managed dates cannot trigger further rule events.");
  if (rule.when) {
    conditionSchema.parse(rule.when);
    validateCondition(rule.when, c, snapshot);
  }
  const targets = new Set<string>();
  for (const action of rule.actions) {
    if (targets.has(action.fieldId))
      throw new Error("Conflicting action targets within a rule.");
    targets.add(action.fieldId);
    const f = c.fields.find((f) => f.id === action.fieldId);
    if (!f || f.type === "computed" || f.type === "relation")
      throw new Error(
        "Action requires an existing writable field (computed and relation writes are unsupported).",
      );
    if (c.rules.some((r) => r.setFieldId === f.id))
      throw new Error("Legacy once-only date fields are protected.");
    if (
      action.kind === "setNumber" ||
      action.kind === "increment" ||
      action.kind === "decrement"
    ) {
      if (f.type !== "number")
        throw new Error("Numeric action requires a numeric target.");
      const expected = f.unit === "number" ? {} : { [f.unit]: 1 };
      if (
        dimensionKey(
          validateFormula(
            action.value,
            c,
            new Set(),
            0,
            { nodes: 0 },
            snapshot,
          ),
        ) !== dimensionKey(expected)
      )
        throw new Error("Action expression units do not match target units.");
    } else if (action.kind === "setValue") {
      if (f.type === "number")
        throw new Error("Use a numeric action for a numeric field.");
      assertValue(f, action.value);
    } else if (action.kind === "transition") {
      if (
        f.type !== "select" ||
        !f.options.includes(action.to) ||
        action.from.some((v) => !f.options.includes(v)) ||
        new Set(action.from).size !== action.from.length
      )
        throw new Error("Invalid select-state transition.");
    }
  }
}
