import { useState } from "react";
import { useReferenceFocus } from "../Reference/ReferenceFocusProvider.js";
import { ScenarioReferenceDetail } from "./ScenarioReferenceDetail.js";
import { ScenarioReferenceTable } from "./ScenarioReferenceTable.js";
import {
  useScenarioReferences,
  type RefClickPayload,
  type ScenarioReferenceRow,
} from "./useScenarioReferences.js";

export type { RefClickPayload } from "./useScenarioReferences.js";

export interface ScenarioRefsProps {
  /**
   * Optional click handler. Receives the canonicalKey + payload with
   * file_id / doc_id / page / bbox so hosts can wire URL deep-links,
   * analytics, etc.
   *
   * When a {@link ReferenceFocusProvider} wraps this component, clicks
   * ALSO call `setFocus(...)` on that context — letting a sibling
   * {@link ReferenceViewerPanel} (or any custom consumer) react. The
   * two behaviours coexist so hosts can subscribe to either or both.
   */
  onRefClick?: (canonicalKey: string, payload: RefClickPayload) => void;
  /**
   * Separate handler for the "Open in document viewer" CTA. Lets hosts
   * route to a dedicated viewer page while inline `onRefClick` /
   * `setFocus(...)` keep driving the sibling viewer panel. When
   * omitted, the CTA falls back to `onRefClick`.
   */
  onOpenInViewer?: (canonicalKey: string, payload: RefClickPayload) => void;
  className?: string;
}

/**
 * Opinionated default layout: a two-pane table + detail. For custom
 * layouts compose {@link useScenarioReferences},
 * {@link ScenarioReferenceTable}, {@link ScenarioReferenceDetail}, and
 * {@link ReferenceViewerPanel} directly instead.
 */
export function ScenarioRefs({ onRefClick, onOpenInViewer, className }: ScenarioRefsProps) {
  const { rows, derivedFromDocs, emptyMessage } = useScenarioReferences();
  const refCtx = useReferenceFocus();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected =
    rows.find((r) => r.rowKey === selectedKey) ?? rows[0] ?? null;

  const dispatch = (canonicalKey: string, payload: RefClickPayload) => {
    refCtx?.setFocus(canonicalKey, payload);
    onRefClick?.(canonicalKey, payload);
  };

  if (rows.length === 0) {
    if (typeof window !== "undefined" && emptyMessage) {
      console.warn("[ScenarioRefs] no refs", { emptyMessage });
    }
    return (
      <div
        className={className}
        style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}
      >
        {emptyMessage ?? "No references for this product."}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flex: "1 1 auto",
        minHeight: 0,
        height: "100%",
        background: "#fff",
      }}
    >
      <div
        style={{
          flex: "1 1 60%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          borderRight: "1px solid #e2e8f0",
        }}
      >
        <ScenarioReferenceTable
          rows={rows}
          selectedKey={selected?.rowKey ?? null}
          onSelect={(row: ScenarioReferenceRow) => setSelectedKey(row.rowKey)}
          onActivate={dispatch}
          banner={
            derivedFromDocs ? (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "#fef3c7",
                  borderBottom: "1px solid #fde68a",
                  fontSize: "0.75rem",
                  color: "#92400e",
                }}
              >
                Showing source documents — per-derivation references aren't recorded for this run.
              </div>
            ) : null
          }
        />
      </div>

      <aside
        style={{
          flex: "0 0 320px",
          minWidth: 280,
          maxWidth: 360,
          overflow: "auto",
          padding: "0.875rem 1rem",
          background: "#fafafa",
          fontSize: "0.8125rem",
          color: "#0f172a",
        }}
      >
        <ScenarioReferenceDetail
          row={selected}
          onActivate={dispatch}
          onOpenInViewer={onOpenInViewer}
        />
      </aside>
    </div>
  );
}
