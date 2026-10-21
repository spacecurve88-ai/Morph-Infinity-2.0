import type {
  AggregateFilter,
  Collection,
  Field,
  Formula,
  Scalar,
  Snapshot,
  Unit,
} from "../core/model";
export function scalarDefault(field: Field | undefined): Scalar {
  return !field
    ? null
    : field.type === "number" || field.type === "computed"
      ? 0
      : field.type === "boolean"
        ? true
        : field.type === "select"
          ? field.options[0]
          : field.type === "date"
            ? "2026-01-01"
            : "";
}
export function ScalarInput({
  field,
  value,
  onChange,
  label,
  snapshot,
}: {
  field: Field;
  value: Scalar;
  onChange: (v: Scalar) => void;
  label: string;
  snapshot: Snapshot;
}) {
  return (
    <div className="scalar-input">
      <label className="check-label">
        <input
          type="checkbox"
          checked={value === null}
          onChange={(e) =>
            onChange(e.target.checked ? null : scalarDefault(field))
          }
        />{" "}
        Empty / missing
      </label>
      {value !== null && (
        <label>
          {label}
          {field.type === "select" ||
          field.type === "boolean" ||
          field.type === "relation" ? (
            <select
              aria-label={label}
              value={String(value)}
              onChange={(e) =>
                onChange(
                  field.type === "boolean"
                    ? e.target.value === "true"
                    : e.target.value,
                )
              }
            >
              {field.type === "select" ? (
                field.options.map((o) => <option key={o}>{o}</option>)
              ) : field.type === "boolean" ? (
                <>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </>
              ) : (
                <>
                  <option value="">Choose a record</option>
                  {snapshot.collections
                    .find((c) => c.id === field.targetCollectionId)
                    ?.records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {String(
                          r.values[
                            snapshot.collections.find(
                              (c) => c.id === field.targetCollectionId,
                            )!.fields[0].id
                          ] ?? r.id,
                        )}
                      </option>
                    ))}
                </>
              )}
            </select>
          ) : (
            <input
              aria-label={label}
              required
              type={
                field.type === "number" || field.type === "computed"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              step="any"
              maxLength={1000}
              value={String(value)}
              onChange={(e) =>
                onChange(
                  field.type === "number" || field.type === "computed"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          )}
        </label>
      )}
    </div>
  );
}
const numbers = (c: Collection) =>
  c.fields.filter((f) => f.type === "number" || f.type === "computed");
export function initialExpression(
  c: Collection,
  unit: Unit = "number",
): Formula {
  const f = numbers(c)[0];
  return f
    ? { kind: "field", fieldId: f.id }
    : { kind: "number", value: 0, unit };
}
export function ExpressionEditor({
  value,
  onChange,
  collection: c,
  snapshot,
  label,
  depth = 0,
  unit = "number",
}: {
  value: Formula;
  onChange: (v: Formula) => void;
  collection: Collection;
  snapshot: Snapshot;
  label: string;
  depth?: number;
  unit?: Unit;
}) {
  const target =
    value.kind === "aggregate"
      ? (snapshot.collections.find((t) => t.id === value.collectionId) ??
        snapshot.collections[0])
      : undefined;
  const filter = value.kind === "aggregate" ? value.where : undefined;
  const filterMode = !filter
    ? "all"
    : "equals" in filter
      ? "literal"
      : "sourceRecordId" in filter
        ? "record"
        : "field";
  function newFilter(mode: string): AggregateFilter | undefined {
    if (!target || mode === "all") return undefined;
    const field =
      mode === "record"
        ? target.fields.find(
            (f) => f.type === "relation" && f.targetCollectionId === c.id,
          )
        : target.fields.find((f) => f.type !== "computed");
    if (!field) return undefined;
    return mode === "record"
      ? { fieldId: field.id, sourceRecordId: true }
      : mode === "field"
        ? {
            fieldId: field.id,
            sourceFieldId:
              c.fields.find((f) => f.type === field.type)?.id ?? c.fields[0].id,
          }
        : { fieldId: field.id, equals: scalarDefault(field) };
  }
  function setFilter(where: AggregateFilter | undefined) {
    if (value.kind === "aggregate") {
      const next = { ...value };
      if (where) next.where = where;
      else delete next.where;
      onChange(next);
    }
  }
  const targetFilter = target?.fields.find((f) => f.id === filter?.fieldId);
  return (
    <fieldset className="expression-editor">
      <legend>{label}</legend>
      <label>
        {label} type
        <select
          aria-label={`${label} type`}
          value={value.kind}
          onChange={(e) => {
            if (e.target.value === "field")
              onChange(initialExpression(c, unit));
            else if (e.target.value === "number")
              onChange({ kind: "number", value: 0, unit });
            else if (e.target.value === "binary")
              onChange({
                kind: "binary",
                op: "+",
                left: value,
                right: { kind: "number", value: 0, unit },
              });
            else {
              const t = snapshot.collections[0],
                f = numbers(t)[0];
              onChange(
                f
                  ? {
                      kind: "aggregate",
                      op: "sum",
                      collectionId: t.id,
                      fieldId: f.id,
                    }
                  : { kind: "aggregate", op: "count", collectionId: t.id },
              );
            }
          }}
        >
          <option value="field" disabled={!numbers(c).length}>
            Numeric field
          </option>
          <option value="number">Number</option>
          <option value="binary" disabled={depth >= 4}>
            Arithmetic
          </option>
          <option value="aggregate">Collection aggregate</option>
        </select>
      </label>
      {value.kind === "field" && (
        <label>
          {label} field
          <select
            aria-label={`${label} field`}
            value={value.fieldId}
            onChange={(e) => onChange({ ...value, fieldId: e.target.value })}
          >
            {numbers(c).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.kind === "number" && (
        <div className="editor-grid">
          <label>
            {label} number
            <input
              aria-label={`${label} number`}
              type="number"
              step="any"
              required
              value={Number.isFinite(value.value) ? value.value : ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  value: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            {label} unit
            <select
              aria-label={`${label} unit`}
              value={value.unit ?? "number"}
              onChange={(e) =>
                onChange({ ...value, unit: e.target.value as Unit })
              }
            >
              {["number", "money", "pages", "minutes"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {value.kind === "binary" && (
        <>
          <label>
            {label} operator
            <select
              aria-label={`${label} operator`}
              value={value.op}
              onChange={(e) =>
                onChange({
                  ...value,
                  op: e.target.value as "+" | "-" | "*" | "/",
                })
              }
            >
              {["+", "-", "*", "/"].map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>
          </label>
          <div className="expression-children">
            <ExpressionEditor
              value={value.left}
              onChange={(left) => onChange({ ...value, left })}
              collection={c}
              snapshot={snapshot}
              label={`${label} left`}
              depth={depth + 1}
              unit={unit}
            />
            <ExpressionEditor
              value={value.right}
              onChange={(right) => onChange({ ...value, right })}
              collection={c}
              snapshot={snapshot}
              label={`${label} right`}
              depth={depth + 1}
              unit={unit}
            />
          </div>
        </>
      )}
      {value.kind === "aggregate" && target && (
        <>
          <div className="editor-grid">
            <label>
              {label} collection
              <select
                aria-label={`${label} collection`}
                value={value.collectionId}
                onChange={(e) => {
                  const t = snapshot.collections.find(
                      (t) => t.id === e.target.value,
                    )!,
                    f = numbers(t)[0];
                  onChange(
                    f
                      ? {
                          kind: "aggregate",
                          op: "sum",
                          collectionId: t.id,
                          fieldId: f.id,
                        }
                      : { kind: "aggregate", op: "count", collectionId: t.id },
                  );
                }}
              >
                {snapshot.collections.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {label} aggregate
              <select
                aria-label={`${label} aggregate`}
                value={value.op}
                onChange={(e) =>
                  onChange(
                    e.target.value === "count"
                      ? {
                          kind: "aggregate",
                          op: "count",
                          collectionId: target.id,
                          ...(filter ? { where: filter } : {}),
                        }
                      : {
                          kind: "aggregate",
                          op: "sum",
                          collectionId: target.id,
                          fieldId: numbers(target)[0]?.id ?? "",
                          ...(filter ? { where: filter } : {}),
                        },
                  )
                }
              >
                <option value="sum" disabled={!numbers(target).length}>
                  Sum
                </option>
                <option value="count">Count records</option>
              </select>
            </label>
          </div>
          {value.op === "sum" && (
            <label>
              {label} aggregate field
              <select
                aria-label={`${label} aggregate field`}
                value={value.fieldId}
                onChange={(e) =>
                  onChange({ ...value, fieldId: e.target.value })
                }
              >
                {numbers(target).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {label} filter
            <select
              aria-label={`${label} filter`}
              value={filterMode}
              onChange={(e) => setFilter(newFilter(e.target.value))}
            >
              <option value="all">All records</option>
              <option value="literal">Field equals a value</option>
              <option value="field">Match a source field</option>
              <option
                value="record"
                disabled={
                  !target.fields.some(
                    (f) =>
                      f.type === "relation" && f.targetCollectionId === c.id,
                  )
                }
              >
                Related to this record
              </option>
            </select>
          </label>
          {filter && (
            <label>
              {label} filter field
              <select
                aria-label={`${label} filter field`}
                value={filter.fieldId}
                onChange={(e) => {
                  const f = target.fields.find((f) => f.id === e.target.value)!;
                  setFilter(
                    "equals" in filter
                      ? { fieldId: f.id, equals: scalarDefault(f) }
                      : { ...filter, fieldId: f.id },
                  );
                }}
              >
                {target.fields
                  .filter(
                    (f) =>
                      f.type !== "computed" &&
                      (filterMode !== "record" ||
                        (f.type === "relation" &&
                          f.targetCollectionId === c.id)),
                  )
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {filter && "equals" in filter && targetFilter && (
            <ScalarInput
              label={`${label} filter value`}
              field={targetFilter}
              value={filter.equals}
              onChange={(equals) => setFilter({ ...filter, equals })}
              snapshot={snapshot}
            />
          )}
          {filter && "sourceFieldId" in filter && (
            <label>
              {label} source field
              <select
                aria-label={`${label} source field`}
                value={filter.sourceFieldId}
                onChange={(e) =>
                  setFilter({ ...filter, sourceFieldId: e.target.value })
                }
              >
                {c.fields
                  .filter((f) => f.type !== "computed")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="help">
            Empty sums/counts are zero. Sum skips missing values. Arithmetic
            errors cancel the preview.
          </p>
        </>
      )}
    </fieldset>
  );
}
