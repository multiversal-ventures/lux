import { useEffect } from "react";
import type { RefClickPayload } from "../Scenario/ScenarioRefs.js";
import { useReferenceFocus } from "./ReferenceFocusProvider.js";

/**
 * Minimal `URLSearchParams`-shaped input — accepts the standard
 * browser `URLSearchParams` as well as react-router's
 * `[URLSearchParams, SetURLSearchParams]` first tuple element. Hosts
 * just pass whatever their router gives them; Lux stays
 * router-agnostic.
 */
export interface SearchParamsLike {
  get(name: string): string | null;
}

/** Query-param names the hook reads. Override to align with host conventions. */
export interface ReferenceFocusParamNames {
  file?: string;
  page?: string;
  fact?: string;
  bbox?: string;
  /** Optional. Doc UUID — surfaced on payload.doc_id. */
  doc?: string;
  /** Optional. Extraction UUID — surfaced on payload.extraction_id. */
  extraction?: string;
  /** Optional. Spec input variable name — surfaced on payload.variable. */
  variable?: string;
}

const DEFAULT_NAMES: Required<ReferenceFocusParamNames> = {
  file: "file",
  page: "page",
  fact: "fact",
  bbox: "bbox",
  doc: "doc",
  extraction: "extraction",
  variable: "variable",
};

export interface UseReferenceFocusFromSearchParamsOptions {
  /** Query-param name overrides. */
  paramNames?: ReferenceFocusParamNames;
  /**
   * Called after the hook publishes focus from URL params. Hosts use
   * this to clear the URL (so the back button doesn't re-trigger focus)
   * or to mark params as "consumed". The hook itself never mutates the
   * URL.
   */
  onApplied?: (focusedFact: string) => void;
  /**
   * Default to `1` when only `?file=...` is present (no `?page=...`).
   * Pass `null` to require an explicit page.
   */
  defaultPage?: number | null;
}

/**
 * Parse a `URLSearchParams`-like into a {@link RefClickPayload}. Returns
 * `null` when no `file` is present, since deep-linking without a file
 * id can't focus a viewer.
 */
export function payloadFromSearchParams(
  params: SearchParamsLike,
  paramNames: ReferenceFocusParamNames = {},
  defaultPage: number | null = 1,
): { canonicalKey: string; payload: RefClickPayload } | null {
  const names = { ...DEFAULT_NAMES, ...paramNames };
  const file = params.get(names.file);
  if (!file) return null;

  const pageRaw = params.get(names.page);
  const parsed = pageRaw != null ? Number.parseInt(pageRaw, 10) : NaN;
  const page = Number.isFinite(parsed) ? parsed : defaultPage;

  const canonicalKey = params.get(names.fact) ?? "";

  let bbox: Record<string, unknown> | null = null;
  const bboxRaw = params.get(names.bbox);
  if (bboxRaw) {
    try {
      const parsedBbox: unknown = JSON.parse(bboxRaw);
      if (parsedBbox && typeof parsedBbox === "object") {
        bbox = parsedBbox as Record<string, unknown>;
      }
    } catch {
      // Bbox in URL is optional and best-effort — silently ignore malformed JSON.
    }
  }

  const payload: RefClickPayload = {
    file_id: file,
    doc_id: params.get(names.doc),
    page,
    bbox,
    sources: bbox && page != null ? [{ file_id: file, page_number: page, bbox }] : undefined,
    extraction_id: params.get(names.extraction),
    variable: params.get(names.variable),
  };
  return { canonicalKey, payload };
}

/**
 * Translate URL query params (`?file=...&page=...&fact=...`) into a
 * {@link ReferenceFocusProvider} focus. Mount inside a provider; the
 * hook publishes focus as the params change so siblings — typically a
 * {@link ReferenceViewerPanel} or a host-built viewer subscribed to
 * `useReferenceFocus` — react.
 *
 * Router-agnostic: pass whatever `URLSearchParams`-shaped object your
 * router exposes (react-router-dom's `useSearchParams()[0]`, Next.js's
 * `useSearchParams()`, the standard `new URL(...).searchParams`, etc).
 */
export function useReferenceFocusFromSearchParams(
  searchParams: SearchParamsLike | null | undefined,
  options: UseReferenceFocusFromSearchParamsOptions = {},
): void {
  const ctx = useReferenceFocus();
  const { paramNames, onApplied, defaultPage = 1 } = options;

  // Read snapshots of every param the hook cares about so the effect
  // dependency list is granular and re-fires when any of them changes.
  const file = searchParams?.get((paramNames?.file ?? DEFAULT_NAMES.file)) ?? null;
  const page = searchParams?.get((paramNames?.page ?? DEFAULT_NAMES.page)) ?? null;
  const fact = searchParams?.get((paramNames?.fact ?? DEFAULT_NAMES.fact)) ?? null;
  const bbox = searchParams?.get((paramNames?.bbox ?? DEFAULT_NAMES.bbox)) ?? null;
  const doc = searchParams?.get((paramNames?.doc ?? DEFAULT_NAMES.doc)) ?? null;
  const extraction = searchParams?.get((paramNames?.extraction ?? DEFAULT_NAMES.extraction)) ?? null;
  const variable = searchParams?.get((paramNames?.variable ?? DEFAULT_NAMES.variable)) ?? null;

  useEffect(() => {
    if (!ctx || !searchParams || !file) return;
    const parsed = payloadFromSearchParams(searchParams, paramNames, defaultPage);
    if (!parsed) return;
    ctx.setFocus(parsed.canonicalKey, parsed.payload);
    onApplied?.(parsed.canonicalKey);
    // ctx is intentionally NOT in the deps; setFocus is stable enough
    // and including it would re-fire on every focus update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, page, fact, bbox, doc, extraction, variable]);
}
