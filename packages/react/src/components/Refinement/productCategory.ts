/**
 * Product-category derivation — the cornerstone of refinement-form
 * composability.
 *
 * Different loan-product families take different parameter overrides:
 *
 *   * `qm`             — Tax Year overrides (Y1, Y2 dropdowns)
 *   * `bank_statement` — Statement Period (months) + optional expense factor
 *   * `1099`           — Number of years (1 or 2)
 *   * `dscr`           — (reserved; today renders the QM controls)
 *
 * Consumers call `useProductCategory()` and the matching tab/picker
 * subcomponents pick themselves up. Adding a new category later means
 * extending `ProductCategory`, the detection function, and registering a
 * picker — nothing else needs to know.
 */

export type ProductCategory = "qm" | "bank_statement" | "1099" | "dscr";

const NON_QM_APPROACHES = new Set(["non_qualified_mortgage", "non_qm"]);

/**
 * Decide which input set a refinement form should render, given the
 * scenario's approach + the manifest's loan_product_ids. Pure function so
 * it can be reused in tests, summary pages, and elsewhere — not React-
 * bound.
 *
 * Detection rules (in order):
 *
 *   1. `approach === "dscr"` → `dscr`
 *   2. `approach` is a Non-QM variant AND any product id contains "1099" → `1099`
 *   3. `approach` is a Non-QM variant AND any product id contains "bank_statement" → `bank_statement`
 *   4. `approach` is a Non-QM variant → `1099` (default Non-QM bucket; matches
 *      gunnr's legacy fallback)
 *   5. otherwise → `qm`
 */
export function resolveProductCategory(
  approach: string | null | undefined,
  productIds: readonly string[] | null | undefined,
): ProductCategory {
  const a = (approach ?? "").toLowerCase();
  const ids = (productIds ?? []).map((id) => id.toLowerCase());

  if (a === "dscr") return "dscr";
  if (NON_QM_APPROACHES.has(a)) {
    if (ids.some((id) => id.includes("1099"))) return "1099";
    if (ids.some((id) => id.includes("bank_statement"))) return "bank_statement";
    return "1099";
  }
  return "qm";
}

/**
 * Hook variant for components that already have approach + productIds in
 * props (most pickers). Kept tiny on purpose — the heavy lifting is in
 * `resolveProductCategory`.
 */
export function useProductCategory(
  approach: string | null | undefined,
  productIds: readonly string[] | null | undefined,
): ProductCategory {
  return resolveProductCategory(approach, productIds);
}
