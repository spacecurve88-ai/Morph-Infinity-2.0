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
export const label = z.string().trim().min(1).max(100);
export const unitSchema = z.enum(["number", "pages", "minutes", "money"]);
export type Unit = z.infer<typeof unitSchema>;

export const scalarSchema = z.union([
  z.string().max(10000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export type Scalar = z.infer<typeof scalarSchema>;
export const filterSchema = z.union([
  z.object({ fieldId: key, equals: scalarSchema }).strict(),
  z.object({ fieldId: key, sourceFieldId: key }).strict(),
  z.object({ fieldId: key, sourceRecordId: z.literal(true) }).strict(),
]);
export type AggregateFilter = z.infer<typeof filterSchema>;
export type Formula =
  | { kind: "field"; fieldId: string }
  | { kind: "number"; value: number; unit?: Unit }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Formula; right: Formula }
  | {
      kind: "aggregate";
      op: "sum";
      collectionId: string;
      fieldId: string;
      where?: AggregateFilter;
    }
  | {
      kind: "aggregate";
      op: "count";
      collectionId: string;
      where?: AggregateFilter;
    };
export const formulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("field"), fieldId: key }).strict(),
    z
      .object({
        kind: z.literal("number"),
        value: z.number().finite(),
        unit: unitSchema.optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        op: z.enum(["+", "-", "*", "/"]),
        left: formulaSchema,
        right: formulaSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("aggregate"),
        op: z.literal("sum"),
        collectionId: key,
        fieldId: key,
        where: filterSchema.optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("aggregate"),
        op: z.literal("count"),
        collectionId: key,
        where: filterSchema.optional(),
      })
      .strict(),
  ]),
);
export const comparison = z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]);
export type Condition =
  | {
      kind: "compare";
      fieldId: string;
      op: z.infer<typeof comparison>;
      value: Scalar;
    }
  | {
      kind: "numeric";
      left: Formula;
      op: z.infer<typeof comparison>;
      right: Formula;
    }
  | { kind: "all" | "any"; conditions: Condition[] };
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z
      .object({
        kind: z.literal("compare"),
        fieldId: key,
        op: comparison,
        value: scalarSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("numeric"),
        left: formulaSchema,
        op: comparison,
        right: formulaSchema,
      })
      .strict(),
    z
      .object({
        kind: z.enum(["all", "any"]),
        conditions: z.array(conditionSchema).min(1).max(8),
      })
      .strict(),
  ]),
);
export const actionSchema = z.union([
  z
    .object({
      kind: z.enum(["setNumber", "increment", "decrement"]),
      fieldId: key,
      value: formulaSchema,
    })
    .strict(),
  z
    .object({ kind: z.literal("setValue"), fieldId: key, value: scalarSchema })
    .strict(),
  z
    .object({
      kind: z.literal("transition"),
      fieldId: key,
      from: z.array(label).min(1).max(20),
      to: label,
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export const triggerSchema = z.union([
  z
    .object({
      kind: z.enum(["simulationStep", "recordCreated", "recordUpdated"]),
    })
    .strict(),
  z.object({ kind: z.literal("fieldChanged"), fieldId: key }).strict(),
]);
export const automationRuleSchema = z
  .object({
    version: z.literal(1),
    id: key,
    name: label,
    collectionId: key,
    enabled: z.boolean(),
    trigger: triggerSchema,
    when: conditionSchema.optional(),
    actions: z.array(actionSchema).min(1).max(8),
  })
  .strict();
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export const automationSchema = z
  .object({
    version: z.literal(1),
    rules: z.array(automationRuleSchema).max(50),
  })
  .strict();
export type Ruleset = z.infer<typeof automationSchema>;
