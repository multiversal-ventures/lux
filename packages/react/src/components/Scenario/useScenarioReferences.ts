import { useMemo } from "react";
import type { components } from "@fenero/lux-core";
import { useScenarioContext } from "./ScenarioProvider.js";
import { resolveAgency } from "./resolveAgency.js";

type DocumentInfo = components["schemas"]["DocumentInfo"];
type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];

/**
 * Page + bbox provenance carried alongside an extraction. Mirrors the
 * Veritas `ExtractionSourceRef` audit schema (local copy because the
 * OpenAPI regen lags the backend addition of `input_values`).
 */
export interface ExtractionSourceRef {
  file_id?: string | null;
  page_number?: number | null;
  bbox?: Record<string, unknown> | null;
  ocr_text_snippet?: string | null;
}

export interface InputProvenance {
  extraction_id: string;
  doc_id: string;
  doc_type?: string | null;
  canonical_key: string;
  value?: unknown;
  raw_value?: unknown;
  sources?: ExtractionSourceRef[];
}

export interface InputValueRow {
  name: string;
  value?: unknown;
  source_line?: string | null;
  document_type?: string | null;
  provenance?: InputProvenance[];
}

/** Audit step shape with the new (post-provenance) `input_values` array. */
export type AuditStepWithProvenance = SpecAuditResponse["steps"][number] & {
  input_values?: InputValueRow[];
};

/** Payload emitted when a reference is "opened" by the user. */
export interface RefClickPayload {
  file_id?: string | null;
  doc_id?: string | null;
  page?: number | null;
  bbox?: Record<string, unknown> | null;
  /** All extraction sources for this reference (>=1 page/bbox each). */
  sources?: ExtractionSourceRef[];
  extraction_id?: string | null;
  /** Spec input variable name that consumed this extraction (e.g. `wages_y1`). */
  variable?: string | null;
}

/** Aggregated reference row, deduped by `(canonical_key, doc_id)` across specs. */
export interface ScenarioReferenceRow {
  /** Stable React key — `canonical_key::doc_id`. */
  rowKey: string;
  /** Field portion of canonical key (`taxable_interest_amount` of `1040.taxable_interest_amount`). */
  field: string;
  /** Document type (`IRS1040`, `IRSW2`, …) — derived from canonical key prefix when missing. */
  docType: string;
  canonicalKey: string;
  docId: string;
  extractionId: string;
  /** Spec-local input variable names that consumed this extraction (e.g. `wages_y1`). */
  variables: string[];
  /** Normalized value the engine actually saw. */
  value: unknown;
  /** Pre-normalization value as stored in the extraction (often a string). */
  rawValue: unknown;
  sources: ExtractionSourceRef[];
  /** Spec names whose audit steps cited this extraction. */
  specs: string[];
  /**
   * `true` when the row was reconstructed from the refinement document list
   * because no audit input_values were available — used to render a muted
   * style / banner in default UIs.
   */
  derived?: boolean;
}

export interface UseScenarioReferencesResult {
  /** Resolved agency slug (`fnma`, `fhlmc`, …) for the active product, or `null`. */
  agency: string | null;
  /** Spec audit rows filtered to the active product's agency prefix. */
  filteredAudit: SpecAuditResponse[];
  /** All reference rows. Sorted by `(docType, field)` for stable rendering. */
  rows: ScenarioReferenceRow[];
  /** Sum of `input_values.length` across all filtered audit steps. */
  totalInputValues: number;
  /** Sum of `provenance.length` across all input_values seen. */
  totalProvenanceEntries: number;
  /** Rows came from refinement docs, not audit provenance. */
  derivedFromDocs: boolean;
  /** Diagnostic message for default empty states. */
  emptyMessage: string | null;
}

/**
 * Convert a {@link ScenarioReferenceRow} (and optionally a specific source
 * to anchor at) into a {@link RefClickPayload}. Hosts use this when wiring
 * their own click handlers without re-reading the row structure.
 */
export function payloadFromRow(
  row: ScenarioReferenceRow,
  source?: ExtractionSourceRef | null,
): RefClickPayload {
  const src = source ?? row.sources[0] ?? null;
  return {
    file_id: src?.file_id ?? null,
    doc_id: row.docId,
    page: src?.page_number ?? null,
    bbox: src?.bbox ?? null,
    sources: row.sources,
    extraction_id: row.extractionId,
    variable: row.variables[0] ?? null,
  };
}

/**
 * Pure data hook: derive deduped reference rows from the
 * {@link ScenarioProvider} audit. Returns the same shape regardless of
 * which UI consumes it, so the table + detail + viewer all share one
 * source of truth.
 *
 * The hook is policy-neutral: it does not call `setFocus()` on
 * {@link ReferenceFocusProvider} — that wiring belongs to the consuming
 * component(s).
 */
export function useScenarioReferences(): UseScenarioReferencesResult {
  const { scenario, audit, activeProductId, refinements } = useScenarioContext();
  const agency = useMemo(
    () => resolveAgency(activeProductId, scenario.rendering_hints?.product_specs ?? null),
    [activeProductId, scenario.rendering_hints?.product_specs],
  );

  const filteredAudit = useMemo(
    () => (agency ? audit.filter((a) => a.spec_name?.startsWith(agency + "_")) : []),
    [agency, audit],
  );

  return useMemo<UseScenarioReferencesResult>(() => {
    const collected = new Map<string, ScenarioReferenceRow>();
    let totalInputValues = 0;
    let totalProvenanceEntries = 0;

    for (const spec of filteredAudit) {
      const steps = (spec.steps ?? []) as AuditStepWithProvenance[];
      for (const step of steps) {
        const inputValues = step.input_values ?? [];
        totalInputValues += inputValues.length;
        for (const iv of inputValues) {
          const provenance = iv.provenance ?? [];
          for (const p of provenance) {
            totalProvenanceEntries += 1;
            const rowKey = `${p.canonical_key}::${p.doc_id}`;
            const existing = collected.get(rowKey);
            if (existing) {
              if (!existing.variables.includes(iv.name)) existing.variables.push(iv.name);
              if (spec.spec_name && !existing.specs.includes(spec.spec_name)) {
                existing.specs.push(spec.spec_name);
              }
              continue;
            }
            const dot = p.canonical_key.indexOf(".");
            const field = dot >= 0 ? p.canonical_key.slice(dot + 1) : p.canonical_key;
            const docType = p.doc_type ?? (dot >= 0 ? p.canonical_key.slice(0, dot) : "");
            collected.set(rowKey, {
              rowKey,
              field,
              docType,
              canonicalKey: p.canonical_key,
              docId: p.doc_id,
              extractionId: p.extraction_id,
              variables: [iv.name],
              value: p.value ?? iv.value,
              rawValue: p.raw_value ?? p.value,
              sources: p.sources ?? [],
              specs: spec.spec_name ? [spec.spec_name] : [],
            });
          }
        }
      }
    }

    let derivedFromDocs = false;
    if (collected.size === 0 && refinements && refinements.length > 0) {
      const latest = refinements[refinements.length - 1];
      const docs: DocumentInfo[] = latest?.documents ?? [];
      for (const d of docs) {
        const id = d.id;
        if (!id) continue;
        const rowKey = `doc::${id}`;
        if (collected.has(rowKey)) continue;
        const docType = d.doc_type ?? "document";
        const filename = d.filename ?? id.slice(0, 8);
        collected.set(rowKey, {
          rowKey,
          field: filename,
          docType,
          canonicalKey: docType,
          docId: id,
          extractionId: "",
          variables: [],
          value: null,
          rawValue: null,
          sources: [],
          specs: [],
          derived: true,
        });
      }
      derivedFromDocs = collected.size > 0;
    }

    const rows = Array.from(collected.values()).sort((a, b) => {
      if (a.docType !== b.docType) return a.docType.localeCompare(b.docType);
      return a.field.localeCompare(b.field);
    });

    let emptyMessage: string | null = null;
    if (rows.length === 0) {
      if (audit.length === 0) {
        emptyMessage = "Calculation audit is still loading or unavailable.";
      } else if (filteredAudit.length === 0) {
        emptyMessage = `No audit rows for ${agency ?? "this product"}.`;
      } else if (totalInputValues === 0) {
        emptyMessage =
          "No input provenance recorded yet — re-qualify the scenario to populate references.";
      } else if (totalProvenanceEntries === 0) {
        emptyMessage =
          "Inputs are recorded but no extraction provenance is attached — the spec runner needs to be re-run with the provenance pipeline.";
      } else {
        emptyMessage = "No references for this product.";
      }
    }

    return {
      agency,
      filteredAudit,
      rows,
      totalInputValues,
      totalProvenanceEntries,
      derivedFromDocs,
      emptyMessage,
    };
  }, [agency, audit.length, filteredAudit, refinements]);
}
