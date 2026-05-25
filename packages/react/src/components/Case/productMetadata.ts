/**
 * Product-metadata helpers — single source of truth for resolving a
 * loan product's display label and the "do you have the required docs?"
 * pre-flight gate.
 *
 * Both inputs come straight off ``TenantProduct`` (the wire shape of
 * ``GET /products`` — see ``useTenantProducts``). The veritas API
 * resolves ``display_label`` via the
 * ``policy/specs/display_labels.yaml::product_display_labels`` registry
 * and ``required_documents`` from each product's YAML entry, so the
 * frontend never owns either map.
 *
 * The helpers are pure on purpose — hosts can call them inside any
 * render path or memo without pulling a hook dependency, and tests
 * exercise the same surface React Query consumers do.
 */

import type { TenantProduct } from "./useTenantProducts.js";

/**
 * Minimum-shape loan product accepted by the label helpers. Hosts can
 * pass a full ``TenantProduct`` straight through; the wider type lets
 * call sites that only have a partial row (e.g. an in-progress
 * suggestion before the full catalog loads) still produce a label
 * without TypeScript pushback.
 */
export type ProductLabelSource = Pick<TenantProduct, "product_id"> &
  Partial<Pick<TenantProduct, "display_label" | "display_name">>;

/**
 * Resolve a product's human-readable label using the same precedence
 * the backend uses: curated ``display_label`` from the YAML registry
 * → ``display_name`` → ``product_id`` (last-ditch slug fallback so the
 * UI never renders an empty chip).
 */
export function getProductDisplayLabel(product: ProductLabelSource): string {
  if (product.display_label && product.display_label.length > 0) {
    return product.display_label;
  }
  if (product.display_name && product.display_name.length > 0) {
    return product.display_name;
  }
  return product.product_id;
}

/**
 * Minimum-shape product accepted by ``validateRequiredDocuments``. We
 * accept the wider full-row type by structural typing so callers can
 * pass the catalog returned from ``useTenantProducts`` directly.
 */
export type ProductRequiredDocsSource = ProductLabelSource &
  Pick<TenantProduct, "required_documents">;

export interface MissingProductDocs {
  productId: string;
  displayLabel: string;
  requiredDocuments: string[];
}

export interface ValidateRequiredDocumentsResult {
  valid: boolean;
  missing: MissingProductDocs[];
}

/**
 * "Any-of" pre-flight gate: a selected product passes when at least one
 * of its ``required_documents`` is present in the case's uploaded
 * documents. Mirrors the legacy ``validateRequiredDocuments`` semantics
 * the gunnr-app helper used to ship — but the doc-type lists now come
 * from the API instead of a hardcoded frontend map.
 *
 * Products with an empty ``required_documents`` list (the ``non_qm``
 * legacy catch-all, the consumer ``rental`` product) are silently
 * skipped — the spec's own ``activation.required_documents`` block
 * remains the authoritative runtime check.
 *
 * Selected ids that aren't in the catalog are skipped defensively
 * rather than failing closed; this keeps the UI from blocking a case
 * because of a stale product slug saved with an older scenario.
 *
 * The ``missing`` array is ordered by the catalog (``products``
 * argument) order, not the selection order, so the rendered banner is
 * stable across re-selections.
 */
export function validateRequiredDocuments(
  products: ReadonlyArray<ProductRequiredDocsSource>,
  selectedProductIds: ReadonlyArray<string>,
  documents: ReadonlyArray<{ documentType: string }>,
): ValidateRequiredDocumentsResult {
  const docTypes = new Set(documents.map((d) => d.documentType));
  const selected = new Set(selectedProductIds);
  const missing: MissingProductDocs[] = [];

  for (const product of products) {
    if (!selected.has(product.product_id)) continue;
    const required = product.required_documents ?? [];
    if (required.length === 0) continue;
    const hasAny = required.some((type) => docTypes.has(type));
    if (hasAny) continue;
    missing.push({
      productId: product.product_id,
      displayLabel: getProductDisplayLabel(product),
      requiredDocuments: [...required],
    });
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Compose the operator-facing missing-docs error banner from the
 * backend-supplied ``displayLabel`` + ``requiredDocuments`` pairs. No
 * hardcoded per-product copy — the legacy "Bank Statement income
 * requires…", "Qualified Mortgage products require…" strings are
 * deliberately retired so adding a new loan product never requires a
 * frontend edit. If a future product needs custom copy, hang a
 * ``required_documents_error_hint`` field off the YAML and surface it
 * on the response; until then the generic structure-driven message
 * carries enough information to act on.
 */
export function getMissingDocsErrorMessage(
  missing: ReadonlyArray<Pick<MissingProductDocs, "displayLabel" | "requiredDocuments">>,
): string {
  if (missing.length === 0) return "";
  const lines = missing.map((entry) => {
    const docs = entry.requiredDocuments.join(", ") || "supporting documents";
    return `• ${entry.displayLabel} needs at least one of: ${docs}`;
  });
  return [
    "Selected products are missing required documents:",
    ...lines,
    "Upload one of the listed documents per product to continue.",
  ].join("\n");
}
