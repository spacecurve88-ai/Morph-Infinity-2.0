import { currentSnapshot, uid } from "../core/model";
import type {
  Collection,
  Document,
  Field,
  Formula,
  Workspace,
} from "../core/model";
import type { FeaturePlan } from "../core/engine";
import { previewPlan } from "../core/engine";

export function template(
  kind: "reading" | "budget" | "blank",
  name?: string,
): Collection {
  const fields: Field[] = [
    { id: uid(), name: kind === "reading" ? "Book" : "Name", type: "text" },
  ];
  if (kind === "reading")
    fields.push(
      { id: uid(), name: "Pages Read", type: "number", unit: "pages" },
      { id: uid(), name: "Minutes Read", type: "number", unit: "minutes" },
      {
        id: uid(),
        name: "Status",
        type: "select",
        options: ["To read", "Reading", "Finished", "Abandoned"],
      },
    );
  if (kind === "budget")
    fields.push(
      { id: uid(), name: "Income", type: "number", unit: "money" },
      { id: uid(), name: "Expenses", type: "number", unit: "money" },
    );
  return {
    id: uid(),
    name:
      name ??
      (kind === "reading"
        ? "Reading"
        : kind === "budget"
          ? "Budget"
          : "Untitled collection"),
    fields,
    records: [],
    rules: [],
  };
}
export function basePlan(
  document: Document,
  w: Workspace,
  summary: string,
  operations: FeaturePlan["operations"],
): FeaturePlan {
  const plan: FeaturePlan = {
    version: 1,
    baseRevision: document.revision,
    workspaceId: w.id,
    branchId: w.activeBranchId,
    summary,
    operations,
  };
  previewPlan(document, plan);
  return plan;
}
export function parseFormula(text: string, c: Collection): Formula {
  if (text.length > 500) throw new Error("Formula is too long.");
  let position = 0,
    depth = 0;
  const skip = () => {
    while (/\s/.test(text[position] ?? "") && position < text.length)
      position++;
  };
  function primary(): Formula {
    if (++depth > 12) throw new Error("Formula is too deeply nested.");
    skip();
    let result: Formula;
    if (text[position] === "(") {
      position++;
      result = expression();
      skip();
      if (text[position++] !== ")")
        throw new Error("Missing closing parenthesis.");
    } else {
      const remaining = text.slice(position);
      const f = [...c.fields]
        .sort((a, b) => b.name.length - a.name.length)
        .find(
          (f) =>
            remaining.toLowerCase().startsWith(f.name.toLowerCase()) &&
            !/[\w]/.test(remaining[f.name.length] ?? ""),
        );
      const number = remaining.match(/^-?\d+(?:\.\d+)?/);
      if (f) {
        position += f.name.length;
        result = { kind: "field", fieldId: f.id };
      } else if (number) {
        position += number[0].length;
        result = { kind: "number", value: Number(number[0]) };
      } else
        throw new Error(
          `Unknown field or number near “${remaining.slice(0, 30)}”.`,
        );
    }
    depth--;
    return result;
  }
  function product(): Formula {
    let left = primary();
    skip();
    while (text[position] === "*" || text[position] === "/") {
      const op = text[position++] as "*" | "/";
      left = { kind: "binary", op, left, right: primary() };
      skip();
    }
    return left;
  }
  function expression(): Formula {
    let left = product();
    skip();
    while (text[position] === "+" || text[position] === "-") {
      const op = text[position++] as "+" | "-";
      left = { kind: "binary", op, left, right: product() };
      skip();
    }
    return left;
  }
  const formula = expression();
  skip();
  if (position !== text.length)
    throw new Error(
      "Unsupported formula syntax. Use field names, numbers, parentheses, and + − * /.",
    );
  return formula;
}
export function propose(
  document: Document,
  w: Workspace,
  collectionId: string | undefined,
  request: string,
): FeaturePlan {
  const text = request.trim();
  if (!text || text.length > 600)
    throw new Error("Enter a request of up to 600 characters.");
  if (
    /^(?:build|create)(?: me)? (?:a )?(?:reading tracker|budget)(?: workspace)?[.!]?$/i.test(
      text,
    )
  ) {
    const c = template(/reading/i.test(text) ? "reading" : "budget");
    return basePlan(document, w, `Create ${c.name} collection`, [
      { type: "addCollection", collection: c },
    ]);
  }
  const c = currentSnapshot(w).collections.find((c) => c.id === collectionId);
  if (!c)
    throw new Error(
      "Choose a collection, or try “Build me a reading tracker”.",
    );
  let formulaRequest = text.match(
    /^(?:(?:add |calculate )(?:calculated |computed )?)?([^=]{1,100})\s*=\s*(.+)$/i,
  );
  if (
    /^calculate reading speed using pages read and minutes read[.!]?$/i.test(
      text,
    )
  )
    formulaRequest = ["", "Reading Speed", "Pages Read / Minutes Read"];
  if (formulaRequest) {
    const name = formulaRequest[1].trim();
    return basePlan(document, w, `Add ${name}`, [
      {
        type: "addField",
        collectionId: c.id,
        field: {
          id: uid(),
          name,
          type: "computed",
          formula: parseFormula(formulaRequest[2], c),
        },
      },
    ]);
  }
  if (
    /^when I mark (?:a book|a record) abandoned,? (?:record|save) (?:today's|the) date[.!]?$/i.test(
      text,
    )
  ) {
    const status = c.fields.find(
      (f) => f.name.toLowerCase() === "status" && f.type === "select",
    );
    if (!status)
      throw new Error(
        "This rule requires a Status select field with an Abandoned option.",
      );
    return basePlan(
      document,
      w,
      "Record the abandonment date once on future status changes",
      [
        {
          type: "captureDateOnce",
          collectionId: c.id,
          triggerFieldId: status.id,
          equals: "Abandoned",
          field: { id: uid(), name: "Abandoned on", type: "date" },
          ruleId: uid(),
        },
      ],
    );
  }
  throw new Error(
    "This request is not supported. Try a reading tracker, budget, “Reading Speed = Pages Read / Minutes Read”, or the abandonment date rule. Reminders, external calls, AI, and custom code are unavailable.",
  );
}
