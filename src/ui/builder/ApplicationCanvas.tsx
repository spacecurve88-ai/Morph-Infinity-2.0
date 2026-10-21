import { useState } from "react";
import type { ReactNode } from "react";
import type {
  Application,
  AppComponent,
  InterfaceAction,
} from "../../application/contracts";
import { APPLICATION_LIMITS } from "../../application/contracts";
import { componentDiagnostics } from "../../application/validation";
import {
  boundNumber,
  boundRecord,
  fieldValue,
  queryBinding,
  revisionSeries,
} from "../../application/runtime";
import type { Selection } from "../../application/runtime";
import type { DataRecord, Snapshot, Workspace } from "../../core/model";
import { workBudget, spend } from "../../core/formula";
import { matches } from "../../core/automation";
import { RecordForm } from "../forms";
import { recordTitle, valueText } from "../presentation";
export const numberText = (
  value: number,
  format: "number" | "money" | "percent" = "number",
) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: format === "money" ? 2 : 3,
    ...(format === "money" ? { minimumFractionDigits: 2 } : {}),
    ...(format === "percent" ? { style: "percent" as const } : {}),
  }).format(value);
function Bars({
  title,
  points,
}: {
  title: string;
  points: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <figure className="builder-chart" aria-label={title}>
      {!points.length && (
        <p>No numeric history or records are available yet.</p>
      )}
      <ol>
        {points.map((p, i) => (
          <li key={i}>
            <span className="bar-label">{p.label}</span>
            <span className="bar-track">
              <span
                className={p.value < 0 ? "bar-fill negative" : "bar-fill"}
                style={{
                  width: `${Math.max(1, (Math.abs(p.value) / max) * 100)}%`,
                }}
              />
            </span>
            <strong>{numberText(p.value)}</strong>
          </li>
        ))}
      </ol>
      <figcaption>
        {title} · {points.length} points
      </figcaption>
    </figure>
  );
}
export function ApplicationCanvas({
  app,
  pageId,
  snapshot,
  workspace,
  selection,
  onSelectRecord,
  onAction,
  onRecord,
  editing = false,
  selectedNode,
  onSelectNode,
  busy = false,
}: {
  app: Application;
  pageId: string;
  snapshot: Snapshot;
  workspace: Workspace;
  selection: Selection;
  onSelectRecord: (collectionId: string, recordId: string) => void;
  onAction: (action: InterfaceAction) => void;
  onRecord: (collectionId: string, record: DataRecord) => void;
  editing?: boolean;
  selectedNode?: string;
  onSelectNode?: (id: string) => void;
  busy?: boolean;
}) {
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [steps, setSteps] = useState<Record<string, number>>({});
  const page = app.pages.find((p) => p.id === pageId);
  if (!page)
    return (
      <p role="alert" className="error">
        This page is missing. Choose another page.
      </p>
    );
  const budget = workBudget(APPLICATION_LIMITS.work),
    byParent = new Map<string, AppComponent[]>();
  for (const node of page.nodes) {
    const key = node.parentId ?? "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(node);
  }
  const invoke = (action: InterfaceAction) => {
    if (!editing && !busy) onAction(action);
  };
  function content(node: AppComponent): ReactNode {
    spend(budget);
    if (node.type === "section")
      return (
        <div
          className="app-layout"
          style={{ "--app-columns": node.columns } as React.CSSProperties}
        >
          {(byParent.get(node.id) ?? []).map(renderNode)}
        </div>
      );
    if (node.type === "heading")
      return node.level === 2 ? (
        <h2>{node.text}</h2>
      ) : node.level === 3 ? (
        <h3>{node.text}</h3>
      ) : (
        <h4>{node.text}</h4>
      );
    if (node.type === "text") return <p className="app-prose">{node.text}</p>;
    if (node.type === "button")
      return (
        <button disabled={editing || busy} onClick={() => invoke(node.action)}>
          {node.title}
        </button>
      );
    if (node.type === "simulation") {
      const count = steps[node.id] ?? node.steps;
      return (
        <div className="app-simulation">
          <label>
            {node.title} steps
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={Number.isNaN(count) ? "" : count}
              disabled={editing || busy}
              onChange={(e) =>
                setSteps({ ...steps, [node.id]: Number(e.target.value) })
              }
            />
          </label>
          <div className="builder-actions">
            <button
              className="secondary"
              disabled={
                editing ||
                busy ||
                !Number.isInteger(count) ||
                count < 1 ||
                count > 100
              }
              onClick={() =>
                invoke({ type: "previewSimulation", steps: count })
              }
            >
              Preview simulation
            </button>
            <button
              disabled={
                editing ||
                busy ||
                !Number.isInteger(count) ||
                count < 1 ||
                count > 100
              }
              onClick={() =>
                invoke({ type: "advanceSimulation", steps: count })
              }
            >
              Advance simulation
            </button>
          </div>
          <p role="status">
            Ready · one bounded run at a time. Advancing requires review and
            approval.
          </p>
        </div>
      );
    }
    const binding = node.binding;
    if (node.type === "metric")
      return (
        <output className="app-metric" aria-label={node.title}>
          {numberText(
            boundNumber(snapshot, binding, node.expression, selection, budget),
            node.format,
          )}
        </output>
      );
    if (node.type === "chart") {
      const result = queryBinding(snapshot, binding, budget);
      const points =
        node.source === "revisions"
          ? revisionSeries(workspace, binding, node.fieldId, selection, budget)
          : result.records
              .slice(0, APPLICATION_LIMITS.chartPoints)
              .flatMap((r) => {
                const value = fieldValue(
                  snapshot,
                  result.collection,
                  r,
                  node.fieldId,
                  budget,
                );
                return typeof value === "number"
                  ? [{ label: recordTitle(result.collection, r), value }]
                  : [];
              });
      return (
        <>
          <Bars title={node.title} points={points} />
          <p className="help">
            {node.source === "revisions"
              ? "Available checkpoints on this branch; intermediate steps are shown in the simulation review. Select a record to follow it."
              : `First ${APPLICATION_LIMITS.chartPoints} matching records; filters and sorting are applied.`}
          </p>
        </>
      );
    }
    if (
      node.type === "form" ||
      node.type === "detail" ||
      node.type === "status"
    ) {
      const result = boundRecord(snapshot, binding, selection, budget),
        c = result.collection,
        r = result.record;
      if (node.type === "form") {
        if (editing)
          return (
            <p>
              Record form · {c.name} ·{" "}
              {node.mode === "create" ? "Create" : "Edit selected record"}. Use
              Run mode to enter data.
            </p>
          );
        if (node.mode === "edit" && !r)
          return <p>Select a record to edit it here.</p>;
        return (
          <RecordForm
            key={`${c.id}/${node.mode === "create" ? "new" : r?.id}`}
            collection={c}
            snapshot={snapshot}
            record={node.mode === "edit" ? r : undefined}
            busy={busy}
            fieldIds={binding.fields}
            submitLabel="Preview record"
            onSubmit={(record) => onRecord(c.id, record)}
          />
        );
      }
      if (!r) return <p>Select a record to inspect it here.</p>;
      if (node.type === "status")
        return (
          <output className="app-state" aria-label={node.title}>
            {String(
              fieldValue(snapshot, c, r, node.fieldId, budget) ?? "No value",
            )}
          </output>
        );
      return (
        <>
          <h4>{recordTitle(c, r)}</h4>
          <dl className="app-details">
            {result.fields.map((id) => {
              const f = c.fields.find((f) => f.id === id)!,
                value = valueText(f, c, r, snapshot, budget);
              return (
                <div key={id}>
                  <dt>{f.name}</dt>
                  <dd>
                    {value.text}
                    {value.reason && <small>{value.reason}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
          <button
            className="secondary"
            disabled={editing || busy}
            onClick={() => {
              onSelectRecord(c.id, r.id);
              invoke({ type: "editRecord", collectionId: c.id });
            }}
          >
            Edit record
          </button>
        </>
      );
    }
    const result = queryBinding(snapshot, binding, budget, searches[node.id]),
      c = result.collection;
    const current = Math.min(
      pages[node.id] ?? 0,
      Math.max(
        0,
        Math.ceil(result.records.length / APPLICATION_LIMITS.rows) - 1,
      ),
    );
    const rows = result.records.slice(
      current * APPLICATION_LIMITS.rows,
      (current + 1) * APPLICATION_LIMITS.rows,
    );
    const cells = new Map(
      rows.map((r) => [
        r.id,
        result.fields.map((id) => {
          const f = c.fields.find((f) => f.id === id)!;
          return { id, name: f.name, ...valueText(f, c, r, snapshot, budget) };
        }),
      ]),
    );
    const select = (r: DataRecord) => {
      if (!editing) onSelectRecord(c.id, r.id);
    };
    return (
      <>
        <label className="app-search">
          Filter {node.title}
          <input
            type="search"
            disabled={editing}
            value={searches[node.id] ?? ""}
            onChange={(e) => {
              setSearches({ ...searches, [node.id]: e.target.value });
              setPages({ ...pages, [node.id]: 0 });
            }}
          />
        </label>
        {!rows.length ? (
          <p>No records match this binding.</p>
        ) : node.type === "table" ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {result.fields.map((id) => (
                    <th scope="col" key={id}>
                      {c.fields.find((f) => f.id === id)!.name}
                    </th>
                  ))}
                  <th scope="col">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      selection[c.id] === r.id ? "app-row-selected" : ""
                    }
                  >
                    {cells.get(r.id)!.map((cell) => (
                      <td key={cell.id}>
                        {cell.text}
                        {cell.reason && <small>{cell.reason}</small>}
                      </td>
                    ))}
                    <td>
                      <button
                        className="secondary"
                        disabled={editing || busy}
                        aria-pressed={selection[c.id] === r.id}
                        onClick={() => select(r)}
                      >
                        Select {recordTitle(c, r)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul
            className={
              node.type === "cards" ? "app-record-cards" : "app-record-list"
            }
          >
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  className={
                    selection[c.id] === r.id
                      ? "secondary selected"
                      : "secondary"
                  }
                  disabled={editing || busy}
                  aria-pressed={selection[c.id] === r.id}
                  onClick={() => select(r)}
                >
                  Select {recordTitle(c, r)}
                </button>
                <dl className="app-details">
                  {cells.get(r.id)!.map((cell) => (
                    <div key={cell.id}>
                      <dt>{cell.name}</dt>
                      <dd>
                        {cell.text}
                        {cell.reason && <small>{cell.reason}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
        <div className="builder-pagination">
          <span>{result.records.length} matching records</span>
          {result.records.length > APPLICATION_LIMITS.rows && (
            <>
              <button
                className="secondary"
                disabled={editing || current === 0}
                onClick={() => setPages({ ...pages, [node.id]: current - 1 })}
              >
                Previous {node.title}
              </button>
              <span>Page {current + 1}</span>
              <button
                className="secondary"
                disabled={
                  editing ||
                  (current + 1) * APPLICATION_LIMITS.rows >=
                    result.records.length
                }
                onClick={() => setPages({ ...pages, [node.id]: current + 1 })}
              >
                Next {node.title}
              </button>
            </>
          )}
        </div>
      </>
    );
  }
  function renderNode(node: AppComponent): ReactNode {
    let child: ReactNode;
    const diagnostics = componentDiagnostics(snapshot, app, node);
    try {
      if (diagnostics.length) throw new Error(diagnostics.join(" "));
      if (!editing && node.hidden) return null;
      if (!editing && node.visibility) {
        const c = snapshot.collections.find(
          (c) => c.id === node.visibility!.collectionId,
        )!;
        const r =
          c.records.find((r) => r.id === selection[c.id]) ?? c.records[0];
        if (!r || !matches(node.visibility.when, snapshot, c, r, budget))
          return null;
      }
      child = content(node);
    } catch (e) {
      child = (
        <p role="alert" className="error">
          {node.title}:{" "}
          {e instanceof Error ? e.message : "This component could not load."}
        </p>
      );
    }
    return (
      <section
        key={node.id}
        className={`app-component type-${node.type} tone-${node.tone ?? "plain"} ${editing && selectedNode === node.id ? "is-selected" : ""}`}
        style={{ "--app-span": node.span ?? 1 } as React.CSSProperties}
        aria-label={node.title}
        data-component-type={node.type}
      >
        {editing && (
          <button
            className="component-handle"
            aria-pressed={selectedNode === node.id}
            onClick={() => onSelectNode?.(node.id)}
          >
            Select {node.title}
            {node.hidden ? " · hidden in Run" : ""}
          </button>
        )}
        {!["heading", "text", "button"].includes(node.type) && (
          <h3 className="component-title">{node.title}</h3>
        )}
        {child}
      </section>
    );
  }
  return (
    <div
      className={`application-canvas ${editing ? "is-building" : "is-running"}`}
      aria-label={`${page.title} application page`}
    >
      <div
        className="app-layout"
        style={{ "--app-columns": page.columns } as React.CSSProperties}
      >
        {(byParent.get("") ?? []).map(renderNode)}
      </div>
      {!page.nodes.length && (
        <div className="builder-empty">
          <h3>Your page starts here.</h3>
          <p>
            {editing
              ? "Choose a component to add it, then set its properties."
              : "This page has no components yet. Switch to Build mode to add some."}
          </p>
        </div>
      )}
    </div>
  );
}
