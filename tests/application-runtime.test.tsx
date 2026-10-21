import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { economicExample } from "../src/examples/economy";
import { ApplicationCanvas } from "../src/ui/builder/ApplicationCanvas";
import {
  addComponent,
  changeNodes,
  moveComponent,
  newApplication,
  newComponent,
  removeComponent,
  updateComponent,
} from "../src/application/editing";
import {
  boundNumber,
  dispatchAction,
  fieldValue,
  queryBinding,
  revisionSeries,
} from "../src/application/runtime";
import { COMPONENT_REGISTRY } from "../src/application/contracts";
import type {
  Application,
  AppComponent,
  ComponentType,
} from "../src/application/contracts";
import { workBudget } from "../src/core/formula";
import {
  createWorkspace,
  applyPlan,
  forkBranch,
  previewPlanDetails,
} from "../src/core/engine";
import { currentSnapshot, emptyDocument } from "../src/core/model";
import { basePlan } from "../src/planner/parse";
const fixture = () => {
  let d = createWorkspace(emptyDocument(), "Renderer");
  d = applyPlan(
    d,
    basePlan(d, d.workspaces[0], "Example", [
      { type: "addBundle", snapshot: economicExample() },
    ]),
  );
  return { d, w: d.workspaces[0], snapshot: currentSnapshot(d.workspaces[0]) };
};
const appWith = (node: AppComponent): Application => ({
  version: 1,
  id: "app",
  name: "App",
  homePageId: "home",
  pages: [{ id: "home", title: "Home", columns: 2, nodes: [node] }],
});
describe("generic binding resolver", () => {
  it("uses typed numeric sorting, filters and safe computed related sums", () => {
    const { snapshot } = fixture();
    const result = queryBinding(snapshot, {
      collectionId: "example-companies",
      where: { kind: "compare", fieldId: "cash", op: "gt", value: 0 },
      sort: { fieldId: "expenses", direction: "desc" },
    });
    expect(result.records.map((r) => r.id)).toEqual(["company-a", "company-b"]);
    expect(result.read(result.records[0], "expenses")).toBe(7);
    expect(
      queryBinding(
        snapshot,
        { collectionId: "example-expenses" },
        undefined,
        "Rent",
      ).records,
    ).toHaveLength(1);
  });
  it("calculates cross-collection metrics and empty aggregates", () => {
    const { snapshot } = fixture();
    expect(
      boundNumber(
        snapshot,
        { collectionId: "example-companies" },
        {
          kind: "aggregate",
          op: "sum",
          collectionId: "example-expenses",
          fieldId: "amount",
        },
        {},
      ),
    ).toBe(10);
    snapshot.collections[1].records = [];
    expect(
      boundNumber(
        snapshot,
        { collectionId: "example-companies" },
        { kind: "aggregate", op: "count", collectionId: "example-expenses" },
        {},
      ),
    ).toBe(0);
  });
  it("reports missing fields, missing inputs and arithmetic failures", () => {
    const { snapshot } = fixture();
    expect(() => queryBinding(snapshot, { collectionId: "gone" })).toThrow(
      /missing/,
    );
    expect(() =>
      boundNumber(
        snapshot,
        { collectionId: "example-companies" },
        {
          kind: "binary",
          op: "/",
          left: { kind: "number", value: 1 },
          right: { kind: "number", value: 0 },
        },
        {},
      ),
    ).toThrow(/Division/);
    expect(() =>
      fieldValue(
        snapshot,
        snapshot.collections[0],
        snapshot.collections[0].records[0],
        "gone",
        workBudget(),
      ),
    ).toThrow(/missing/);
  });
  it("shares a global query work budget and leaves inputs intact", () => {
    const { snapshot } = fixture(),
      before = JSON.stringify(snapshot),
      budget = workBudget(5);
    expect(() =>
      queryBinding(
        snapshot,
        {
          collectionId: "example-companies",
          sort: { fieldId: "expenses", direction: "asc" },
        },
        budget,
      ),
    ).toThrow(/budget/);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it("reads only the active branch's available revision checkpoints", () => {
    const { d, w } = fixture();
    const next = applyPlan(
      d,
      basePlan(d, w, "Five steps", [{ type: "simulate", steps: 5 }]),
    );
    const points = revisionSeries(
      next.workspaces[0],
      { collectionId: "example-companies" },
      "cash",
      {},
    );
    expect(points.map((p) => p.value)).toEqual([10, -2]);
    const fork = forkBranch(d, w.id, "Other");
    expect(
      revisionSeries(
        fork.workspaces[0],
        { collectionId: "example-companies" },
        "cash",
        {},
      ).map((p) => p.value),
    ).toEqual([10]);
  });
});
describe("allowlisted action dispatcher", () => {
  it("returns navigation, selection, create/edit/inspect and history commands without mutating", () => {
    const { snapshot } = fixture(),
      app = appWith({ id: "h", title: "T", type: "text", text: "T" }),
      before = JSON.stringify(snapshot);
    expect(
      dispatchAction(snapshot, app, { type: "navigate", pageId: "home" }, {}),
    ).toEqual({ type: "navigate", pageId: "home" });
    expect(dispatchAction(snapshot, app, { type: "history" }, {})).toEqual({
      type: "history",
    });
    expect(
      dispatchAction(
        snapshot,
        app,
        { type: "createRecord", collectionId: "example-companies" },
        {},
      ),
    ).toMatchObject({ type: "record", mode: "create" });
    expect(() =>
      dispatchAction(
        snapshot,
        app,
        { type: "editRecord", collectionId: "example-companies" },
        {},
      ),
    ).toThrow(/Select/);
    for (const type of ["editRecord", "inspectRecord"] as const)
      expect(
        dispatchAction(
          snapshot,
          app,
          { type, collectionId: "example-companies" },
          { "example-companies": "company-a" },
        ),
      ).toMatchObject({ type: "record", record: { id: "company-a" } });
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it("distinguishes read-only preview from an advance requiring approval", () => {
    const { snapshot } = fixture(),
      app = newApplication();
    expect(
      dispatchAction(
        snapshot,
        app,
        { type: "previewSimulation", steps: 5 },
        {},
      ),
    ).toMatchObject({
      type: "plan",
      previewOnly: true,
      operation: { type: "simulate", steps: 5 },
    });
    expect(
      dispatchAction(
        snapshot,
        app,
        { type: "advanceSimulation", steps: 2 },
        {},
      ),
    ).toMatchObject({ type: "plan", previewOnly: false });
    expect(
      dispatchAction(
        snapshot,
        app,
        {
          type: "calculate",
          collectionId: "example-companies",
          expression: {
            kind: "aggregate",
            op: "count",
            collectionId: "example-expenses",
          },
        },
        {},
      ),
    ).toEqual({ type: "calculation", value: 3 });
  });
  it("executes an existing rule through the same pure preview and atomic plan", () => {
    const { snapshot, d, w } = fixture();
    const action = dispatchAction(
      snapshot,
      newApplication(),
      { type: "executeRule", ruleId: "example-cash-flow" },
      {},
    );
    if (action.type !== "plan") throw new Error("Expected a plan");
    const plan = basePlan(d, w, "Run a rule", [action.operation]),
      before = JSON.stringify(d);
    const preview = previewPlanDetails(d, plan);
    expect(preview.snapshot.collections[0].records[0].values.cash).toBe(7);
    expect(JSON.stringify(d)).toBe(before);
    const next = applyPlan(d, plan);
    expect(next.workspaces[0].commits).toHaveLength(w.commits.length + 1);
    snapshot.automation!.rules[0].trigger = { kind: "recordUpdated" };
    expect(() =>
      dispatchAction(
        snapshot,
        newApplication(),
        { type: "executeRule", ruleId: "example-cash-flow" },
        {},
      ),
    ).toThrow(/simulation-step/);
  });
});
describe("immutable touch editing operations", () => {
  it("creates, updates, reorders and deletes complete subtrees", () => {
    const { snapshot } = fixture(),
      original = newApplication(),
      page = original.homePageId;
    const section = newComponent("section", snapshot, page),
      a = newComponent("text", snapshot, page),
      b = newComponent("heading", snapshot, page);
    let app = addComponent(original, page, section);
    app = addComponent(app, page, { ...a, parentId: section.id });
    app = addComponent(app, page, { ...b, parentId: section.id });
    const moved = moveComponent(app, page, b.id, -1);
    expect(moved.pages[0].nodes.map((n) => n.id)).toEqual([
      section.id,
      b.id,
      a.id,
    ]);
    const edited = updateComponent(moved, page, {
      ...a,
      title: "Renamed",
      parentId: section.id,
    });
    expect(edited.pages[0].nodes.find((n) => n.id === a.id)?.title).toBe(
      "Renamed",
    );
    expect(removeComponent(edited, page, section.id).pages[0].nodes).toEqual(
      [],
    );
    expect(original.pages[0].nodes).toEqual([]);
    expect(() =>
      changeNodes(app, page, (nodes) =>
        nodes.map((n) => (n.id === section.id ? { ...n, parentId: a.id } : n)),
      ),
    ).toThrow();
  });
});
describe("controlled component renderer", () => {
  it.each(Object.keys(COMPONENT_REGISTRY) as ComponentType[])(
    "renders the supported %s primitive",
    (type) => {
      const { snapshot, w } = fixture();
      const node = newComponent(type, snapshot, "home"),
        app = appWith(node);
      const html = renderToStaticMarkup(
        <ApplicationCanvas
          app={app}
          pageId="home"
          snapshot={snapshot}
          workspace={w}
          selection={{ "example-companies": "company-a" }}
          onSelectRecord={() => {}}
          onAction={() => {}}
          onRecord={() => {}}
        />,
      );
      expect(html).toContain(`data-component-type="${type}"`);
      expect(html).not.toContain('role="alert"');
    },
  );
  it("escapes user text and renders missing references as diagnostics", () => {
    const { snapshot, w } = fixture(),
      props = {
        snapshot,
        workspace: w,
        selection: {},
        onSelectRecord: () => {},
        onAction: () => {},
        onRecord: () => {},
      };
    const html = renderToStaticMarkup(
      <ApplicationCanvas
        {...props}
        app={appWith({
          id: "t",
          type: "text",
          title: "T",
          text: '<img src=x onerror="evil()">',
        })}
        pageId="home"
      />,
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    const error = renderToStaticMarkup(
      <ApplicationCanvas
        {...props}
        app={appWith({
          id: "t",
          type: "table",
          title: "T",
          binding: { collectionId: "gone" },
        })}
        pageId="home"
      />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain("missing");
  });
});
