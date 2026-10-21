import { z } from "zod";
import {
  boundedInput,
  collectionSchema,
  currentSnapshot,
  fieldSchema,
  key,
  uid,
} from "./model";
import type {
  Collection,
  DataRecord,
  Document,
  Field,
  Snapshot,
  Workspace,
} from "./model";
import { validateDocument, validateSnapshot } from "./validation";

const opSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("addCollection"), collection: collectionSchema })
    .strict(),
  z
    .object({
      type: z.literal("addField"),
      collectionId: key,
      field: fieldSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("captureDateOnce"),
      collectionId: key,
      triggerFieldId: key,
      equals: z.string().min(1).max(100),
      field: z
        .object({
          id: key,
          name: z.string().trim().min(1).max(100),
          type: z.literal("date"),
        })
        .strict(),
      ruleId: key,
    })
    .strict(),
]);
export const planSchema = z
  .object({
    version: z.literal(1),
    baseRevision: key,
    workspaceId: key,
    branchId: key,
    summary: z.string().min(1).max(200),
    operations: z.array(opSchema).min(1).max(10),
  })
  .strict();
export type FeaturePlan = z.infer<typeof planSchema>;
export function workspace(document: Document, id: string): Workspace {
  const w = document.workspaces.find((w) => w.id === id);
  if (!w) throw new Error("Workspace not found.");
  return w;
}
export function previewPlan(document: Document, input: unknown): Snapshot {
  boundedInput(input);
  const plan = planSchema.parse(input);
  const w = workspace(document, plan.workspaceId);
  if (
    plan.baseRevision !== document.revision ||
    plan.branchId !== w.activeBranchId
  )
    throw new Error(
      "This plan is stale. Preview it again against the current revision.",
    );
  const next = structuredClone(currentSnapshot(w));
  for (const op of plan.operations) {
    if (op.type === "addCollection") {
      if (op.collection.records.length || op.collection.rules.length)
        throw new Error("New collections must start empty.");
      next.collections.push(op.collection);
    } else {
      const c = next.collections.find((c) => c.id === op.collectionId);
      if (!c) throw new Error("Collection not found.");
      if (op.type === "addField") c.fields.push(op.field);
      else {
        c.fields.push(op.field);
        c.rules.push({
          id: op.ruleId,
          triggerFieldId: op.triggerFieldId,
          equals: op.equals,
          setFieldId: op.field.id,
        });
      }
    }
  }
  return validateSnapshot(next);
}
export function commitSnapshot(
  w: Workspace,
  snapshot: Snapshot,
  message: string,
): void {
  if (w.commits.length >= 200)
    throw new Error(
      "History limit reached (200 commits). Export a backup before continuing in a new workspace.",
    );
  const branch = w.branches.find((b) => b.id === w.activeBranchId)!;
  const id = uid();
  w.commits.push({
    id,
    parentId: branch.head,
    at: new Date().toISOString(),
    message,
    snapshot: validateSnapshot(snapshot),
  });
  branch.head = id;
}
export function applyPlan(document: Document, plan: FeaturePlan): Document {
  const snapshot = previewPlan(document, plan);
  const next = structuredClone(document);
  commitSnapshot(workspace(next, plan.workspaceId), snapshot, plan.summary);
  return next;
}
export function createWorkspace(document: Document, name: string): Document {
  const next = structuredClone(document);
  const id = uid(),
    commitId = uid(),
    branchId = uid();
  next.workspaces.push({
    id,
    name: name.trim(),
    activeBranchId: branchId,
    branches: [{ id: branchId, name: "main", head: commitId }],
    commits: [
      {
        id: commitId,
        parentId: null,
        at: new Date().toISOString(),
        message: "Workspace created",
        snapshot: { collections: [] },
      },
    ],
  });
  return validateDocument(next);
}
export function forkBranch(
  document: Document,
  workspaceId: string,
  name: string,
): Document {
  const next = structuredClone(document),
    w = workspace(next, workspaceId);
  const branch = {
    id: uid(),
    name: name.trim(),
    head: w.branches.find((b) => b.id === w.activeBranchId)!.head,
  };
  w.branches.push(branch);
  w.activeBranchId = branch.id;
  return validateDocument(next);
}
export function switchBranch(
  document: Document,
  workspaceId: string,
  branchId: string,
): Document {
  const next = structuredClone(document);
  workspace(next, workspaceId).activeBranchId = branchId;
  return validateDocument(next);
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function saveRecord(
  document: Document,
  workspaceId: string,
  collectionId: string,
  record: DataRecord,
  date = localDate(),
): Document {
  const next = structuredClone(document),
    w = workspace(next, workspaceId),
    snapshot = structuredClone(currentSnapshot(w));
  const c = snapshot.collections.find((c) => c.id === collectionId);
  if (!c) throw new Error("Collection not found.");
  const index = c.records.findIndex((r) => r.id === record.id),
    previous = c.records[index];
  const updated = structuredClone(record);
  for (const rule of c.rules) {
    if (previous?.values[rule.setFieldId] != null)
      updated.values[rule.setFieldId] = previous.values[rule.setFieldId];
    else {
      updated.values[rule.setFieldId] =
        updated.values[rule.triggerFieldId] === rule.equals &&
        previous?.values[rule.triggerFieldId] !== rule.equals
          ? date
          : null;
    }
  }
  if (index < 0) c.records.push(updated);
  else c.records[index] = updated;
  commitSnapshot(
    w,
    snapshot,
    index < 0 ? `Added record to ${c.name}` : `Updated record in ${c.name}`,
  );
  return next;
}
export function deleteRecord(
  document: Document,
  workspaceId: string,
  collectionId: string,
  recordId: string,
): Document {
  const next = structuredClone(document),
    w = workspace(next, workspaceId),
    snapshot = structuredClone(currentSnapshot(w));
  const c = snapshot.collections.find((c) => c.id === collectionId);
  if (!c || !c.records.some((r) => r.id === recordId))
    throw new Error("Record not found.");
  c.records = c.records.filter((r) => r.id !== recordId);
  commitSnapshot(w, snapshot, `Deleted record from ${c.name}`);
  return next;
}
export function restoreCommit(
  document: Document,
  workspaceId: string,
  commitId: string,
  mode: "design" | "full",
): Document {
  const next = structuredClone(document),
    w = workspace(next, workspaceId),
    target = w.commits.find((c) => c.id === commitId);
  if (!target) throw new Error("Commit not found.");
  const snapshot = structuredClone(target.snapshot);
  if (mode === "design") {
    const current = currentSnapshot(w);
    // Retain every current collection and record. Removed fields' data makes a design-only restore unsafe.
    for (const c of current.collections) {
      const historical = snapshot.collections.find((t) => t.id === c.id);
      if (!historical)
        throw new Error(
          "Design-only restore would remove a collection. Use full restore after exporting a backup.",
        );
      for (const field of c.fields)
        if (
          !historical.fields.some((f) => f.id === field.id) &&
          c.records.some((r) => r.values[field.id] != null)
        )
          throw new Error(
            "Design-only restore would discard field values. Use a full restore or choose another revision.",
          );
      historical.records = c.records.map((r) => ({
        ...r,
        values: Object.fromEntries(
          Object.entries(r.values).filter(([id]) =>
            historical.fields.some((f) => f.id === id && f.type !== "computed"),
          ),
        ),
      }));
    }
    for (const c of snapshot.collections)
      if (!current.collections.some((t) => t.id === c.id)) c.records = [];
  }
  commitSnapshot(
    w,
    snapshot,
    `Restored ${mode === "design" ? "design only" : "design and records"}: ${target.message}`,
  );
  return next;
}
export function displayValue(field: Field, record: DataRecord): string {
  const value = record.values[field.id];
  return value == null
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
}
export function monthlyCounts(
  collection: Collection,
  fieldId: string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of collection.records) {
    const date = r.values[fieldId];
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
      counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}
