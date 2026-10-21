import { z } from "zod";

export const key = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine(
    (v) => !["__proto__", "prototype", "constructor"].includes(v),
    "Reserved identifier",
  );
const label = z.string().trim().min(1).max(100);
export const unitSchema = z.enum(["number", "pages", "minutes", "money"]);
export type Unit = z.infer<typeof unitSchema>;
export type Formula =
  | { kind: "field"; fieldId: string }
  | { kind: "number"; value: number }
  | {
      kind: "binary";
      op: "+" | "-" | "*" | "/";
      left: Formula;
      right: Formula;
    };
export const formulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("field"), fieldId: key }).strict(),
    z
      .object({ kind: z.literal("number"), value: z.number().finite() })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        op: z.enum(["+", "-", "*", "/"]),
        left: formulaSchema,
        right: formulaSchema,
      })
      .strict(),
  ]),
);
export const fieldSchema = z.discriminatedUnion("type", [
  z.object({ id: key, name: label, type: z.literal("text") }).strict(),
  z
    .object({
      id: key,
      name: label,
      type: z.literal("number"),
      unit: unitSchema,
    })
    .strict(),
  z.object({ id: key, name: label, type: z.literal("date") }).strict(),
  z.object({ id: key, name: label, type: z.literal("boolean") }).strict(),
  z
    .object({
      id: key,
      name: label,
      type: z.literal("select"),
      options: z.array(label).min(1).max(20),
    })
    .strict(),
  z
    .object({
      id: key,
      name: label,
      type: z.literal("computed"),
      formula: formulaSchema,
    })
    .strict(),
  z
    .object({
      id: key,
      name: label,
      type: z.literal("relation"),
      targetCollectionId: key,
    })
    .strict(),
]);
export type Field = z.infer<typeof fieldSchema>;
export const recordSchema = z
  .object({
    id: key,
    values: z.record(
      key,
      z.union([
        z.string().max(10000),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ]),
    ),
  })
  .strict();
export type DataRecord = z.infer<typeof recordSchema>;
export const ruleSchema = z
  .object({ id: key, triggerFieldId: key, equals: label, setFieldId: key })
  .strict();
export const collectionSchema = z
  .object({
    id: key,
    name: label,
    fields: z.array(fieldSchema).min(1).max(40),
    records: z.array(recordSchema).max(10000),
    rules: z.array(ruleSchema).max(20),
  })
  .strict();
export type Collection = z.infer<typeof collectionSchema>;
export const snapshotSchema = z
  .object({ collections: z.array(collectionSchema).max(30) })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export const commitSchema = z
  .object({
    id: key,
    parentId: key.nullable(),
    at: z.iso.datetime(),
    message: z.string().min(1).max(200),
    snapshot: snapshotSchema,
  })
  .strict();
export type Commit = z.infer<typeof commitSchema>;
export const workspaceSchema = z
  .object({
    id: key,
    name: label,
    activeBranchId: key,
    branches: z
      .array(z.object({ id: key, name: label, head: key }).strict())
      .min(1)
      .max(30),
    commits: z.array(commitSchema).min(1).max(200),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export const documentSchema = z
  .object({
    format: z.literal(2),
    revision: key,
    workspaces: z.array(workspaceSchema).max(20),
  })
  .strict();
export type Document = z.infer<typeof documentSchema>;
export const uid = () => crypto.randomUUID();
export const emptyDocument = (): Document => ({
  format: 2,
  revision: uid(),
  workspaces: [],
});
export function currentSnapshot(w: Workspace): Snapshot {
  const branch = w.branches.find((b) => b.id === w.activeBranchId);
  const commit = w.commits.find((c) => c.id === branch?.head);
  if (!commit)
    throw new Error(
      "Workspace history is damaged. Export a recovery copy before making changes.",
    );
  return commit.snapshot;
}
export function boundedInput(input: unknown, maxDepth = 45): void {
  let count = 0;
  const stack: [unknown, number][] = [[input, 0]];
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (depth > maxDepth || ++count > 500000)
      throw new Error("Input is too large or deeply nested.");
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(k))
          throw new Error("Unsafe object key.");
        stack.push([v, depth + 1]);
      }
    }
  }
}
export function unique(items: { id: string }[], what: string): void {
  if (new Set(items.map((x) => x.id)).size !== items.length)
    throw new Error(`Duplicate ${what} IDs.`);
}
