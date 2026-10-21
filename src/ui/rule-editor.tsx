import { useState } from "react";
import type {
  Action,
  AutomationRule,
  Collection,
  Condition,
  Field,
  Snapshot,
  Unit,
} from "../core/model";
import { uid } from "../core/model";
import {
  ExpressionEditor,
  initialExpression,
  ScalarInput,
  scalarDefault,
} from "./expression-editor";
import { operatorLabels } from "./rule-text";
function defaultCondition(c: Collection): Condition {
  const f = c.fields[0];
  return { kind: "compare", fieldId: f.id, op: "eq", value: scalarDefault(f) };
}
function ConditionEditor({
  value,
  onChange,
  collection: c,
  snapshot,
  label = "Condition",
  depth = 0,
}: {
  value: Condition | undefined;
  onChange: (p: Condition | undefined) => void;
  collection: Collection;
  snapshot: Snapshot;
  label?: string;
  depth?: number;
}) {
  const field =
    value?.kind === "compare"
      ? c.fields.find((f) => f.id === value.fieldId)
      : undefined;
  return (
    <fieldset className="condition-editor">
      <legend>{label}</legend>
      <label>
        {label} type
        <select
          aria-label={`${label} type`}
          value={value?.kind ?? "always"}
          onChange={(e) => {
            if (e.target.value === "always") onChange(undefined);
            else if (e.target.value === "compare")
              onChange(defaultCondition(c));
            else if (e.target.value === "numeric")
              onChange({
                kind: "numeric",
                left: initialExpression(c),
                op: "gt",
                right: initialExpression(c),
              });
            else
              onChange({
                kind: e.target.value as "all" | "any",
                conditions: [defaultCondition(c)],
              });
          }}
        >
          <option value="always">Always match</option>
          <option value="compare">Field comparison</option>
          <option value="numeric">Compare expressions</option>
          <option value="all" disabled={depth >= 4}>
            All conditions (AND)
          </option>
          <option value="any" disabled={depth >= 4}>
            Any condition (OR)
          </option>
        </select>
      </label>
      {value?.kind === "compare" && field && (
        <>
          <div className="editor-grid">
            <label>
              {label} field
              <select
                aria-label={`${label} field`}
                value={value.fieldId}
                onChange={(e) => {
                  const f = c.fields.find((f) => f.id === e.target.value)!;
                  onChange({
                    ...value,
                    fieldId: f.id,
                    value: scalarDefault(f),
                    op: "eq",
                  });
                }}
              >
                {c.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {label} operator
              <select
                aria-label={`${label} operator`}
                value={value.op}
                onChange={(e) =>
                  onChange({ ...value, op: e.target.value as typeof value.op })
                }
              >
                {Object.entries(operatorLabels)
                  .filter(
                    ([k]) =>
                      ["eq", "ne"].includes(k) ||
                      ["number", "computed", "date"].includes(field.type),
                  )
                  .map(([k, text]) => (
                    <option key={k} value={k}>
                      {text}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <ScalarInput
            field={field}
            value={value.value}
            onChange={(v) => onChange({ ...value, value: v })}
            label={`${label} value`}
            snapshot={snapshot}
          />
        </>
      )}
      {value?.kind === "numeric" && (
        <>
          <ExpressionEditor
            collection={c}
            snapshot={snapshot}
            value={value.left}
            onChange={(left) => onChange({ ...value, left })}
            label={`${label} left`}
          />
          <label>
            {label} operator
            <select
              aria-label={`${label} operator`}
              value={value.op}
              onChange={(e) =>
                onChange({ ...value, op: e.target.value as typeof value.op })
              }
            >
              {Object.entries(operatorLabels).map(([k, text]) => (
                <option key={k} value={k}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <ExpressionEditor
            collection={c}
            snapshot={snapshot}
            value={value.right}
            onChange={(right) => onChange({ ...value, right })}
            label={`${label} right`}
          />
        </>
      )}
      {value && "conditions" in value && (
        <>
          {value.conditions.map((p, i) => (
            <div className="condition-child" key={i}>
              <ConditionEditor
                collection={c}
                snapshot={snapshot}
                value={p}
                onChange={(next) => {
                  const conditions = [...value.conditions];
                  if (next) conditions[i] = next;
                  else conditions.splice(i, 1);
                  onChange(
                    conditions.length ? { ...value, conditions } : undefined,
                  );
                }}
                label={`${label} ${i + 1}`}
                depth={depth + 1}
              />
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  const conditions = value.conditions.filter((_, j) => j !== i);
                  onChange(
                    conditions.length ? { ...value, conditions } : undefined,
                  );
                }}
              >
                Remove condition {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={value.conditions.length >= 8}
            onClick={() =>
              onChange({
                ...value,
                conditions: [...value.conditions, defaultCondition(c)],
              })
            }
          >
            Add condition
          </button>
        </>
      )}
    </fieldset>
  );
}
function writable(c: Collection): Field[] {
  return c.fields.filter(
    (f) =>
      !["computed", "relation"].includes(f.type) &&
      !c.rules.some((r) => r.setFieldId === f.id),
  );
}
function initialAction(field: Field): Action {
  return field.type === "number"
    ? {
        kind: "setNumber",
        fieldId: field.id,
        value: { kind: "number", value: 0, unit: field.unit },
      }
    : { kind: "setValue", fieldId: field.id, value: scalarDefault(field) };
}
function ActionEditor({
  value,
  onChange,
  c,
  snapshot,
  index,
}: {
  value: Action;
  onChange: (a: Action) => void;
  c: Collection;
  snapshot: Snapshot;
  index: number;
}) {
  const f = c.fields.find((f) => f.id === value.fieldId)!,
    label = `Action ${index}`;
  return (
    <fieldset className="action-editor">
      <legend>{label}</legend>
      <label>
        {label} target
        <select
          aria-label={`${label} target`}
          value={value.fieldId}
          onChange={(e) =>
            onChange(
              initialAction(c.fields.find((f) => f.id === e.target.value)!),
            )
          }
        >
          {writable(c).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {label} operation
        <select
          aria-label={`${label} operation`}
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as Action["kind"];
            onChange(
              kind === "transition" && f.type === "select"
                ? {
                    kind,
                    fieldId: f.id,
                    from: [f.options[0]],
                    to: f.options.at(-1)!,
                  }
                : kind === "setValue"
                  ? { kind, fieldId: f.id, value: scalarDefault(f) }
                  : {
                      kind: kind as "setNumber" | "increment" | "decrement",
                      fieldId: f.id,
                      value: {
                        kind: "number",
                        value: 0,
                        unit: f.type === "number" ? f.unit : "number",
                      },
                    },
            );
          }}
        >
          {f.type === "number" ? (
            <>
              <option value="setNumber">Set number</option>
              <option value="increment">Increase by</option>
              <option value="decrement">Decrease by</option>
            </>
          ) : (
            <>
              <option value="setValue">Set value</option>
              {f.type === "select" && (
                <option value="transition">State transition</option>
              )}
            </>
          )}
        </select>
      </label>
      {value.kind === "setValue" ? (
        <ScalarInput
          field={f}
          value={value.value}
          onChange={(v) => onChange({ ...value, value: v })}
          label={`${label} value`}
          snapshot={snapshot}
        />
      ) : value.kind === "transition" && f.type === "select" ? (
        <>
          <fieldset className="state-options">
            <legend>{label} from states</legend>
            {f.options.map((o) => (
              <label className="check-label" key={o}>
                <input
                  type="checkbox"
                  checked={value.from.includes(o)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      from: e.target.checked
                        ? [...value.from, o]
                        : value.from.filter((v) => v !== o),
                    })
                  }
                />
                {o}
              </label>
            ))}
          </fieldset>
          <label>
            {label} to state
            <select
              aria-label={`${label} to state`}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            >
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        "value" in value && (
          <ExpressionEditor
            value={value.value}
            onChange={(expression) => onChange({ ...value, value: expression })}
            collection={c}
            snapshot={snapshot}
            label={`${label} expression`}
            unit={f.type === "number" ? (f.unit as Unit) : "number"}
          />
        )
      )}
    </fieldset>
  );
}
export function RuleEditor({
  snapshot,
  collectionId,
  initial,
  onPreview,
  onCancel,
}: {
  snapshot: Snapshot;
  collectionId: string;
  initial?: AutomationRule;
  onPreview: (rule: AutomationRule) => void;
  onCancel: () => void;
}) {
  const requested = snapshot.collections.find(
    (c) => c.id === (initial?.collectionId ?? collectionId),
  );
  const first =
    requested && writable(requested).length
      ? requested
      : snapshot.collections.find((c) => writable(c).length)!;
  const [rule, setRule] = useState<AutomationRule>(
    initial ?? {
      version: 1,
      id: uid(),
      name: "New rule",
      enabled: true,
      collectionId: first.id,
      trigger: { kind: "simulationStep" },
      actions: [initialAction(writable(first)[0])],
    },
  );
  const c = snapshot.collections.find((c) => c.id === rule.collectionId)!;
  return (
    <form
      className="rule-editor stack-form"
      aria-label="Rule editor"
      onSubmit={(e) => {
        e.preventDefault();
        onPreview(rule);
      }}
    >
      <h3>{initial ? "Edit rule" : "New conditional rule"}</h3>
      <div className="editor-grid">
        <label>
          Rule name
          <input
            aria-label="Rule name"
            required
            maxLength={100}
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
          />
        </label>
        <label>
          Rule collection
          <select
            aria-label="Rule collection"
            value={c.id}
            onChange={(e) => {
              const target = snapshot.collections.find(
                (c) => c.id === e.target.value,
              )!;
              setRule({
                ...rule,
                collectionId: target.id,
                when: undefined,
                trigger: { kind: "simulationStep" },
                actions: [initialAction(writable(target)[0])],
              });
            }}
          >
            {snapshot.collections
              .filter((c) => writable(c).length)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="check-label">
        <input
          aria-label="Rule enabled"
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
        />
        Enabled
      </label>
      <label>
        Rule trigger
        <select
          aria-label="Rule trigger"
          value={rule.trigger.kind}
          onChange={(e) =>
            setRule({
              ...rule,
              trigger:
                e.target.value === "fieldChanged"
                  ? {
                      kind: "fieldChanged",
                      fieldId: c.fields.find((f) => f.type !== "computed")!.id,
                    }
                  : {
                      kind: e.target.value as
                        "simulationStep" | "recordCreated" | "recordUpdated",
                    },
            })
          }
        >
          <option value="simulationStep">Explicit simulation step</option>
          <option value="recordCreated">Record created</option>
          <option value="recordUpdated">Record updated</option>
          <option value="fieldChanged">Field changed</option>
        </select>
      </label>
      {rule.trigger.kind === "fieldChanged" && (
        <label>
          Trigger field
          <select
            aria-label="Trigger field"
            value={rule.trigger.fieldId}
            onChange={(e) =>
              setRule({
                ...rule,
                trigger: { kind: "fieldChanged", fieldId: e.target.value },
              })
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
        Record events run once after an explicit edit; they do not cascade or
        backfill. Simulation rules run only when you preview and approve steps.
      </p>
      <ConditionEditor
        collection={c}
        snapshot={snapshot}
        value={rule.when}
        onChange={(when) => {
          const next = { ...rule };
          if (when) next.when = when;
          else delete next.when;
          setRule(next);
        }}
      />
      {rule.actions.map((action, i) => (
        <div key={i}>
          <ActionEditor
            c={c}
            snapshot={snapshot}
            value={action}
            index={i + 1}
            onChange={(next) =>
              setRule({
                ...rule,
                actions: rule.actions.map((a, j) => (j === i ? next : a)),
              })
            }
          />
          {rule.actions.length > 1 && (
            <button
              type="button"
              className="link-button"
              onClick={() =>
                setRule({
                  ...rule,
                  actions: rule.actions.filter((_, j) => i !== j),
                })
              }
            >
              Remove action {i + 1}
            </button>
          )}
        </div>
      ))}
      <button
        className="secondary"
        type="button"
        disabled={rule.actions.length >= 8}
        onClick={() =>
          setRule({
            ...rule,
            actions: [...rule.actions, initialAction(writable(c)[0])],
          })
        }
      >
        Add action
      </button>
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel rule editing
        </button>
        <button type="submit">Preview rule</button>
      </div>
    </form>
  );
}
