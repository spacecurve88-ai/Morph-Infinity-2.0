/** An integration fixture built entirely from generic contracts, never special engine logic. */
import type { AutomationRule, Formula, Snapshot } from "../core/model";
const f = (fieldId: string): Formula => ({ kind: "field", fieldId });
const active = {
  kind: "compare" as const,
  fieldId: "state",
  op: "eq" as const,
  value: "Active",
};
export function economicExample(): Snapshot {
  const rules: AutomationRule[] = [
    {
      version: 1,
      id: "example-cash-flow",
      name: "Operating cash flow",
      collectionId: "example-companies",
      enabled: true,
      trigger: { kind: "simulationStep" },
      when: {
        kind: "all",
        conditions: [
          active,
          { kind: "compare", fieldId: "cash", op: "gt", value: 0 },
        ],
      },
      actions: [
        {
          kind: "increment",
          fieldId: "cash",
          value: {
            kind: "binary",
            op: "-",
            left: f("revenue"),
            right: f("expenses"),
          },
        },
      ],
    },
    {
      version: 1,
      id: "example-bankruptcy",
      name: "Exhausted capital becomes Bankrupt",
      collectionId: "example-companies",
      enabled: true,
      trigger: { kind: "simulationStep" },
      when: {
        kind: "all",
        conditions: [
          active,
          { kind: "compare", fieldId: "cash", op: "lte", value: 0 },
        ],
      },
      actions: [
        {
          kind: "transition",
          fieldId: "state",
          from: ["Active"],
          to: "Bankrupt",
        },
      ],
    },
  ];
  return {
    collections: [
      {
        id: "example-companies",
        name: "Companies",
        fields: [
          { id: "name", name: "Company", type: "text" },
          { id: "cash", name: "Cash", type: "number", unit: "money" },
          {
            id: "employees",
            name: "Employees",
            type: "number",
            unit: "number",
          },
          { id: "revenue", name: "Revenue", type: "number", unit: "money" },
          {
            id: "expenses",
            name: "Expenses",
            type: "computed",
            formula: {
              kind: "aggregate",
              op: "sum",
              collectionId: "example-expenses",
              fieldId: "amount",
              where: { fieldId: "company", sourceRecordId: true },
            },
          },
          { id: "price", name: "Price", type: "number", unit: "money" },
          {
            id: "state",
            name: "Operational state",
            type: "select",
            options: ["Active", "Bankrupt"],
          },
        ],
        records: [
          {
            id: "company-a",
            values: {
              name: "Company A",
              cash: 10,
              employees: 2,
              revenue: 4,
              price: 2,
              state: "Active",
            },
          },
          {
            id: "company-b",
            values: {
              name: "Company B",
              cash: 8,
              employees: 3,
              revenue: 5,
              price: 3,
              state: "Active",
            },
          },
        ],
        rules: [],
      },
      {
        id: "example-expenses",
        name: "Expenses",
        fields: [
          { id: "name", name: "Cost", type: "text" },
          {
            id: "company",
            name: "Company",
            type: "relation",
            targetCollectionId: "example-companies",
          },
          { id: "amount", name: "Amount", type: "number", unit: "money" },
        ],
        records: [
          {
            id: "expense-a1",
            values: { name: "Wages A", company: "company-a", amount: 5 },
          },
          {
            id: "expense-a2",
            values: { name: "Rent A", company: "company-a", amount: 2 },
          },
          {
            id: "expense-b",
            values: { name: "Costs B", company: "company-b", amount: 3 },
          },
        ],
        rules: [],
      },
    ],
    automation: { version: 1, rules },
  };
}
