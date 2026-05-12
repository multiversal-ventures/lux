/** Format a value for inline display in a reference table / detail. */
export function formatReferenceValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Truncate a long label with a trailing ellipsis. */
export function shortenText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Human-readable bbox summary (handles both `{x,y,width,height}` and `{x0,y0,x1,y1}`). */
export function bboxLabel(bbox: Record<string, unknown> | null | undefined): string | null {
  if (!bbox) return null;
  const numericFields = Object.entries(bbox).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v),
  );
  if (numericFields.length === 0) return null;
  return numericFields
    .map(([k, v]) => `${k}:${Math.round(v as number)}`)
    .join(" ");
}
