import { useMemo } from "react";
import type { components } from "@fenero-ai/lux-core";
import { useScenarioContext, useCaseScenarioContext } from "./ScenarioProvider.js";
import { KNOWN_AGENCIES } from "./ScenarioResults.js";
import {
  canonicalProductId,
  resolveAgency,
  PRODUCT_ID_TO_AGENCY,
} from "./resolveAgency.js";

type SpecResultResponse = components["schemas"]["SpecResultResponse"];
type ProductSpecGroup = components["schemas"]["ProductSpecGroup"];
type SpecSummaryResultResponse = components["schemas"]["SpecSummaryResultResponse"];

export { PRODUCT_ID_TO_AGENCY };

/**
 * Group spec results by agency derived from `spec_name` prefix (`fnma_*` → `fnma`).
 * Used as a fallback when Veritas omits `product_specs` from the comparison row.
 */
function resultsForAgencyByPrefix(
  results: SpecResultResponse[],
  agency: string,
): SpecResultResponse[] {
  const prefix = `${agency}_`;
  return results.filter((r) => r.spec_name != null && r.spec_name.startsWith(prefix));
}

export interface UseScenarioProductIncomeResult {
  /** Canonical product id after aliasing (e.g. `bank_statement` → `non_qm_bank_statement`). */
  productId: string | null;
  /** Resolved agency slug (`fnma`, `fhlmc`, …) — useful for report sheet defaults. */
  agency: string | null;
  /** Matching `ProductSpecGroup` from `scenario.product_specs`, or `null` if not found. */
  productSpec: ProductSpecGroup | null;
  /** SpecResultResponse rows whose `spec_name` is listed in `productSpec.spec_names`. */
  results: SpecResultResponse[];
  /** True when at least one matching spec result exists. */
  hasResult: boolean;
  /** `productSpec.total_monthly` (Veritas-computed) when available. */
  totalMonthly: number | null;
  /** Headline summary (max_value across buckets) for the whole scenario. */
  summary: SpecSummaryResultResponse | null;
  /** True while `CaseScenarioProvider` is still loading the comparison list. */
  isLoading: boolean;
  /**
   * True once the case scenarios query has settled (loaded or errored). Hosts
   * use this to differentiate "still fetching" vs "loaded — definitely no result".
   */
  isFetched: boolean;
}

/**
 * Derives per-product income state from the {@link CaseScenarioProvider}
 * comparison list. All data flows from Veritas (`/api/cases/{id}/scenarios`)
 * via the Lux client — no Gunnr legacy `/income` endpoint is touched.
 *
 * Match order (first hit wins):
 *   1. `product_specs[].product_id === canonical(productId)`
 *   2. `product_specs[].product_id === productId` (raw form, in case alias is reverse)
 *   3. `product_specs[].agency === agency-for(productId)` — covers cases where
 *      Veritas stored a different product_id variant (e.g. `fnma_selling_guide`)
 *      than the host route slug (e.g. `fannie_mae`).
 *   4. **Prefix fallback**: when `product_specs` is empty (older Veritas runs
 *      that didn't populate the group), filter `scenario.results` directly by
 *      `spec_name.startsWith("<agency>_")`. This keeps the QM workbook tab
 *      working even before the backend backfill lands.
 *
 * Returns `hasResult=false` when:
 * - scenarios are still loading (`isFetched=false`), OR
 * - no `ProductSpecGroup` matched and no prefix-derived results were found.
 */
export function useScenarioProductIncome(
  productId: string | null | undefined,
): UseScenarioProductIncomeResult {
  const { scenarioId } = useScenarioContext();
  const { scenarios, isLoading } = useCaseScenarioContext();

  return useMemo<UseScenarioProductIncomeResult>(() => {
    const canonical = canonicalProductId(productId);
    const scenarioRow = scenarios.find((s) => s.scenario_id === scenarioId) ?? null;
    const isFetched = scenarios.length > 0 || !isLoading;

    if (!canonical || !scenarioRow) {
      return {
        productId: canonical,
        agency: resolveAgency(productId),
        productSpec: null,
        results: [],
        hasResult: false,
        totalMonthly: null,
        summary: scenarioRow?.summary_result ?? null,
        isLoading,
        isFetched,
      };
    }

    const productSpecs: ProductSpecGroup[] = scenarioRow.product_specs ?? [];
    const agency = resolveAgency(productId, productSpecs);
    const productSpec =
      productSpecs.find((p) => p.product_id === canonical) ??
      productSpecs.find((p) => p.product_id === productId) ??
      (agency ? productSpecs.find((p) => p.agency === agency) : undefined) ??
      null;

    const allResults: SpecResultResponse[] = scenarioRow.results ?? [];
    const specNameSet = new Set(productSpec?.spec_names ?? []);
    let results: SpecResultResponse[] = [];

    if (specNameSet.size > 0) {
      results = allResults.filter(
        (r) => r.spec_name != null && specNameSet.has(r.spec_name),
      );
    } else if (agency && KNOWN_AGENCIES.includes(agency)) {
      // Veritas omitted product_specs — derive from spec_name prefix so the
      // QM workbook still renders. Same convention ScenarioResults uses.
      results = resultsForAgencyByPrefix(allResults, agency);
    }

    return {
      productId: canonical,
      agency: productSpec?.agency ?? agency,
      productSpec,
      results,
      hasResult: results.length > 0,
      totalMonthly: productSpec?.total_monthly ?? null,
      summary: scenarioRow.summary_result ?? null,
      isLoading,
      isFetched,
    };
  }, [productId, scenarioId, scenarios, isLoading]);
}
