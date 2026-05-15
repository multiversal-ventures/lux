import type { components } from "@fenero-ai/lux-core";
import { KNOWN_AGENCIES } from "./ScenarioResults.js";

type ProductSpecGroup = components["schemas"]["ProductSpecGroup"];

/**
 * Host-friendly route slug → Veritas internal product_id.
 * Single source of truth for both income state and audit filtering.
 */
export const PRODUCT_ID_ALIASES: Record<string, string> = {
  bank_statement: "non_qm_bank_statement",
};

/**
 * Route slug / product_id → agency slug. Used as a robust fallback when
 * Veritas's `product_specs[].product_id` doesn't exactly equal the route param
 * (e.g. route uses `fannie_mae` but Veritas stored `fnma_selling_guide`).
 */
export const PRODUCT_ID_TO_AGENCY: Record<string, string> = {
  fannie_mae: "fnma",
  fnma_selling_guide: "fnma",
  freddie_mac: "fhlmc",
  fhlmc_selling_guide: "fhlmc",
  fha: "fha",
  fha_handbook: "fha",
  va: "va",
  va_handbook: "va",
  usda: "usda",
  usda_handbook: "usda",
  non_qm_bank_statement: "non_qm",
  bank_statement: "non_qm",
};

export function canonicalProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return PRODUCT_ID_ALIASES[productId] ?? productId;
}

/**
 * Resolve the agency slug for a product_id using (in order):
 *   1. The matching ProductSpecGroup's `agency` field, if `product_specs` has it.
 *   2. A static map (`PRODUCT_ID_TO_AGENCY`) covering common variants.
 *   3. The `KNOWN_AGENCIES` list when the productId already IS an agency slug.
 *
 * Returns `null` for slugs we can't classify (e.g. one-off custom products).
 */
export function resolveAgency(
  productId: string | null | undefined,
  productSpecs?: ProductSpecGroup[] | null,
): string | null {
  if (!productId) return null;

  const canonical = canonicalProductId(productId);

  if (productSpecs && productSpecs.length > 0) {
    const hit =
      productSpecs.find((p) => p.product_id === canonical) ??
      productSpecs.find((p) => p.product_id === productId);
    if (hit?.agency) return hit.agency;
  }

  if (PRODUCT_ID_TO_AGENCY[productId]) return PRODUCT_ID_TO_AGENCY[productId]!;
  if (canonical && PRODUCT_ID_TO_AGENCY[canonical]) {
    return PRODUCT_ID_TO_AGENCY[canonical]!;
  }

  if (productId && KNOWN_AGENCIES.includes(productId)) return productId;
  if (canonical && KNOWN_AGENCIES.includes(canonical)) return canonical;

  return null;
}
