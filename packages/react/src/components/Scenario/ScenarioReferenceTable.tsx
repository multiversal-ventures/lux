import type { CSSProperties } from "react";
import { useReferenceFocus } from "../Reference/ReferenceFocusProvider.js";
import { formatReferenceValue, shortenText } from "./referenceFormat.js";
import {
  payloadFromRow,
  type RefClickPayload,
  type ScenarioReferenceRow,
} from "./useScenarioReferences.js";

export interface ScenarioReferenceTableProps {
  /** Rows to render — typically `useScenarioReferences().rows`. */
  rows: ScenarioReferenceRow[];
  /** Currently-selected row key (controlled). */
  selectedKey?: string | null;
  /** Called when a row is selected (single-click). */
  onSelect?: (row: ScenarioReferenceRow) => void;
  /**
   * Called when a row is "activated" (single-click default, or
   * double-click on touch-free hosts). Defaults to publishing focus via
   * the surrounding {@link ReferenceFocusProvider} when one exists, so
   * sibling viewers can react without additional wiring.
   */
  onActivate?: (canonicalKey: string, payload: RefClickPayload) => void;
  /** Shown above the table — used by `ScenarioRefs` to surface the derived-docs notice. */
  banner?: React.ReactNode;
  className?: string;
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: "0.75rem",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
const thStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  padding: "0.4rem 0.6rem",
  fontWeight: 600,
  color: "#475569",
  fontSize: "0.6875rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#1e293b",
};

/**
 * Table of {@link ScenarioReferenceRow} entries. Composable: pair it
 * with {@link ScenarioReferenceDetail} or {@link ReferenceViewerPanel}
 * or any host-built UI.
 *
 * Selection is fully controlled — pass `selectedKey` + `onSelect`. The
 * component additionally publishes focus to the surrounding
 * {@link ReferenceFocusProvider} on activation so single-pane viewers
 * "just work" without a callback.
 */
export function ScenarioReferenceTable({
  rows,
  selectedKey,
  onSelect,
  onActivate,
  banner,
  className,
}: ScenarioReferenceTableProps) {
  const refCtx = useReferenceFocus();
  const activate = (row: ScenarioReferenceRow) => {
    const payload = payloadFromRow(row);
    refCtx?.setFocus(row.canonicalKey, payload);
    onActivate?.(row.canonicalKey, payload);
  };

  return (
    <div
      className={className}
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 0,
        overflow: "auto",
      }}
    >
      {banner}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Field</th>
            <th style={thStyle}>Doc</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
            <th style={thStyle}>Page</th>
            <th style={thStyle}>Used by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const formatted = formatReferenceValue(r.value);
            const isSelected = (selectedKey ?? "") === r.rowKey;
            const firstPage = r.sources[0]?.page_number ?? null;
            const pageBadge =
              r.sources.length > 1
                ? `${firstPage ?? "?"} (+${r.sources.length - 1})`
                : firstPage != null
                  ? String(firstPage)
                  : "—";
            return (
              <tr
                key={r.rowKey}
                onClick={() => {
                  onSelect?.(r);
                  activate(r);
                }}
                onDoubleClick={() => activate(r)}
                style={{
                  background: isSelected ? "#eff6ff" : undefined,
                  cursor: "pointer",
                }}
              >
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.6875rem" }}>
                  {r.field}
                </td>
                <td style={{ ...tdStyle, color: "#475569" }}>{r.docType || "—"}</td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                  }}
                >
                  {formatted ?? "—"}
                </td>
                <td style={{ ...tdStyle, color: "#475569" }}>{pageBadge}</td>
                <td
                  style={{
                    ...tdStyle,
                    color: "#64748b",
                    fontSize: "0.6875rem",
                    maxWidth: 220,
                  }}
                >
                  {r.variables.length > 0
                    ? shortenText(r.variables.join(", "), 60)
                    : r.specs.length > 0
                      ? shortenText(r.specs.join(", "), 60)
                      : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
