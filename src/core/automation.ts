/** Pure, bounded execution. Reads are frozen for each logical step; no clocks or storage. */
import type {
  Action,
  AutomationRule,
  Collection,
  Condition,
  DataRecord,
  Ruleset,
  Scalar,
  Snapshot,
} from "./model";
import { boundedInput } from "./model";
import { aggregateCollection, evaluate, spend, workBudget } from "./formula";
import type { WorkBudget } from "./formula";
import { validateRuleset } from "./rule-validation";
import { validateSnapshot } from "./validation";

export const SIMULATION_LIMITS = Object.freeze({
  steps: 100,
  rules: 50,
  work: 200000,
  changes: 20000,
  bytes: 5 * 1024 * 1024,
});
export type Change = {
  step: number;
  ruleId: string;
  collectionId: string;
  recordId: string;
  fieldId: string;
  before: Scalar;
  after: Scalar;
};
export type StepSummary = {
  step: number;
  changes: number;
  affectedRecords: number;
};
export type SimulationResult = {
  snapshot: Snapshot;
  changes: Change[];
  steps: number;
  affectedRecords: number;
  summaries: StepSummary[];
  workUsed: number;
};
const order = <T extends { id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
function numeric(
  expr: Parameters<typeof evaluate>[0],
  s: Snapshot,
  c: Collection,
  r: DataRecord,
  b: WorkBudget,
): number {
  const result = evaluate(expr, c, r, 0, s, b);
  if (result.value === null)
    throw new Error(result.reason ?? "Missing numeric result.");
  return result.value;
}
function compare(
  a: Scalar,
  b: Scalar,
  op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte",
): boolean {
  if (op === "eq") return a === b;
  if (op === "ne") return a !== b;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (
    (typeof a === "number" && typeof b === "number") ||
    (typeof a === "string" && typeof b === "string")
  )
    return op === "lt"
      ? a < b
      : op === "lte"
        ? a <= b
        : op === "gt"
          ? a > b
          : a >= b;
  return false;
}
export function matches(
  condition: Condition | undefined,
  s: Snapshot,
  c: Collection,
  r: DataRecord,
  b: WorkBudget,
): boolean {
  spend(b);
  if (!condition) return true;
  if ("conditions" in condition)
    return condition.kind === "all"
      ? condition.conditions.every((p) => matches(p, s, c, r, b))
      : condition.conditions.some((p) => matches(p, s, c, r, b));
  if (condition.kind === "numeric")
    return compare(
      numeric(condition.left, s, c, r, b),
      numeric(condition.right, s, c, r, b),
      condition.op,
    );
  const f = c.fields.find((f) => f.id === condition.fieldId)!;
  const value =
    f.type === "computed"
      ? numeric(f.formula, s, c, r, b)
      : (r.values[f.id] ?? null);
  return compare(value, condition.value, condition.op);
}
function actionValue(
  a: Action,
  s: Snapshot,
  c: Collection,
  r: DataRecord,
  b: WorkBudget,
): Scalar | undefined {
  spend(b);
  if (a.kind === "transition")
    return a.from.includes(String(r.values[a.fieldId])) ? a.to : undefined;
  if (a.kind === "setValue") return a.value;
  const value = numeric(a.value, s, c, r, b);
  if (a.kind === "setNumber") return value;
  const old = r.values[a.fieldId];
  if (typeof old !== "number" || !Number.isFinite(old))
    throw new Error(
      "Increment/decrement requires a present finite numeric value.",
    );
  const result = old + (a.kind === "increment" ? value : -value);
  if (!Number.isFinite(result)) throw new Error("Result exceeds numeric range");
  return result;
}
function collectWrites(
  s: Snapshot,
  rules: AutomationRule[],
  b: WorkBudget,
  step: number,
  accept: (rule: AutomationRule, record: DataRecord) => boolean,
): Change[] {
  const changes: Change[] = [],
    reserved = new Map<string, string>();
  for (const rule of order(rules)) {
    spend(b);
    if (!rule.enabled) continue;
    const c = aggregateCollection(s, rule.collectionId);
    for (const record of order(c.records)) {
      spend(b);
      if (!accept(rule, record) || !matches(rule.when, s, c, record, b))
        continue;
      for (const action of [...rule.actions].sort((a, b) =>
        a.fieldId < b.fieldId ? -1 : a.fieldId > b.fieldId ? 1 : 0,
      )) {
        const after = actionValue(action, s, c, record, b);
        if (after === undefined) continue;
        const key = JSON.stringify([c.id, record.id, action.fieldId]);
        if (reserved.has(key))
          throw new Error(
            `Conflicting writes from “${reserved.get(key)}” and “${rule.name}” to ${c.name}/${record.id}/${action.fieldId}. No changes applied.`,
          );
        reserved.set(key, rule.name);
        const before = record.values[action.fieldId] ?? null;
        if (before !== after)
          changes.push({
            step,
            ruleId: rule.id,
            collectionId: c.id,
            recordId: record.id,
            fieldId: action.fieldId,
            before,
            after,
          });
        if (changes.length > SIMULATION_LIMITS.changes)
          throw new Error("Simulation change limit exceeded.");
      }
    }
  }
  return changes;
}
function publish(s: Snapshot, changes: Change[]): Snapshot {
  const next = structuredClone(s);
  const collections = new Map(
    next.collections.map((c) => [
      c.id,
      new Map(c.records.map((r) => [r.id, r])),
    ]),
  );
  for (const change of changes)
    collections.get(change.collectionId)!.get(change.recordId)!.values[
      change.fieldId
    ] = change.after;
  return next;
}
function size(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
export function previewSimulation(
  input: unknown,
  definition: unknown,
  steps = 1,
  options?: { workLimit?: number },
): SimulationResult {
  boundedInput(input);
  boundedInput(definition);
  if (!Number.isInteger(steps) || steps < 1 || steps > SIMULATION_LIMITS.steps)
    throw new Error("Invalid simulation step count: choose 1–100.");
  const limit = options?.workLimit ?? SIMULATION_LIMITS.work;
  if (!Number.isInteger(limit) || limit < 1 || limit > SIMULATION_LIMITS.work)
    throw new Error("Invalid work limit.");
  let current = validateSnapshot(input);
  if (size(current) > SIMULATION_LIMITS.bytes)
    throw new Error("Snapshot exceeds simulation memory limit.");
  const rules = validateRuleset(current, definition).rules.filter(
    (r) => r.trigger.kind === "simulationStep",
  );
  const budget = workBudget(limit),
    changes: Change[] = [],
    summaries: StepSummary[] = [];
  let bytes = 0;
  for (let step = 1; step <= steps; step++) {
    spend(
      budget,
      current.collections.reduce(
        (n, c) => n + c.records.length + c.fields.length,
        1,
      ),
    );
    const batch = collectWrites(current, rules, budget, step, () => true);
    bytes += size(batch);
    if (changes.length + batch.length > SIMULATION_LIMITS.changes)
      throw new Error("Simulation change limit exceeded.");
    if (bytes > SIMULATION_LIMITS.bytes)
      throw new Error("Simulation diff memory limit exceeded.");
    current = publish(current, batch);
    if (size(current) + bytes > SIMULATION_LIMITS.bytes)
      throw new Error("Simulation output memory limit exceeded.");
    changes.push(...batch);
    summaries.push({
      step,
      changes: batch.length,
      affectedRecords: new Set(
        batch.map((c) => JSON.stringify([c.collectionId, c.recordId])),
      ).size,
    });
  }
  return {
    snapshot: validateSnapshot(current),
    changes,
    steps,
    affectedRecords: new Set(
      changes.map((c) => JSON.stringify([c.collectionId, c.recordId])),
    ).size,
    summaries,
    workUsed: limit - budget.remaining,
  };
}
/** Event rules run exactly once on an explicit user edit. Their writes cannot create events. */
export function previewRecordRules(
  input: Snapshot,
  collectionId: string,
  recordId: string,
  previous: DataRecord | undefined,
): { snapshot: Snapshot; changes: Change[] } {
  const s = validateSnapshot(input),
    c = aggregateCollection(s, collectionId),
    record = c.records.find((r) => r.id === recordId);
  if (!record) throw new Error("Event record is missing.");
  const rules: Ruleset = s.automation ?? { version: 1, rules: [] };
  validateRuleset(s, rules);
  const changed =
    !previous ||
    JSON.stringify(previous.values) !== JSON.stringify(record.values);
  const changes = collectWrites(s, rules.rules, workBudget(), 1, (rule, r) => {
    if (rule.collectionId !== collectionId || r.id !== recordId) return false;
    const trigger = rule.trigger;
    if (trigger.kind === "recordCreated") return !previous;
    if (trigger.kind === "recordUpdated") return !!previous && changed;
    return (
      trigger.kind === "fieldChanged" &&
      !!previous &&
      (previous.values[trigger.fieldId] ?? null) !==
        (record.values[trigger.fieldId] ?? null)
    );
  });
  if (size(changes) + size(s) > SIMULATION_LIMITS.bytes)
    throw new Error("Event output memory limit exceeded.");
  return { snapshot: validateSnapshot(publish(s, changes)), changes };
}
