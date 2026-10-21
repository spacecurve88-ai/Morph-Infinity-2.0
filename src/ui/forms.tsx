import { useState } from "react";
import type { FormEvent } from "react";
import { uid } from "../core/model";
import type { Collection, DataRecord, Field, Snapshot } from "../core/model";
import { ExpressionEditor, initialExpression } from "./expression-editor";
import { recordTitle } from "./presentation";

export function NameForm({
  label,
  initial,
  busy,
  submit,
  onSubmit,
}: {
  label: string;
  initial: string;
  busy: boolean;
  submit: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <label>
        {label}
        <input
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="dialog-actions">
        <button disabled={busy || !name.trim()}>{submit}</button>
      </div>
    </form>
  );
}
export function FieldForm({
  collection,
  snapshot,
  onSubmit,
}: {
  collection: Collection;
  snapshot: Snapshot;
  onSubmit: (field: Field) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<
    "text" | "number" | "date" | "boolean" | "select" | "relation" | "computed"
  >("text");
  const [unit, setUnit] = useState<"number" | "pages" | "minutes" | "money">(
    "number",
  );
  const [options, setOptions] = useState("");
  const [formula, setFormula] = useState(initialExpression(collection));
  const [target, setTarget] = useState(
    snapshot.collections.find((c) => c.id !== collection.id)?.id ??
      collection.id,
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    const base = { id: uid(), name: name.trim() };
    onSubmit(
      type === "computed"
        ? { ...base, type, formula }
        : type === "number"
          ? { ...base, type, unit }
          : type === "select"
            ? {
                ...base,
                type,
                options: [
                  ...new Set(
                    options
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  ),
                ],
              }
            : type === "relation"
              ? { ...base, type, targetCollectionId: target }
              : { ...base, type },
    );
  }
  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        Field name
        <input
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Field type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Yes / No</option>
          <option value="select">Select</option>
          <option value="relation">Relation</option>
          <option value="computed">Computed expression</option>
        </select>
      </label>
      {type === "computed" && (
        <ExpressionEditor
          value={formula}
          onChange={setFormula}
          collection={collection}
          snapshot={snapshot}
          label="Computed expression"
        />
      )}
      {type === "number" && (
        <label>
          Unit
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
          >
            {["number", "pages", "minutes", "money"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      )}
      {type === "select" && (
        <label>
          Options, separated by commas
          <input
            required
            maxLength={1000}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        </label>
      )}
      {type === "relation" && (
        <>
          <label>
            Related collection
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {snapshot.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="help">
            One linked record. Referenced records cannot be deleted until their
            links are removed.
          </p>
        </>
      )}
      <p className="help">
        For a computed field, use the change composer: “Balance = Income -
        Expenses”.
      </p>
      <div className="dialog-actions">
        <button disabled={!name.trim()}>Preview field</button>
      </div>
    </form>
  );
}
export function RecordForm({
  collection: c,
  snapshot,
  record,
  busy,
  onSubmit,
  onDelete,
}: {
  collection: Collection;
  snapshot: Snapshot;
  record?: DataRecord;
  busy: boolean;
  onSubmit: (r: DataRecord) => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(record?.values ?? {}).map(([k, v]) => [
        k,
        v == null ? "" : String(v),
      ]),
    ),
  );
  const [id] = useState(record?.id ?? uid());
  function save(e: FormEvent) {
    e.preventDefault();
    const parsed = Object.fromEntries(
      c.fields
        .filter((f) => f.type !== "computed")
        .map((f) => {
          const v = values[f.id] ?? "";
          return [
            f.id,
            v === ""
              ? null
              : f.type === "number"
                ? Number(v)
                : f.type === "boolean"
                  ? v === "true"
                  : v,
          ];
        }),
    );
    onSubmit({ id, values: parsed });
  }
  return (
    <form className="stack-form" onSubmit={save}>
      {c.fields
        .filter((f) => f.type !== "computed")
        .map((f, index) => {
          const managed = c.rules.some((r) => r.setFieldId === f.id);
          return (
            <label key={f.id}>
              {f.name}
              {f.type === "number" && f.unit !== "number" && (
                <small className="unit-label" aria-hidden="true">
                  {f.unit}
                </small>
              )}
              {f.type === "select" ||
              f.type === "boolean" ||
              f.type === "relation" ? (
                <select
                  aria-label={f.name}
                  autoFocus={index === 0}
                  value={values[f.id] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [f.id]: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {f.type === "select" ? (
                    f.options.map((o) => <option key={o}>{o}</option>)
                  ) : f.type === "boolean" ? (
                    <>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </>
                  ) : (
                    snapshot.collections
                      .find((t) => t.id === f.targetCollectionId)
                      ?.records.map((r) => (
                        <option key={r.id} value={r.id}>
                          {recordTitle(
                            snapshot.collections.find(
                              (t) => t.id === f.targetCollectionId,
                            )!,
                            r,
                          )}
                        </option>
                      ))
                  )}
                </select>
              ) : (
                <input
                  aria-label={f.name}
                  autoFocus={index === 0}
                  type={
                    f.type === "number"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={f.type === "number" ? "any" : undefined}
                  maxLength={10000}
                  value={values[f.id] ?? ""}
                  readOnly={managed}
                  onChange={(e) =>
                    setValues({ ...values, [f.id]: e.target.value })
                  }
                />
              )}
              {managed && (
                <small>
                  Captured automatically on the first matching status change.
                </small>
              )}
            </label>
          );
        })}
      <div className="dialog-actions">
        {onDelete && (
          <button
            type="button"
            className="danger link-button"
            disabled={busy}
            onClick={onDelete}
          >
            Delete record
          </button>
        )}
        <button disabled={busy}>Save record</button>
      </div>
    </form>
  );
}
