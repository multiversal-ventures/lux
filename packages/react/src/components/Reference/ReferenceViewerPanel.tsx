import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { useCasePageBlob } from "../Document/useCasePageBlob.js";
import { useReferenceFocus } from "./ReferenceFocusProvider.js";

/**
 * Loose bbox shape Veritas's audit endpoint may emit. Different ingest
 * paths historically used `{x,y,width,height}` (normalized) vs PDF-style
 * `{x0,y0,x1,y1}` (also normalized in our backend). We coerce both to a
 * single normalized rect.
 */
interface BboxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function coerceBbox(raw: Record<string, unknown> | null | undefined): BboxRect | null {
  if (!raw) return null;
  const num = (key: string): number | null => {
    const v = raw[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const x = num("x");
  const y = num("y");
  const w = num("width");
  const h = num("height");
  if (x != null && y != null && w != null && h != null) {
    return { x, y, width: w, height: h };
  }
  const x0 = num("x0");
  const y0 = num("y0");
  const x1 = num("x1");
  const y1 = num("y1");
  if (x0 != null && y0 != null && x1 != null && y1 != null) {
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  return null;
}

// Page-image fetching is centralized in `useCasePageBlob` (Document
// module) so every Lux viewer shares the same cache + GC strategy.

export interface ReferenceViewerPanelProps {
  caseId: string;
  className?: string;
  /** Rendered when nothing is focused (default: a muted hint). */
  emptyFallback?: ReactNode;
  /**
   * When `true` (default), the panel scrolls itself into view whenever
   * focus changes. Disable when embedding inside a scroll container the
   * host controls.
   */
  scrollOnFocus?: boolean;
  /**
   * When `true`, a "Clear" button is rendered that calls
   * `useReferenceFocus().clearFocus()`. Default: true.
   */
  showClearButton?: boolean;
  /** Optional header rendered above the page image. */
  renderHeader?: (focusLabel: string) => ReactNode;
}

const titleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.5rem 0.75rem",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "0.75rem",
  color: "#475569",
};

const detailRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "baseline",
  fontSize: "0.75rem",
  color: "#475569",
  padding: "0.25rem 0.75rem",
};

/**
 * Composable reference viewer. Subscribes to {@link useReferenceFocus}
 * — when a host or `ScenarioRefs` calls `setFocus(...)`, this panel
 * fetches the page image via the singleton `VeritasClient`
 * (`@fenero-ai/lux-core.getDefaultClient()`) and renders it with bbox
 * overlays for the focused source.
 *
 * Designed to be dropped beside or inside any layout — it owns no
 * navigation policy. To wire URL deep-links or modal toggles, listen
 * to `onFocusChange` on the {@link ReferenceFocusProvider} instead.
 */
export function ReferenceViewerPanel({
  caseId,
  className,
  emptyFallback,
  scrollOnFocus = true,
  showClearButton = true,
  renderHeader,
}: ReferenceViewerPanelProps) {
  const ctx = useReferenceFocus();
  const focus = ctx?.focus ?? null;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollOnFocus || !focus) return;
    const id = requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, scrollOnFocus]);

  const highlights = useMemo<{ id: string; bbox: BboxRect; isActive: boolean; label?: string }[]>(() => {
    if (!focus) return [];
    const active = focus.payload;
    const sources = active.sources ?? [];
    const out: { id: string; bbox: BboxRect; isActive: boolean; label?: string }[] = [];
    sources.forEach((src, idx) => {
      const bbox = coerceBbox((src.bbox as Record<string, unknown>) ?? null);
      if (!bbox) return;
      const isActive =
        (active.page != null && src.page_number === active.page) || idx === 0;
      out.push({
        id: `${focus.canonicalKey}::${idx}`,
        bbox,
        isActive,
        label: src.page_number != null ? `p.${src.page_number}` : focus.canonicalKey,
      });
    });
    if (out.length === 0) {
      const fallback = coerceBbox((active.bbox as Record<string, unknown>) ?? null);
      if (fallback) {
        out.push({
          id: `${focus.canonicalKey}::primary`,
          bbox: fallback,
          isActive: true,
          label: focus.canonicalKey,
        });
      }
    }
    return out;
  }, [focus]);

  const fileId = focus?.payload.file_id ?? null;
  const page = focus?.payload.page ?? null;
  const blob = useCasePageBlob(caseId, fileId, page);

  if (!focus || !fileId || page == null) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{ padding: "1rem", color: "#94a3b8", fontSize: "0.875rem" }}
      >
        {emptyFallback ?? "Click a reference to view its page and bounding box."}
      </div>
    );
  }

  const focusLabel = focus.canonicalKey;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {renderHeader
        ? renderHeader(focusLabel)
        : (
          <div style={titleStyle}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", minWidth: 0 }}>
              <span style={{ color: "#94a3b8", fontSize: "0.6875rem", textTransform: "uppercase" }}>
                Reference
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  color: "#1e293b",
                  fontSize: "0.75rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {focusLabel}
              </span>
            </div>
            {showClearButton && (
              <button
                type="button"
                onClick={() => ctx?.clearFocus()}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  padding: "0.125rem 0.5rem",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: "0.6875rem",
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

      <div style={detailRowStyle}>
        <span style={{ color: "#94a3b8" }}>Page</span>
        <span style={{ color: "#1e293b" }}>{page}</span>
        {focus.payload.variable && (
          <>
            <span style={{ color: "#94a3b8", marginLeft: "0.75rem" }}>Variable</span>
            <span style={{ color: "#1e293b", fontFamily: "monospace" }}>
              {focus.payload.variable}
            </span>
          </>
        )}
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "0.5rem 0.75rem" }}>
        {blob.isPending && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "0.75rem",
            }}
          >
            Loading page {page}…
          </div>
        )}
        {blob.isError && (
          <div
            style={{
              padding: "1rem",
              color: "#b91c1c",
              fontSize: "0.75rem",
              border: "1px solid #fecaca",
              borderRadius: 6,
              background: "#fef2f2",
            }}
          >
            Couldn't load page {page} of file {fileId.slice(0, 8)}…: {blob.error?.message ?? "error"}
          </div>
        )}
        {blob.data && (
          <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
            <img
              src={blob.data}
              alt={`Page ${page}`}
              style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }}
              draggable={false}
            />
            {highlights.map((h) => (
              <div
                key={h.id}
                style={{
                  position: "absolute",
                  left: `${h.bbox.x * 100}%`,
                  top: `${h.bbox.y * 100}%`,
                  width: `${h.bbox.width * 100}%`,
                  height: `${h.bbox.height * 100}%`,
                  border: `2px solid ${h.isActive ? "#f97316" : "#3b82f6"}`,
                  background: h.isActive
                    ? "rgba(249, 115, 22, 0.18)"
                    : "rgba(59, 130, 246, 0.10)",
                  pointerEvents: "none",
                }}
                aria-label={h.label}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
