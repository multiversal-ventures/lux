import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ExtractionResponse,
  VeritasCaseDocument,
} from "@multiversal-ventures/lux-core";
import { useReferenceFocus } from "../Reference/ReferenceFocusProvider.js";
import { CasePageImage } from "./CasePageImage.js";
import { useCaseExtractions } from "./useCaseExtractions.js";

/** A single extraction-source bbox painted onto a page. */
interface BboxSourceRow {
  source: ExtractionResponse["sources"][number];
  extraction: ExtractionResponse;
}

export interface CaseDocumentViewerClassNames {
  /** Wrapping element. Default: empty. */
  root?: string;
  /** Pages column (scrollable). */
  pagesColumn?: string;
  /** Each page card. */
  pageCard?: string;
  /** Per-page label badge ("Page 1"). */
  pageBadge?: string;
  /** Bbox overlay default state. */
  bbox?: string;
  /** Bbox overlay when the extraction is selected. */
  bboxActive?: string;
  /** Extractions sidebar column. */
  sidebar?: string;
  /** Sidebar header / count area. */
  sidebarHeader?: string;
  /** Each extraction button. */
  extractionButton?: string;
  /** Extraction button when selected. */
  extractionButtonActive?: string;
  /** Empty-state container. */
  empty?: string;
}

const DEFAULT_CLASSES: Required<CaseDocumentViewerClassNames> = {
  root: "",
  pagesColumn: "",
  pageCard: "",
  pageBadge: "",
  bbox: "",
  bboxActive: "",
  sidebar: "",
  sidebarHeader: "",
  extractionButton: "",
  extractionButtonActive: "",
  empty: "",
};

export interface CaseDocumentViewerRenderSlots {
  /** Custom rendering of the sidebar header (title + count). */
  sidebarHeader?: (info: {
    extractionCount: number;
    selected: ExtractionResponse | null;
  }) => ReactNode;
  /** Custom rendering of a single extraction row in the sidebar. */
  extractionRow?: (info: {
    extraction: ExtractionResponse;
    isSelected: boolean;
    onSelect: () => void;
  }) => ReactNode;
  /** Custom rendering above the pages column (e.g. doc header). */
  pagesHeader?: () => ReactNode;
  /** Custom empty state when no pages are present. */
  emptyPages?: () => ReactNode;
  /** Custom empty state when no extractions are present. */
  emptyExtractions?: () => ReactNode;
}

export interface CaseDocumentViewerProps {
  caseId: string;
  /**
   * All docs of the same type for the current selection (stitched
   * together — e.g. a 2-page 1040 returned as a single VeritasCaseDocument).
   */
  docs: VeritasCaseDocument[];
  /** Called when the user selects an extraction in the sidebar / bbox. */
  onSelectionChange?: (extraction: ExtractionResponse | null) => void;
  /** External controlled selection. When omitted, the viewer manages its own. */
  selectedExtractionId?: string | null;
  /** Style hooks for the host. */
  classNames?: CaseDocumentViewerClassNames;
  /** Composition slots for the host. */
  slots?: CaseDocumentViewerRenderSlots;
  /** Optional className applied to the outer wrapper (in addition to `classNames.root`). */
  className?: string;
}

/**
 * Multi-page document viewer. Renders every page's image with bbox
 * overlays for all extractions, plus a sidebar of extractions the user
 * can pin / unpin. Auto-subscribes to {@link useReferenceFocus} when a
 * provider is present, so URL params (via
 * `useReferenceFocusFromSearchParams`) or sibling clicks (via
 * `ScenarioRefs`) automatically light up the right bbox.
 *
 * Styling is host-controlled via `classNames` + `slots` — the default
 * has no visual opinion beyond layout primitives (flex columns), so
 * gunnr-style dark themes, portal light themes, etc. can layer on top
 * without overriding internals.
 */
export function CaseDocumentViewer({
  caseId,
  docs,
  onSelectionChange,
  selectedExtractionId,
  classNames,
  slots,
  className,
}: CaseDocumentViewerProps) {
  const cls = { ...DEFAULT_CLASSES, ...(classNames ?? {}) };
  const { pages, pageToFileId } = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of docs) {
      for (const p of d.page_numbers ?? []) {
        map.set(p, d.file_id);
      }
    }
    return {
      pageToFileId: map,
      pages: [...map.keys()].sort((a, b) => a - b),
    };
  }, [docs]);

  const docIds = useMemo(
    () => docs.map((d) => d.doc_id).filter((x): x is string => !!x),
    [docs],
  );

  const { data: extractions = [] } = useCaseExtractions(caseId, docIds);

  // Selection: uncontrolled by default; controlled when host supplies
  // `selectedExtractionId`. Either way the final source-of-truth here
  // is `selected`, which the rest of the component reads from.
  const [internalSelected, setInternalSelected] =
    useState<ExtractionResponse | null>(null);
  const externallyControlled = selectedExtractionId !== undefined;
  const selected = externallyControlled
    ? extractions.find((ex) => ex.extraction_id === selectedExtractionId) ?? null
    : internalSelected;

  const setSelected = (next: ExtractionResponse | null) => {
    if (!externallyControlled) setInternalSelected(next);
    onSelectionChange?.(next);
  };

  // ReferenceFocus sync — auto-select when an outside source (URL,
  // ScenarioRefs) publishes focus. Only acts when there's a real
  // canonical_key or extraction_id match in our extraction list.
  const focusCtx = useReferenceFocus();
  const focusedKey = focusCtx?.focus?.canonicalKey ?? null;
  const focusedFileId = focusCtx?.focus?.payload.file_id ?? null;
  const focusedExtractionId = focusCtx?.focus?.payload.extraction_id ?? null;
  useEffect(() => {
    if (!focusedKey && !focusedExtractionId) return;
    if (focusedFileId && !Array.from(pageToFileId.values()).includes(focusedFileId)) {
      // Focus is on a file not in this viewer's docs — ignore.
      return;
    }
    const match =
      (focusedExtractionId &&
        extractions.find((ex) => ex.extraction_id === focusedExtractionId)) ||
      extractions.find(
        (ex) => ex.canonical_key === focusedKey || ex.field_name === focusedKey,
      ) ||
      null;
    if (match && (selected?.extraction_id ?? null) !== match.extraction_id) {
      if (!externallyControlled) setInternalSelected(match);
      onSelectionChange?.(match);
    }
    // selected intentionally omitted from deps — only re-run on focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedKey, focusedExtractionId, focusedFileId, extractions, pageToFileId]);

  // Scroll the active bbox into view after it paints.
  const activeBboxRef = useRef<HTMLDivElement | null>(null);
  const extractionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  useEffect(() => {
    if (!selected) return;
    const id = requestAnimationFrame(() => {
      activeBboxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    const btn = extractionRefs.current.get(selected.extraction_id);
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div
      className={[cls.root, className].filter(Boolean).join(" ")}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
    >
      <div style={{ display: "flex", flex: "1 1 auto", overflow: "hidden", minHeight: 0 }}>
        {/* Pages column */}
        <div
          className={cls.pagesColumn}
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "0.75rem",
          }}
        >
          {slots?.pagesHeader?.()}
          {pages.length === 0 ? (
            slots?.emptyPages?.() ?? (
              <div className={cls.empty} style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                No pages available.
              </div>
            )
          ) : (
            pages.map((p) => {
              const fileId = pageToFileId.get(p) ?? docs[0]?.file_id ?? "";
              const allBboxes: BboxSourceRow[] = extractions.flatMap((ex) =>
                ex.sources
                  .filter((s) => s.page_number === p && s.bbox && s.file_id === fileId)
                  .map((s) => ({ source: s, extraction: ex })),
              );
              return (
                <div
                  key={p}
                  className={cls.pageCard}
                  style={{ position: "relative" }}
                >
                  <div
                    className={cls.pageBadge}
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      zIndex: 1,
                      padding: "0.125rem 0.5rem",
                      borderRadius: 4,
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      background: "rgba(15, 23, 42, 0.78)",
                      color: "#fff",
                    }}
                  >
                    Page {p}
                  </div>
                  <div style={{ position: "relative" }}>
                    <CasePageImage caseId={caseId} fileId={fileId} pageNumber={p} />
                    {allBboxes.map(({ source, extraction }, i) => {
                      const bbox = source.bbox;
                      if (!bbox) return null;
                      const isActive =
                        selected?.extraction_id === extraction.extraction_id;
                      return (
                        <div
                          key={`${extraction.extraction_id}::${i}`}
                          ref={isActive ? (el) => { activeBboxRef.current = el; } : undefined}
                          onClick={() =>
                            setSelected(isActive ? null : extraction)
                          }
                          role="button"
                          tabIndex={0}
                          aria-label={extraction.field_name ?? extraction.canonical_key ?? "bbox"}
                          className={`${cls.bbox}${isActive ? ` ${cls.bboxActive}` : ""}`}
                          style={{
                            position: "absolute",
                            left: `${bbox.x * 100}%`,
                            top: `${bbox.y * 100}%`,
                            width: `${bbox.width * 100}%`,
                            height: `${bbox.height * 100}%`,
                            cursor: "pointer",
                            outline: isActive
                              ? "2px solid #f97316"
                              : "1px solid rgba(59, 130, 246, 0.6)",
                            background: isActive
                              ? "rgba(249, 115, 22, 0.18)"
                              : "rgba(59, 130, 246, 0.08)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Extractions sidebar */}
        <aside
          className={cls.sidebar}
          style={{
            flex: "0 0 320px",
            minWidth: 280,
            maxWidth: 360,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {slots?.sidebarHeader
            ? slots.sidebarHeader({
                extractionCount: extractions.length,
                selected,
              })
            : (
              <div
                className={cls.sidebarHeader}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#475569",
                }}
              >
                Extractions ({extractions.length})
              </div>
            )}
          {extractions.length === 0 ? (
            slots?.emptyExtractions?.() ?? (
              <div
                className={cls.empty}
                style={{ padding: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}
              >
                No extractions found.
              </div>
            )
          ) : (
            extractions.map((ex) => {
              const isSelected = selected?.extraction_id === ex.extraction_id;
              const setBtnRef = (el: HTMLButtonElement | null) => {
                if (el) extractionRefs.current.set(ex.extraction_id, el);
                else extractionRefs.current.delete(ex.extraction_id);
              };
              if (slots?.extractionRow) {
                return (
                  <div key={ex.extraction_id} ref={setBtnRef as never}>
                    {slots.extractionRow({
                      extraction: ex,
                      isSelected,
                      onSelect: () => setSelected(isSelected ? null : ex),
                    })}
                  </div>
                );
              }
              return (
                <button
                  key={ex.extraction_id}
                  ref={setBtnRef}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : ex)}
                  className={`${cls.extractionButton}${isSelected ? ` ${cls.extractionButtonActive}` : ""}`}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem 0.75rem",
                    background: isSelected ? "rgba(249, 115, 22, 0.10)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.6875rem",
                      color: "#475569",
                    }}
                  >
                    {ex.field_name ?? ex.canonical_key ?? "—"}
                  </div>
                  <div style={{ fontWeight: 500, color: "#1e293b", marginTop: 2 }}>
                    {ex.value ?? "—"}
                  </div>
                </button>
              );
            })
          )}
        </aside>
      </div>
    </div>
  );
}
