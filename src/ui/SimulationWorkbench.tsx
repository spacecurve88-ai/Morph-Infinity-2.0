import { useEffect, useState } from "react";
import type { AutomationRule, Document, Workspace } from "../core/model";
import { currentSnapshot } from "../core/model";
import type { FeaturePlan, PlanPreview } from "../core/engine";
import { economicExample } from "../examples/economy";
import { RuleEditor } from "./rule-editor";
import { ruleSummary } from "./rule-text";
import { recordTitle } from "./presentation";
function draft(
  document: Document,
  w: Workspace,
  summary: string,
  operations: FeaturePlan["operations"],
): FeaturePlan {
  return {
    version: 1,
    baseRevision: document.revision,
    workspaceId: w.id,
    branchId: w.activeBranchId,
    summary,
    operations,
  };
}
export function SimulationWorkbench({
  document,
  w,
  collectionId,
  onReview,
}: {
  document: Document;
  w: Workspace;
  collectionId?: string;
  onReview: (p: FeaturePlan) => void;
}) {
  const snapshot = currentSnapshot(w),
    rules = snapshot.automation?.rules ?? [];
  const [open, setOpen] = useState(false),
    [steps, setSteps] = useState(5),
    [editing, setEditing] = useState<AutomationRule | null>();
  useEffect(() => setEditing(undefined), [document.revision]);
  const canEdit = snapshot.collections.some((c) =>
    c.fields.some(
      (f) =>
        !["computed", "relation"].includes(f.type) &&
        !c.rules.some((r) => r.setFieldId === f.id),
    ),
  );
  const exampleExists = snapshot.collections.some(
    (c) => c.id === "example-companies" || c.id === "example-expenses",
  );
  return (
    <section
      className="simulation-workbench"
      aria-label="Rules and simulations"
    >
      <button
        className="workbench-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <strong>Rules & simulations</strong>
        <span>
          {rules.length} rules · {open ? "Collapse" : "Explore"}
        </span>
      </button>
      {open && (
        <div className="automation-content">
          <p className="help">
            Build conditional behavior for any collection. Preview changes
            before saving; nothing runs in the background.
          </p>
          <div className="simulation-controls">
            <button
              className="secondary"
              disabled={!canEdit}
              onClick={() => setEditing(null)}
            >
              Add rule
            </button>
            <button
              className="secondary"
              disabled={exampleExists}
              onClick={() =>
                onReview(
                  draft(
                    document,
                    w,
                    "Add economic example (new collections and rules)",
                    [{ type: "addBundle", snapshot: economicExample() }],
                  ),
                )
              }
            >
              Preview economic example
            </button>
            <label>
              Simulation steps
              <input
                aria-label="Simulation steps"
                type="number"
                min={1}
                max={100}
                step={1}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
              />
            </label>
            <button
              disabled={
                !Number.isInteger(steps) ||
                steps < 1 ||
                steps > 100 ||
                !rules.some(
                  (r) => r.enabled && r.trigger.kind === "simulationStep",
                )
              }
              onClick={() =>
                onReview(
                  draft(
                    document,
                    w,
                    `Run ${steps} simulation ${steps === 1 ? "step" : "steps"}`,
                    [{ type: "simulate", steps }],
                  ),
                )
              }
            >
              Preview simulation
            </button>
          </div>
          <p className="help">
            Choose 1–100 steps. Each step reads its starting values. Thresholds
            react on the following step. Approval saves one recoverable
            revision.
          </p>
          {rules.length ? (
            <ul className="rule-list">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <div>
                    <strong>
                      {rule.name}{" "}
                      <span className="quiet-tag">
                        {rule.enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </strong>
                    <p>{ruleSummary(rule, snapshot)}</p>
                  </div>
                  <div className="rule-actions">
                    <button
                      className="secondary"
                      onClick={() => setEditing(rule)}
                      aria-label={`Edit rule ${rule.name}`}
                    >
                      Edit
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        onReview(
                          draft(
                            document,
                            w,
                            `${rule.enabled ? "Disable" : "Enable"} ${rule.name}`,
                            [
                              {
                                type: "upsertRule",
                                rule: { ...rule, enabled: !rule.enabled },
                              },
                            ],
                          ),
                        )
                      }
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="link-button"
                      onClick={() =>
                        onReview(
                          draft(document, w, `Remove rule ${rule.name}`, [
                            { type: "removeRule", ruleId: rule.id },
                          ]),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="help">
              No generalized rules yet. Existing abandonment-date rules continue
              to work.
            </p>
          )}
          {editing !== undefined && canEdit && (
            <RuleEditor
              key={editing?.id ?? `new-${collectionId}`}
              snapshot={snapshot}
              collectionId={collectionId ?? snapshot.collections[0].id}
              initial={editing ?? undefined}
              onCancel={() => setEditing(undefined)}
              onPreview={(rule) =>
                onReview(
                  draft(
                    document,
                    w,
                    `${editing ? "Update" : "Add"} rule: ${rule.name}`,
                    [{ type: "upsertRule", rule }],
                  ),
                )
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
export function AutomationPreview({
  preview,
  sample = false,
}: {
  preview: PlanPreview;
  sample?: boolean;
}) {
  const changes = preview.changes,
    simulation = preview.simulation;
  return (
    <>
      {simulation && (
        <div className="preview-summary" role="status">
          <strong>
            {simulation.steps} steps previewed · {simulation.affectedRecords}{" "}
            affected records · {changes.length} field changes
          </strong>
          <p>
            {sample
              ? "Rule sample only. Approval saves the definition; these sample record changes are not saved."
              : "Not saved. Reads are frozen per step. Approving creates one branch-local revision."}
          </p>
          {!changes.length && (
            <p>
              No data changes to apply. Cancel and adjust the rules or steps.
            </p>
          )}
        </div>
      )}
      {simulation && (
        <details open>
          <summary>Step-by-step results</summary>
          <div className="step-summary">
            {simulation.summaries.map((s) => (
              <div key={s.step}>
                Step {s.step}: {s.changes} changes · {s.affectedRecords} records
              </div>
            ))}
          </div>
        </details>
      )}
      {!!changes.length && (
        <div className="simulation-diff" aria-label="Before and after changes">
          <h4>{simulation ? "Ordered step changes" : "Record rule effects"}</h4>
          <ol>
            {changes.slice(0, 150).map((change, i) => {
              const c = preview.snapshot.collections.find(
                  (c) => c.id === change.collectionId,
                )!,
                r = c.records.find((r) => r.id === change.recordId)!;
              return (
                <li key={i}>
                  <span>
                    Step {change.step} · {c.name} / {recordTitle(c, r)} /{" "}
                    {c.fields.find((f) => f.id === change.fieldId)?.name}
                  </span>
                  <strong>
                    {change.before === null ? "empty" : String(change.before)} →{" "}
                    {change.after === null ? "empty" : String(change.after)}
                  </strong>
                </li>
              );
            })}
          </ol>
          {changes.length > 150 && (
            <p className="help">
              Showing the first 150 of {changes.length} changes. Export a backup
              after approval for the complete resulting state.
            </p>
          )}
        </div>
      )}
    </>
  );
}
