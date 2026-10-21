import type { Snapshot } from "../core/model";
import { boundedInput, unique } from "../core/model";
import { validateFormula } from "../core/formula";
import { validateCondition } from "../core/rule-validation";
import { APPLICATION_LIMITS, applicationSchema } from "./contracts";
import type {
  Application,
  AppComponent,
  DataBinding,
  InterfaceAction,
} from "./contracts";

export function validateApplication(input: unknown): Application {
  boundedInput(input);
  const app = applicationSchema.parse(input);
  unique(app.pages, "page");
  if (!app.pages.some((p) => p.id === app.homePageId))
    throw new Error("Application home page is missing.");
  const ids = new Set<string>();
  let total = 0;
  for (const page of app.pages) {
    const byId = new Map(page.nodes.map((n) => [n.id, n]));
    for (const node of page.nodes) {
      if (++total > APPLICATION_LIMITS.nodes)
        throw new Error("Application exceeds the 200 component limit.");
      if (ids.has(node.id)) throw new Error("Duplicate component IDs.");
      ids.add(node.id);
      let cursor: AppComponent | undefined = node,
        depth = 0;
      const visiting = new Set<string>();
      while (cursor) {
        if (visiting.has(cursor.id))
          throw new Error("Component hierarchy contains a cycle.");
        visiting.add(cursor.id);
        if (++depth > APPLICATION_LIMITS.depth)
          throw new Error("Component nesting exceeds 6 levels.");
        if (!cursor.parentId) break;
        cursor = byId.get(cursor.parentId);
        if (!cursor || cursor.type !== "section")
          throw new Error(
            "Component parent must be a section on the same page.",
          );
      }
    }
  }
  return app;
}
function collection(snapshot: Snapshot, id: string) {
  const c = snapshot.collections.find((c) => c.id === id);
  if (!c)
    throw new Error(
      `Collection “${id}” is missing. Choose an available collection.`,
    );
  return c;
}
export function validateBinding(snapshot: Snapshot, binding: DataBinding) {
  const c = collection(snapshot, binding.collectionId);
  if (binding.fields && new Set(binding.fields).size !== binding.fields.length)
    throw new Error("Displayed fields must be unique.");
  for (const id of [
    ...(binding.fields ?? []),
    ...(binding.sort ? [binding.sort.fieldId] : []),
  ])
    if (!c.fields.some((f) => f.id === id))
      throw new Error(
        `Field “${id}” is missing in ${c.name}. Update the binding.`,
      );
  if (binding.where) validateCondition(binding.where, c, snapshot);
  return c;
}
export function validateInterfaceAction(
  snapshot: Snapshot,
  app: Application,
  action: InterfaceAction,
) {
  if (action.type === "navigate") {
    if (!app.pages.some((p) => p.id === action.pageId))
      throw new Error("Navigation target page is missing.");
  } else if ("collectionId" in action) {
    const c = collection(snapshot, action.collectionId);
    if (action.type === "calculate")
      validateFormula(
        action.expression,
        c,
        new Set(),
        0,
        { nodes: 0 },
        snapshot,
      );
  } else if (action.type === "executeRule") {
    const r = snapshot.automation?.rules.find((r) => r.id === action.ruleId);
    if (!r || !r.enabled || r.trigger.kind !== "simulationStep")
      throw new Error(
        "Choose an enabled simulation-step rule. Event rules run only on record changes.",
      );
  } else if (
    (action.type === "advanceSimulation" ||
      action.type === "previewSimulation") &&
    !snapshot.automation?.rules.some(
      (r) => r.enabled && r.trigger.kind === "simulationStep",
    )
  )
    throw new Error(
      "No enabled simulation-step rules. Configure rules before running this action.",
    );
}
export function componentDiagnostics(
  snapshot: Snapshot,
  app: Application,
  node: AppComponent,
): string[] {
  try {
    if ("binding" in node) {
      const c = validateBinding(snapshot, node.binding);
      if (node.type === "metric")
        validateFormula(
          node.expression,
          c,
          new Set(),
          0,
          { nodes: 0 },
          snapshot,
        );
      if (node.type === "chart" || node.type === "status") {
        const f = c.fields.find((f) => f.id === node.fieldId);
        if (!f)
          throw new Error(
            "Display field is missing. Update the component properties.",
          );
        if (node.type === "chart" && !["number", "computed"].includes(f.type))
          throw new Error("Charts require a numeric or computed field.");
      }
    }
    if (node.visibility) {
      const c = collection(snapshot, node.visibility.collectionId);
      validateCondition(node.visibility.when, c, snapshot);
    }
    if (node.type === "button")
      validateInterfaceAction(snapshot, app, node.action);
    if (node.type === "simulation")
      validateInterfaceAction(snapshot, app, {
        type: "previewSimulation",
        steps: node.steps,
      });
    return [];
  } catch (e) {
    return [e instanceof Error ? e.message : "Invalid component reference."];
  }
}
export function applicationDiagnostics(snapshot: Snapshot, app: Application) {
  return app.pages.flatMap((page) =>
    page.nodes.flatMap((node) =>
      componentDiagnostics(snapshot, app, node).map((message) => ({
        pageId: page.id,
        componentId: node.id,
        title: node.title,
        message,
      })),
    ),
  );
}
export function assertApplicationReferences(
  snapshot: Snapshot,
  app: Application,
): void {
  const errors = applicationDiagnostics(snapshot, app);
  if (errors.length)
    throw new Error(errors.map((e) => `${e.title}: ${e.message}`).join("\n"));
}
