import type { Field, Scalar } from "./model";
export function valueType(field: Field): string {
  return field.type === "computed"
    ? "number"
    : ["select", "text", "date", "relation"].includes(field.type)
      ? "string"
      : field.type;
}
export function assertValue(
  field: Field,
  value: Scalar,
  allowComputed = false,
): void {
  if (field.type === "computed" && !allowComputed)
    throw new Error("Computed fields cannot be written.");
  if (value === null) return;
  if (typeof value !== valueType(field))
    throw new Error(`Invalid value type for “${field.name}”.`);
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Nonfinite numeric value.");
  if (field.type === "select" && !field.options.includes(String(value)))
    throw new Error(`Invalid select value for “${field.name}”.`);
  if (field.type === "date") {
    const date = String(value),
      parsed = new Date(`${date}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error("Invalid calendar date.");
  }
}
