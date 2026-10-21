import type { Collection, DataRecord, Field, Snapshot } from "../core/model";
import type { WorkBudget } from "../core/formula";
import { ruleSummary } from "./rule-text";
import { displayValue } from "../core/engine";
import { evaluate, formulaText, spend } from "../core/formula";

export function recordTitle(c: Collection, r: DataRecord) {
  return String(
    r.values[c.fields.find((f) => f.type === "text")?.id ?? ""] ??
      "Untitled record",
  );
}
export function valueText(
  f: Field,
  c: Collection,
  r: DataRecord,
  snapshot: Snapshot,
  budget?: WorkBudget,
): { text: string; reason?: string; numeric?: number | null } {
  if (budget) spend(budget);
  if (f.type === "computed") {
    const result = evaluate(f.formula, c, r, 0, snapshot, budget);
    return {
      text:
        result.value === null
          ? "—"
          : new Intl.NumberFormat(undefined, {
              maximumFractionDigits: 3,
            }).format(result.value),
      reason: result.reason,
      numeric: result.value,
    };
  }
  if (f.type === "relation") {
    const target = snapshot.collections.find(
      (t) => t.id === f.targetCollectionId,
    );
    if (budget) spend(budget, target?.records.length ?? 0);
    const record = target?.records.find((t) => t.id === r.values[f.id]);
    return { text: target && record ? recordTitle(target, record) : "—" };
  }
  return { text: displayValue(f, r) };
}
export function compareSnapshots(a: Snapshot, b: Snapshot) {
  const lines: string[] = [];
  const byCollection = new Map(a.collections.map((c) => [c.id, c]));
  for (const c of b.collections) {
    const previous = byCollection.get(c.id);
    if (!previous) {
      lines.push(
        `+ ${c.name}: new collection, ${c.fields.length} fields, ${c.records.length} records`,
      );
      continue;
    }
    for (const f of c.fields) {
      const old = previous.fields.find((p) => p.id === f.id);
      if (!old)
        lines.push(
          `+ ${c.name} → ${f.name}${f.type === "computed" ? ` = ${formulaText(f.formula, c)}` : ` (${f.type})`}`,
        );
      else if (JSON.stringify(old) !== JSON.stringify(f))
        lines.push(`Changed field: ${c.name} → ${f.name}`);
    }
    for (const f of previous.fields)
      if (!c.fields.some((p) => p.id === f.id))
        lines.push(`− ${c.name} → ${f.name}`);
    const oldRecords = new Map(previous.records.map((r) => [r.id, r]));
    const newRecords = new Set(c.records.map((r) => r.id));
    const added = c.records.filter((r) => !oldRecords.has(r.id)).length;
    const removed = previous.records.filter(
      (r) => !newRecords.has(r.id),
    ).length;
    const changed = c.records.filter((r) => {
      const p = oldRecords.get(r.id);
      return p && JSON.stringify(p) !== JSON.stringify(r);
    }).length;
    if (added || removed || changed)
      lines.push(
        `${c.name} records: ${added} added, ${removed} removed, ${changed} changed`,
      );
    if (JSON.stringify(c.rules) !== JSON.stringify(previous.rules))
      lines.push(`${c.name}: date-capture rules changed`);
  }
  for (const c of a.collections)
    if (!b.collections.some((p) => p.id === c.id))
      lines.push(
        `− ${c.name}: collection removed (${c.records.length} records)`,
      );
  const previousRules = new Map(
    (a.automation?.rules ?? []).map((r) => [r.id, r]),
  );
  for (const rule of b.automation?.rules ?? []) {
    const prior = previousRules.get(rule.id);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(rule))
      lines.push(
        `${prior ? "Changed" : "+"} rule “${rule.name}” (${rule.enabled ? "enabled" : "disabled"}): ${ruleSummary(rule, b)}`,
      );
    previousRules.delete(rule.id);
  }
  for (const rule of previousRules.values())
    lines.push(`− Rule “${rule.name}” removed`);
  return lines;
}
