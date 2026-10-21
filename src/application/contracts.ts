import { z } from "zod";
import { key, label, conditionSchema, formulaSchema } from "../core/contracts";

export const APPLICATION_LIMITS = Object.freeze({
  applications: 5,
  pages: 8,
  nodes: 200,
  depth: 6,
  rows: 100,
  chartPoints: 50,
  work: 200000,
});
export const bindingSchema = z
  .object({
    collectionId: key,
    fields: z.array(key).min(1).max(12).optional(),
    where: conditionSchema.optional(),
    sort: z
      .object({ fieldId: key, direction: z.enum(["asc", "desc"]) })
      .strict()
      .optional(),
    record: z.enum(["selected", "first"]).optional(),
  })
  .strict();
export type DataBinding = z.infer<typeof bindingSchema>;
export const interfaceActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), pageId: key }).strict(),
  z
    .object({
      type: z.enum(["createRecord", "editRecord", "inspectRecord"]),
      collectionId: key,
    })
    .strict(),
  z.object({ type: z.literal("executeRule"), ruleId: key }).strict(),
  z
    .object({
      type: z.enum(["previewSimulation", "advanceSimulation"]),
      steps: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("calculate"),
      collectionId: key,
      expression: formulaSchema,
    })
    .strict(),
  z.object({ type: z.literal("history") }).strict(),
]);
export type InterfaceAction = z.infer<typeof interfaceActionSchema>;
const common = {
  id: key,
  parentId: key.optional(),
  title: label,
  span: z.number().int().min(1).max(3).optional(),
  tone: z.enum(["plain", "accent", "muted"]).optional(),
  hidden: z.boolean().optional(),
  visibility: z
    .object({ collectionId: key, when: conditionSchema })
    .strict()
    .optional(),
};
const format = z.enum(["number", "money", "percent"]);
export const componentSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...common,
      type: z.literal("section"),
      columns: z.number().int().min(1).max(3),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("heading"),
      text: z.string().max(2000),
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    })
    .strict(),
  z
    .object({ ...common, type: z.literal("text"), text: z.string().max(5000) })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("button"),
      action: interfaceActionSchema,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("form"),
      binding: bindingSchema,
      mode: z.enum(["create", "edit"]),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.enum(["table", "list", "cards", "detail"]),
      binding: bindingSchema,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("metric"),
      binding: bindingSchema,
      expression: formulaSchema,
      format,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("chart"),
      binding: bindingSchema,
      fieldId: key,
      source: z.enum(["records", "revisions"]),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("simulation"),
      steps: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("status"),
      binding: bindingSchema,
      fieldId: key,
    })
    .strict(),
]);
export type AppComponent = z.infer<typeof componentSchema>;
export const pageSchema = z
  .object({
    id: key,
    title: label,
    columns: z.number().int().min(1).max(3),
    nodes: z.array(componentSchema).max(APPLICATION_LIMITS.nodes),
  })
  .strict();
export type AppPage = z.infer<typeof pageSchema>;
export const applicationSchema = z
  .object({
    version: z.literal(1),
    id: key,
    name: label,
    homePageId: key,
    pages: z.array(pageSchema).min(1).max(APPLICATION_LIMITS.pages),
  })
  .strict();
export type Application = z.infer<typeof applicationSchema>;
export const applicationsSchema = z
  .object({
    version: z.literal(1),
    apps: z.array(applicationSchema).max(APPLICATION_LIMITS.applications),
  })
  .strict();
export const COMPONENT_REGISTRY = Object.freeze({
  section: "Section / panel",
  heading: "Heading",
  text: "Text / label",
  button: "Action button",
  form: "Record form",
  table: "Record table",
  list: "Record list",
  cards: "Record cards",
  detail: "Record detail",
  metric: "Numeric metric",
  chart: "Chart",
  simulation: "Simulation controls",
  status: "State indicator",
});
export type ComponentType = keyof typeof COMPONENT_REGISTRY;
