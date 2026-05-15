import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type VeritasCaseDocument, type VeritasCaseFile } from "@fenero/lux-core";

/**
 * Normalized row used by every doc-picker UI in Lux + host apps.
 *
 * - `displayName` collapses `tax_year + doc_type` into the underwriter-friendly
 *   label ("2023 W-2"); host UIs can still read the raw fields below.
 * - `firstPage`/`pageCount` are derived from `page_numbers` so the UI doesn't
 *   need to know that `page_numbers: null` means "unknown".
 * - `processedAt` falls back to the file's `uploaded_at` when veritas has not
 *   yet stamped the document with an explicit processing timestamp.
 */
export interface CaseDocumentRow {
  /** Stable document id (UUID). Use as React `key`. */
  id: string;
  /** Doc-type slug (`w2`, `form_1040`, …). Null for raw uploads. */
  docType: string | null;
  /** Tax year if the document carries one, e.g. `2023`. */
  taxYear: number | null;
  /** Pre-formatted display label (`"2023 W-2"`, `"Bank Statement"`). */
  displayName: string;
  /** Source file id — useful for navigation to the viewer. */
  fileId: string;
  /** Original uploaded filename. */
  filename: string | null;
  /** Smallest page number on the document, or 1 when unknown. */
  firstPage: number;
  /** Number of pages in the document. */
  pageCount: number;
  /** ISO timestamp the document/file was last processed. */
  processedAt: string | null;
  /** Underlying veritas row, kept for advanced consumers. */
  raw: VeritasCaseDocument;
}

const DOC_TYPE_DISPLAY: Record<string, string> = {
  w2: "W-2",
  w_2: "W-2",
  form_1040: "Form 1040",
  form_1099_nec: "1099-NEC",
  form_1099_misc: "1099-MISC",
  form_1099_int: "1099-INT",
  form_1099_div: "1099-DIV",
  form_1099_r: "1099-R",
  bank_statement: "Bank Statement",
  pay_stub: "Pay Stub",
  paystub: "Pay Stub",
  schedule_c: "Schedule C",
  schedule_e: "Schedule E",
  schedule_f: "Schedule F",
  k1_1065: "K-1 (Form 1065)",
  k1_1120s: "K-1 (Form 1120S)",
  form_1120s: "Form 1120S",
  form_1065: "Form 1065",
  offer_letter: "Offer Letter",
  lease_agreement: "Lease Agreement",
  social_security_award: "Social Security Award",
  pension_award: "Pension Award",
  disability_award: "Disability Award",
  military_les: "Military LES",
  voe: "VOE",
  vooe: "VOOE",
};

function humanizeDocType(docType: string | null): string {
  if (!docType) return "Document";
  const lower = docType.toLowerCase();
  return DOC_TYPE_DISPLAY[lower] ?? docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveTaxYear(doc: VeritasCaseDocument): number | null {
  if (doc.tax_year != null) return doc.tax_year;
  if (doc.effective_period_end) {
    const parsed = new Date(doc.effective_period_end);
    if (!Number.isNaN(parsed.getTime())) return parsed.getUTCFullYear();
  }
  return null;
}

function deriveFirstPage(pageNumbers: number[] | null | undefined): number {
  if (!pageNumbers || pageNumbers.length === 0) return 1;
  return Math.min(...pageNumbers);
}

export function normalizeCaseDocument(
  doc: VeritasCaseDocument,
  fileById?: Map<string, VeritasCaseFile>,
): CaseDocumentRow {
  const taxYear = deriveTaxYear(doc);
  const typeLabel = humanizeDocType(doc.doc_type);
  const file = fileById?.get(doc.file_id);
  return {
    id: doc.doc_id,
    docType: doc.doc_type ?? null,
    taxYear,
    displayName: taxYear != null ? `${taxYear} ${typeLabel}` : typeLabel,
    fileId: doc.file_id,
    filename: doc.original_filename ?? file?.original_filename ?? null,
    firstPage: deriveFirstPage(doc.page_numbers),
    pageCount: doc.page_numbers?.length ?? 0,
    processedAt: file?.uploaded_at ?? null,
    raw: doc,
  };
}

export const caseDocumentsQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "documents"] as const;

export const caseFilesQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "files"] as const;

export interface UseCaseDocumentsResult {
  rows: CaseDocumentRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Raw Veritas documents query (advanced). */
  documentsQuery: UseQueryResult<VeritasCaseDocument[], Error>;
  /** Raw Veritas files query (advanced). */
  filesQuery: UseQueryResult<VeritasCaseFile[], Error>;
}

/**
 * Fetch documents AND files for a case, then zip them into normalized rows.
 *
 * Two queries instead of one because the files endpoint is the source of
 * truth for `uploaded_at` / `original_filename`, and reusing the same
 * cache key as `useCaseFiles` lets the dropzone share data with this hook
 * after a successful upload.
 */
export function useCaseDocuments(caseId: string | null): UseCaseDocumentsResult {
  const documentsQuery = useQuery({
    queryKey: caseDocumentsQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseDocuments(caseId as string),
    enabled: !!caseId,
    staleTime: 30_000,
  });

  const filesQuery = useQuery({
    queryKey: caseFilesQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseFiles(caseId as string),
    enabled: !!caseId,
    staleTime: 30_000,
  });

  const rows = useMemo<CaseDocumentRow[]>(() => {
    const docs = documentsQuery.data ?? [];
    const files = filesQuery.data ?? [];
    const fileById = new Map(files.map((f) => [f.file_id, f]));
    const normalized = docs.map((d) => normalizeCaseDocument(d, fileById));
    normalized.sort((a, b) => {
      if (a.processedAt && b.processedAt) return b.processedAt.localeCompare(a.processedAt);
      if (a.processedAt) return -1;
      if (b.processedAt) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return normalized;
  }, [documentsQuery.data, filesQuery.data]);

  return {
    rows,
    isLoading: documentsQuery.isLoading || filesQuery.isLoading,
    isError: documentsQuery.isError || filesQuery.isError,
    error: (documentsQuery.error as Error | null) ?? (filesQuery.error as Error | null),
    documentsQuery,
    filesQuery,
  };
}
