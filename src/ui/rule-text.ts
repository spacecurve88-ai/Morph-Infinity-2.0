import type {
  AutomationRule,
  Collection,
  Condition,
  Snapshot,
} from "../core/model";
import { formulaText } from "../core/formula";
export const operatorLabels = {
  eq: "equals",
  ne: "does not equal",
  lt: "is less than",
  lte: "is at most",
  gt: "is greater than",
  gte: "is at least",
};
export function conditionText(
  p: Condition,
  c: Collection,
  s: Snapshot,
): string {
  if ("conditions" in p)
    return `(${p.conditions.map((v) => conditionText(v, c, s)).join(p.kind === "all" ? " AND " : " OR ")})`;
  if (p.kind === "numeric")
    return `${formulaText(p.left, c, s)} ${operatorLabels[p.op]} ${formulaText(p.right, c, s)}`;
  return `${c.fields.find((f) => f.id === p.fieldId)?.name ?? p.fieldId} ${operatorLabels[p.op]} ${p.value === null ? "empty" : String(p.value)}`;
}
export function ruleSummary(rule: AutomationRule, s: Snapshot): string {
  const c = s.collections.find((c) => c.id === rule.collectionId);
  if (!c) return "Missing collection";
  const trigger = rule.trigger;
  const when =
    trigger.kind === "fieldChanged"
      ? `when ${c.fields.find((f) => f.id === trigger.fieldId)?.name ?? trigger.fieldId} changes`
      : trigger.kind === "recordCreated"
        ? "when a record is created"
        : trigger.kind === "recordUpdated"
          ? "when a record is edited"
          : "on each simulation step";
  return `${c.name}: ${when}${rule.when ? `, if ${conditionText(rule.when, c, s)}` : ""} → ${rule.actions
    .map((a) => {
      const target =
        c.fields.find((f) => f.id === a.fieldId)?.name ?? a.fieldId;
      if (a.kind === "transition")
        return `${target}: ${a.from.join(" / ")} → ${a.to}`;
      if (a.kind === "setValue")
        return `set ${target} to ${a.value === null ? "empty" : String(a.value)}`;
      return `${a.kind === "setNumber" ? "set" : a.kind === "increment" ? "increase" : "decrease"} ${target} ${a.kind === "setNumber" ? "to" : "by"} ${formulaText(a.value, c, s)}`;
    })
    .join("; ")}.`;
}
