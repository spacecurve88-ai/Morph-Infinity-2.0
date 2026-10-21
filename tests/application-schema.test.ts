import { describe, it, expect } from "vitest";
import {
  applicationSchema,
  COMPONENT_REGISTRY,
  componentSchema,
} from "../src/application/contracts";
import type { Application, AppComponent } from "../src/application/contracts";
import {
  validateApplication,
  applicationDiagnostics,
  assertApplicationReferences,
} from "../src/application/validation";
import { validateSnapshot } from "../src/core/validation";
import { setup } from "./helpers";
export function sampleApp(nodes: AppComponent[] = []): Application {
  return {
    version: 1,
    id: "app",
    name: "My app",
    homePageId: "home",
    pages: [{ id: "home", title: "Home", columns: 2, nodes }],
  };
}
const heading: AppComponent = {
  id: "heading",
  title: "Title",
  type: "heading",
  text: "Hello",
  level: 2,
};
describe("versioned application documents", () => {
  it("preserves old format-2 snapshots without inserted defaults", () => {
    const { c } = setup(),
      old = { collections: [c] };
    expect(validateSnapshot(old)).toEqual(old);
    expect("applications" in validateSnapshot(old)).toBe(false);
  });
  it("round trips the optional extension", () => {
    const { c } = setup(),
      snapshot = {
        collections: [c],
        applications: { version: 1, apps: [sampleApp([heading])] },
      };
    expect(validateSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });
  it.each(["script", "iframe", "html", "unknown"])(
    "rejects unsupported component %s",
    (type) => {
      expect(() =>
        validateApplication(sampleApp([{ ...heading, type } as never])),
      ).toThrow();
    },
  );
  it.each(["eval", "fetch", "javascript", "deleteWorkspace"])(
    "rejects unsupported action %s",
    (type) => {
      expect(() =>
        componentSchema.parse({
          id: "b",
          title: "Run",
          type: "button",
          action: { type },
        }),
      ).toThrow();
    },
  );
  it("rejects executable properties and unversioned/future documents", () => {
    expect(() =>
      validateApplication({ ...sampleApp(), onClick: "evil()" }),
    ).toThrow();
    expect(() => validateApplication({ ...sampleApp(), version: 2 })).toThrow();
    expect(() =>
      validateApplication(
        sampleApp([{ ...heading, html: "<script>" } as never]),
      ),
    ).toThrow();
    expect(() =>
      validateApplication(JSON.parse('{"__proto__":{},"version":1}')),
    ).toThrow(/Unsafe/);
  });
  it("requires a home page, unique pages and unique component IDs", () => {
    const a = sampleApp([heading]);
    expect(() => validateApplication({ ...a, homePageId: "gone" })).toThrow(
      /home page/,
    );
    expect(() =>
      validateApplication({ ...a, pages: [a.pages[0], a.pages[0]] }),
    ).toThrow(/Duplicate/);
    expect(() => validateApplication(sampleApp([heading, heading]))).toThrow(
      /Duplicate/,
    );
  });
  it("rejects cyclic, non-container and cross-page parents", () => {
    const section = {
      id: "s",
      title: "Panel",
      type: "section",
      columns: 1,
    } as const;
    expect(() =>
      validateApplication(sampleApp([{ ...section, parentId: "s" }])),
    ).toThrow(/cycle/);
    expect(() =>
      validateApplication(
        sampleApp([heading, { ...section, parentId: heading.id }]),
      ),
    ).toThrow(/section/);
    expect(() =>
      validateApplication(sampleApp([{ ...heading, parentId: "gone" }])),
    ).toThrow(/same page/);
  });
  it("bounds total components and nesting", () => {
    const chain = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i}`,
      title: "Panel",
      type: "section" as const,
      columns: 1,
      ...(i ? { parentId: `s${i - 1}` } : {}),
    }));
    expect(() => validateApplication(sampleApp(chain))).toThrow(/nesting/);
    const a = sampleApp(
      Array.from({ length: 150 }, (_, i) => ({ ...heading, id: `a${i}` })),
    );
    a.pages.push({
      id: "second",
      title: "Second",
      columns: 1,
      nodes: Array.from({ length: 51 }, (_, i) => ({
        ...heading,
        id: `b${i}`,
      })),
    });
    expect(() => validateApplication(a)).toThrow(/200 component/);
    expect(() =>
      validateApplication(sampleApp(Array(201).fill(heading))),
    ).toThrow();
  });
  it("bounds pages and applications per snapshot", () => {
    expect(() =>
      applicationSchema.parse({
        ...sampleApp(),
        pages: Array.from({ length: 9 }, (_, i) => ({
          id: `p${i}`,
          title: "Page",
          columns: 1,
          nodes: [],
        })),
      }),
    ).toThrow();
    expect(() =>
      validateSnapshot({
        collections: [],
        applications: {
          version: 1,
          apps: Array.from({ length: 6 }, (_, i) => ({
            ...sampleApp(),
            id: `a${i}`,
          })),
        },
      }),
    ).toThrow();
  });
  it("reports missing references without blocking recovery of saved data", () => {
    const node: AppComponent = {
      id: "t",
      type: "table",
      title: "Books",
      binding: { collectionId: "gone" },
    };
    const app = sampleApp([node]);
    const snapshot = validateSnapshot({
      collections: [],
      applications: { version: 1, apps: [app] },
    });
    expect(applicationDiagnostics(snapshot, app)[0].message).toMatch(/missing/);
    expect(() => assertApplicationReferences(snapshot, app)).toThrow(/Books/);
  });
  it("validates fields, units, sorting, conditions and numeric charts", () => {
    const { c } = setup(),
      snapshot = { collections: [c] };
    const cases: AppComponent[] = [
      {
        id: "t",
        title: "T",
        type: "table",
        binding: { collectionId: c.id, fields: ["gone"] },
      },
      {
        id: "c",
        title: "C",
        type: "chart",
        binding: { collectionId: c.id },
        fieldId: c.fields[0].id,
        source: "records",
      },
      {
        id: "m",
        title: "M",
        type: "metric",
        binding: { collectionId: c.id },
        expression: { kind: "field", fieldId: c.fields[0].id },
        format: "number",
      },
      {
        id: "s",
        title: "S",
        type: "list",
        binding: {
          collectionId: c.id,
          sort: { fieldId: "gone", direction: "asc" },
        },
      },
      {
        id: "w",
        title: "W",
        type: "cards",
        binding: {
          collectionId: c.id,
          where: { kind: "compare", fieldId: "gone", op: "eq", value: 1 },
        },
      },
    ];
    for (const node of cases)
      expect(applicationDiagnostics(snapshot, sampleApp([node]))).toHaveLength(
        1,
      );
  });
  it("validates navigation and executable rules before action use", () => {
    for (const action of [
      { type: "navigate", pageId: "gone" },
      { type: "executeRule", ruleId: "gone" },
      { type: "previewSimulation", steps: 1 },
    ] as const) {
      expect(
        applicationDiagnostics(
          { collections: [] },
          sampleApp([{ id: "b", title: "Button", type: "button", action }]),
        ),
      ).toHaveLength(1);
    }
  });
  it("registers exactly the supported declarative primitives", () => {
    expect(Object.keys(COMPONENT_REGISTRY)).toHaveLength(13);
    expect(componentSchema.parse(heading)).toEqual(heading);
  });
});
