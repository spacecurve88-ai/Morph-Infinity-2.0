import type {
  Collection,
  DataRecord,
  Scalar,
  Snapshot,
  Workspace,
} from "../core/model";
import type { FeaturePlan } from "../core/engine";
import { evaluate, spend, workBudget } from "../core/formula";
import type { WorkBudget } from "../core/formula";
import { matches } from "../core/automation";
import { validateBinding, validateInterfaceAction } from "./validation";
import { APPLICATION_LIMITS } from "./contracts";
import type { Application, DataBinding, InterfaceAction } from "./contracts";
export type Selection = Record<string, string | undefined>;
export function fieldValue(
  snapshot: Snapshot,
  c: Collection,
  r: DataRecord,
  id: string,
  budget: WorkBudget,
): Scalar {
  spend(budget);
  const f = c.fields.find((f) => f.id === id);
  if (!f) throw new Error(`Field “${id}” is missing.`);
  if (f.type === "computed") {
    const result = evaluate(f.formula, c, r, 0, snapshot, budget);
    if (result.reason && result.reason !== "Missing input")
      throw new Error(result.reason);
    return result.value;
  }
  return r.values[id] ?? null;
}
export function queryBinding(
  snapshot: Snapshot,
  binding: DataBinding,
  budget = workBudget(),
  search = "",
) {
  const c = validateBinding(snapshot, binding);
  const fields = binding.fields ?? c.fields.slice(0, 12).map((f) => f.id);
  const values = new Map<string, Scalar>();
  const read = (r: DataRecord, id: string) => {
    const key = JSON.stringify([r.id, id]);
    if (!values.has(key))
      values.set(key, fieldValue(snapshot, c, r, id, budget));
    return values.get(key)!;
  };
  const rows = c.records.filter((r) => {
    spend(budget);
    if (!matches(binding.where, snapshot, c, r, budget)) return false;
    return (
      !search ||
      fields.some((id) =>
        String(read(r, id) ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    );
  });
  if (binding.sort) {
    const { fieldId, direction } = binding.sort;
    for (const r of rows) read(r, fieldId);
    rows.sort((a, b) => {
      const av = read(a, fieldId),
        bv = read(b, fieldId);
      if (av === null || bv === null)
        return av === bv ? 0 : av === null ? 1 : -1;
      const comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av) < String(bv)
            ? -1
            : String(av) > String(bv)
              ? 1
              : 0;
      return direction === "asc" ? comparison : -comparison;
    });
  }
  return { collection: c, records: rows, fields, read };
}
export function boundRecord(
  snapshot: Snapshot,
  binding: DataBinding,
  selection: Selection,
  budget = workBudget(),
) {
  const result = queryBinding(snapshot, binding, budget);
  return {
    ...result,
    record:
      binding.record === "selected"
        ? result.records.find((r) => r.id === selection[binding.collectionId])
        : result.records[0],
  };
}
export function boundNumber(
  snapshot: Snapshot,
  binding: DataBinding,
  expression: Parameters<typeof evaluate>[0],
  selection: Selection,
  budget = workBudget(),
) {
  const result = boundRecord(snapshot, binding, selection, budget);
  const value = evaluate(
    expression,
    result.collection,
    result.record ?? { id: "empty", values: {} },
    0,
    snapshot,
    budget,
  );
  if (value.reason)
    throw new Error(
      value.reason === "Missing input"
        ? "Choose a record with a numeric value."
        : value.reason,
    );
  return value.value!;
}
export function revisionSeries(
  w: Workspace,
  binding: DataBinding,
  fieldId: string,
  selection: Selection,
  budget = workBudget(),
) {
  const byId = new Map(w.commits.map((c) => [c.id, c]));
  let head: string | null = w.branches.find(
    (b) => b.id === w.activeBranchId,
  )!.head;
  const points: { label: string; value: number }[] = [];
  while (head && points.length < APPLICATION_LIMITS.chartPoints) {
    spend(budget);
    const commit = byId.get(head);
    if (!commit) throw new Error("Historical checkpoint is missing.");
    if (
      commit.snapshot.collections.some(
        (c) =>
          c.id === binding.collectionId &&
          c.fields.some((f) => f.id === fieldId),
      )
    ) {
      const result = boundRecord(commit.snapshot, binding, selection, budget);
      if (result.record) {
        const value = fieldValue(
          commit.snapshot,
          result.collection,
          result.record,
          fieldId,
          budget,
        );
        if (typeof value === "number")
          points.push({ label: commit.message, value });
      }
    }
    head = commit.parentId;
  }
  return points.reverse();
}
export type DispatchedAction =
  | { type: "navigate"; pageId: string }
  | {
      type: "record";
      mode: "create" | "edit" | "inspect";
      collectionId: string;
      record?: DataRecord;
    }
  | {
      type: "plan";
      operation: FeaturePlan["operations"][number];
      previewOnly: boolean;
    }
  | { type: "calculation"; value: number }
  | { type: "history" };
export function dispatchAction(
  snapshot: Snapshot,
  app: Application,
  action: InterfaceAction,
  selection: Selection,
): DispatchedAction {
  validateInterfaceAction(snapshot, app, action);
  if (action.type === "navigate" || action.type === "history") return action;
  if (action.type === "calculate")
    return {
      type: "calculation",
      value: boundNumber(
        snapshot,
        { collectionId: action.collectionId },
        action.expression,
        selection,
      ),
    };
  if (action.type === "executeRule")
    return {
      type: "plan",
      operation: { type: "executeRule", ruleId: action.ruleId },
      previewOnly: false,
    };
  if (
    action.type === "advanceSimulation" ||
    action.type === "previewSimulation"
  )
    return {
      type: "plan",
      operation: { type: "simulate", steps: action.steps },
      previewOnly: action.type === "previewSimulation",
    };
  if (!("collectionId" in action))
    throw new Error("Unsupported interface action.");
  const c = snapshot.collections.find((c) => c.id === action.collectionId)!;
  if (action.type === "createRecord")
    return { type: "record", mode: "create", collectionId: c.id };
  const record = c.records.find((r) => r.id === selection[c.id]);
  if (!record) throw new Error(`Select a record in ${c.name} first.`);
  return {
    type: "record",
    mode: action.type === "editRecord" ? "edit" : "inspect",
    collectionId: c.id,
    record,
  };
}
