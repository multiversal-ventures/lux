import { useReferenceFocus } from "../Reference/ReferenceFocusProvider.js";
import { bboxLabel, formatReferenceValue, shortenText } from "./referenceFormat.js";
import {
  payloadFromRow,
  type ExtractionSourceRef,
  type RefClickPayload,
  type ScenarioReferenceRow,
} from "./useScenarioReferences.js";

export interface ScenarioReferenceDetailProps {
  /** Row to render. When `null`, the detail panel emits its empty state. */
  row: ScenarioReferenceRow | null;
  /**
   * Optional callback for inline activation — fired on source button
   * clicks (and on whatever "in-context" gesture the host wants).
   * Always called in addition to the implicit `setFocus(...)` on the
   * surrounding {@link ReferenceFocusProvider} (when present).
   */
  onActivate?: (canonicalKey: string, payload: RefClickPayload) => void;
  /**
   * Optional callback for the "Open in document viewer" CTA — separate
   * from {@link onActivate} so hosts can route the CTA to a dedicated
   * viewer page while leaving inline focus untouched. When omitted, the
   * CTA falls back to {@link onActivate} (which keeps the previous
   * single-callback behaviour).
   */
  onOpenInViewer?: (canonicalKey: string, payload: RefClickPayload) => void;
  /** Label of the "Open" CTA. Pass `null` to hide it entirely. */
  openCtaLabel?: string | null;
  /** Text shown when `row` is `null`. */
  emptyMessage?: string;
  className?: string;
}

/**
 * Detail panel for a single {@link ScenarioReferenceRow}. Shows the
 * canonical key, value (with optional raw form), spec-input variable
 * names that consumed it, contributing specs, and clickable per-source
 * buttons (page + bbox + OCR snippet).
 */
export function ScenarioReferenceDetail({
  row,
  onActivate,
  onOpenInViewer,
  openCtaLabel = "Open in document viewer",
  emptyMessage = "Select a row to see details.",
  className,
}: ScenarioReferenceDetailProps) {
  const refCtx = useReferenceFocus();
  const activate = (
    targetRow: ScenarioReferenceRow,
    source?: ExtractionSourceRef | null,
  ) => {
    const payload = payloadFromRow(targetRow, source);
    refCtx?.setFocus(targetRow.canonicalKey, payload);
    onActivate?.(targetRow.canonicalKey, payload);
  };
  // CTA fires `onOpenInViewer` when provided; otherwise falls back to
  // the inline activation path so the button still does *something* for
  // hosts that don't wire a full-viewer route.
  const openInViewer = (targetRow: ScenarioReferenceRow) => {
    const payload = payloadFromRow(targetRow);
    if (onOpenInViewer) {
      onOpenInViewer(targetRow.canonicalKey, payload);
      return;
    }
    refCtx?.setFocus(targetRow.canonicalKey, payload);
    onActivate?.(targetRow.canonicalKey, payload);
  };

  if (!row) {
    return (
      <div className={className} style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>
        {emptyMessage}
      </div>
    );
  }

  const formatted = formatReferenceValue(row.value);
  const rawFormatted = formatReferenceValue(row.rawValue);

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      <div>
        <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", color: "#64748b" }}>
          {row.docType || "Reference"}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: "0.8125rem", marginTop: 2 }}>
          {row.canonicalKey}
        </div>
      </div>

      {formatted != null && (
        <div>
          <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Value</div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "1rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatted}
          </div>
          {rawFormatted && rawFormatted !== formatted && (
            <div style={{ color: "#94a3b8", fontSize: "0.6875rem", fontFamily: "monospace" }}>
              raw: {rawFormatted}
            </div>
          )}
        </div>
      )}

      {row.variables.length > 0 && (
        <div>
          <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Consumed as</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: 4 }}>
            {row.variables.map((v) => (
              <span
                key={v}
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.6875rem",
                  background: "#e0e7ff",
                  color: "#3730a3",
                  padding: "0.125rem 0.4rem",
                  borderRadius: 4,
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {row.specs.length > 0 && (
        <div>
          <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Used by</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: 4 }}>
            {row.specs.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.6875rem",
                  color: "#475569",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Source</div>
        {row.sources.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
            No page/bbox source recorded.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: 4 }}>
            {row.sources.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => activate(row, s)}
                style={{
                  textAlign: "left",
                  padding: "0.4rem 0.5rem",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  Page {s.page_number ?? "?"}
                  {s.bbox ? " · bbox" : ""}
                </span>
                {s.bbox && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "#64748b",
                      fontSize: "0.6875rem",
                    }}
                  >
                    {bboxLabel(s.bbox) ?? "[bbox]"}
                  </span>
                )}
                {s.ocr_text_snippet && (
                  <span
                    style={{
                      color: "#475569",
                      fontSize: "0.6875rem",
                      fontStyle: "italic",
                    }}
                  >
                    “{shortenText(s.ocr_text_snippet, 80)}”
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {openCtaLabel != null && (
        <div style={{ marginTop: "0.25rem" }}>
          <button
            type="button"
            onClick={() => openInViewer(row)}
            style={{
              width: "100%",
              padding: "0.4rem 0.6rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {openCtaLabel}
          </button>
        </div>
      )}
    </div>
  );
}
