import { uid } from "../core/model";
import type { Snapshot } from "../core/model";
import { COMPONENT_REGISTRY } from "./contracts";
import type { Application, AppComponent, ComponentType } from "./contracts";
import { validateApplication } from "./validation";
export function newApplication(name = "My application"): Application {
  const id = uid(),
    homePageId = uid();
  return {
    version: 1,
    id,
    name,
    homePageId,
    pages: [{ id: homePageId, title: "Home", columns: 2, nodes: [] }],
  };
}
export function newComponent(
  type: ComponentType,
  snapshot: Snapshot,
  pageId: string,
): AppComponent {
  const common = {
    id: uid(),
    title: COMPONENT_REGISTRY[type],
    tone: "plain" as const,
    span: 1,
  };
  const c = snapshot.collections[0],
    binding = { collectionId: c?.id ?? "unbound" };
  if (type === "section") return { ...common, type, columns: 2 };
  if (type === "heading")
    return { ...common, type, text: "Your heading", level: 2 };
  if (type === "text")
    return {
      ...common,
      type,
      text: "Add a description, instructions, or a label.",
    };
  if (type === "button")
    return { ...common, type, action: { type: "navigate", pageId } };
  if (type === "simulation") return { ...common, type, steps: 1 };
  if (type === "metric")
    return {
      ...common,
      type,
      binding,
      expression: {
        kind: "aggregate",
        op: "count",
        collectionId: binding.collectionId,
      },
      format: "number",
    };
  if (type === "chart")
    return {
      ...common,
      type,
      binding,
      fieldId:
        c?.fields.find((f) => f.type === "number" || f.type === "computed")
          ?.id ?? "unbound",
      source: "records",
    };
  if (type === "status")
    return {
      ...common,
      type,
      binding,
      fieldId:
        c?.fields.find((f) => f.type === "select")?.id ??
        c?.fields[0].id ??
        "unbound",
    };
  if (type === "form") return { ...common, type, binding, mode: "create" };
  return { ...common, type, binding };
}
export function changeNodes(
  app: Application,
  pageId: string,
  edit: (nodes: AppComponent[]) => AppComponent[],
): Application {
  return validateApplication({
    ...app,
    pages: app.pages.map((p) =>
      p.id === pageId ? { ...p, nodes: edit(structuredClone(p.nodes)) } : p,
    ),
  });
}
export function addComponent(
  app: Application,
  pageId: string,
  node: AppComponent,
): Application {
  return changeNodes(app, pageId, (nodes) => [...nodes, node]);
}
export function updateComponent(
  app: Application,
  pageId: string,
  node: AppComponent,
): Application {
  return changeNodes(app, pageId, (nodes) =>
    nodes.map((n) => (n.id === node.id ? node : n)),
  );
}
export function removeComponent(
  app: Application,
  pageId: string,
  id: string,
): Application {
  return changeNodes(app, pageId, (nodes) => {
    const removed = new Set([id]);
    for (let i = 0; i < nodes.length; i++)
      for (const node of nodes)
        if (node.parentId && removed.has(node.parentId)) removed.add(node.id);
    return nodes.filter((n) => !removed.has(n.id));
  });
}
export function moveComponent(
  app: Application,
  pageId: string,
  id: string,
  direction: -1 | 1,
): Application {
  return changeNodes(app, pageId, (nodes) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error("Component not found.");
    const siblings = nodes.filter((n) => n.parentId === node.parentId),
      index = siblings.findIndex((n) => n.id === id),
      other = siblings[index + direction];
    if (!other) return nodes;
    const a = nodes.indexOf(node),
      b = nodes.indexOf(other);
    [nodes[a], nodes[b]] = [nodes[b], nodes[a]];
    return nodes;
  });
}
