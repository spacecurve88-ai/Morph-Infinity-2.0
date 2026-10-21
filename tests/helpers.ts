import { applyPlan, createWorkspace } from "../src/core/engine";
import { currentSnapshot, emptyDocument } from "../src/core/model";
import { basePlan, template } from "../src/planner/parse";
export function setup(kind: "reading" | "budget" = "reading") {
  let d = createWorkspace(emptyDocument(), "Test workspace");
  const w = d.workspaces[0],
    c = template(kind);
  d = applyPlan(
    d,
    basePlan(d, w, `Create ${kind}`, [
      { type: "addCollection", collection: c },
    ]),
  );
  return {
    d,
    wid: w.id,
    cid: c.id,
    c: currentSnapshot(d.workspaces[0]).collections[0],
  };
}
