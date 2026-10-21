import type { Collection, Snapshot } from "../core/model";
import { evaluate } from "../core/formula";
import { monthlyCounts } from "../core/engine";
import { recordTitle } from "./presentation";

export function Diff({ lines }: { lines: string[] }) {
  return lines.length ? (
    <ul className="diff-list">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  ) : (
    <p className="help">No design or record differences.</p>
  );
}
export function PlanSamples({
  before,
  after,
}: {
  before: Snapshot;
  after: Snapshot;
}) {
  const computed = after.collections.flatMap((c) =>
    c.fields
      .filter(
        (f) =>
          f.type === "computed" &&
          !before.collections
            .find((b) => b.id === c.id)
            ?.fields.some((b) => b.id === f.id),
      )
      .map((f) => ({ c, f })),
  );
  return (
    <>
      {computed.map(
        ({ c, f }) =>
          f.type === "computed" && (
            <div className="sample-preview" key={f.id}>
              <h4>Live calculation preview</h4>
              {c.records.length ? (
                <dl>
                  {c.records.slice(0, 5).map((r) => {
                    const result = evaluate(f.formula, c, r, 0, after);
                    return (
                      <div key={r.id}>
                        <dt>{recordTitle(c, r)}</dt>
                        <dd>
                          {result.value ?? "—"}
                          {result.reason && <small>{result.reason}</small>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p>
                  No records yet. Missing inputs and division by zero will show
                  “—” with a reason.
                </p>
              )}
            </div>
          ),
      )}
    </>
  );
}
export function MonthlyChart({
  collection,
  fieldId,
}: {
  collection: Collection;
  fieldId: string;
}) {
  const counts = monthlyCounts(collection, fieldId),
    max = Math.max(1, ...counts.map(([, n]) => n));
  return (
    <section className="monthly-chart" aria-label="Abandonment by month">
      <div className="section-title">
        <h3>Abandoned by month</h3>
        <span>Grouped by captured date · all records</span>
      </div>
      {counts.length ? (
        <ol>
          {counts.map(([month, n]) => (
            <li key={month}>
              <span>{month}</span>
              <div className="bar-track">
                <div className="bar" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <strong>{n}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="help">
          No captured dates yet. Mark a record Abandoned after applying the rule
          to see monthly counts.
        </p>
      )}
    </section>
  );
}
