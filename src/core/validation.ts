import { boundedInput, documentSchema, snapshotSchema, unique } from "./model";
import type { Document, Snapshot } from "./model";
import { validateFormula } from "./formula";
import { validateRuleset } from "./rule-validation";

export function validateSnapshot(input: unknown): Snapshot {
  boundedInput(input);
  const snapshot = snapshotSchema.parse(input);
  unique(snapshot.collections, "collection");
  for (const c of snapshot.collections) {
    unique(c.fields, "field");
    unique(c.records, "record");
    unique(c.rules, "rule");
    if (
      new Set(c.fields.map((f) => f.name.toLowerCase())).size !==
      c.fields.length
    )
      throw new Error("Field names must be unique.");
    for (const f of c.fields) {
      if (f.type === "computed")
        validateFormula(
          f.formula,
          c,
          new Set([`${c.id}/${f.id}`]),
          0,
          { nodes: 0 },
          snapshot,
        );
      if (
        f.type === "relation" &&
        !snapshot.collections.some((t) => t.id === f.targetCollectionId)
      )
        throw new Error("Relation target collection is missing.");
    }
    for (const rule of c.rules) {
      const trigger = c.fields.find((f) => f.id === rule.triggerFieldId);
      if (
        !trigger ||
        !["text", "select"].includes(trigger.type) ||
        (trigger.type === "select" && !trigger.options.includes(rule.equals))
      )
        throw new Error("Invalid rule trigger.");
      if (c.fields.find((f) => f.id === rule.setFieldId)?.type !== "date")
        throw new Error("Rule must target a date field.");
    }
    for (const record of c.records)
      for (const [id, value] of Object.entries(record.values)) {
        const f = c.fields.find((x) => x.id === id);
        if (!f || f.type === "computed")
          throw new Error("Record has unknown or computed stored fields.");
        if (value === null) continue;
        if (
          (f.type === "number" && typeof value !== "number") ||
          (f.type === "boolean" && typeof value !== "boolean") ||
          (["text", "select", "date", "relation"].includes(f.type) &&
            typeof value !== "string")
        )
          throw new Error(`Invalid value for ${f.name}.`);
        if (f.type === "select" && !f.options.includes(String(value)))
          throw new Error("Invalid select value.");
        if (
          f.type === "date" &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
            new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value)
        )
          throw new Error("Invalid date.");
        if (
          f.type === "relation" &&
          !snapshot.collections
            .find((t) => t.id === f.targetCollectionId)
            ?.records.some((r) => r.id === value)
        )
          throw new Error(
            "Related record is missing. Remove its references before deleting it.",
          );
      }
  }
  if (snapshot.automation) validateRuleset(snapshot, snapshot.automation);
  return snapshot;
}
export function validateDocument(input: unknown): Document {
  boundedInput(input);
  const document = documentSchema.parse(input);
  unique(document.workspaces, "workspace");
  for (const w of document.workspaces) {
    unique(w.branches, "branch");
    unique(w.commits, "commit");
    if (
      new Set(w.branches.map((b) => b.name.toLowerCase())).size !==
      w.branches.length
    )
      throw new Error("Branch names must be unique.");
    if (!w.branches.some((b) => b.id === w.activeBranchId))
      throw new Error("Active branch is missing.");
    const preceding = new Set<string>();
    for (const commit of w.commits) {
      if (commit.parentId !== null && !preceding.has(commit.parentId))
        throw new Error("Commit history has a missing parent or cycle.");
      validateSnapshot(commit.snapshot);
      preceding.add(commit.id);
    }
    for (const branch of w.branches)
      if (!preceding.has(branch.head))
        throw new Error("Branch head is missing.");
  }
  return document;
}
