/**
 * Pure helpers that normalize Veritas event data into consumer-friendly
 * shapes. Keeping these in lux-core (not lux-react) means any consumer —
 * React, Vue, vanilla JS, an agent harness — gets the same result.
 */
/**
 * Product IDs that indicate a Non-QM bank statement scenario.
 * Mirrors the detection set from the AEU worker:
 *   bank_statement_products = {"bank_statement", "non_qm", "non_qm_bank_statement"}
 */
export declare const NON_QM_BANK_STATEMENT_PRODUCT_IDS: Set<string>;
/**
 * Returns true if any product ID in the array indicates a Non-QM
 * bank statement scenario. Use when `approach` may be null (e.g. CLI runs).
 */
export declare function isNonQmBankStatementByProducts(productIds: string[]): boolean;
/**
 * Normalize a string array that may have been serialized as a Python list.
 *
 * Veritas can return product_ids as `["['fannie_mae', 'fha']"]` (a JSON
 * array containing one Python-list string) instead of `["fannie_mae", "fha"]`.
 * This unwraps that encoding transparently.
 */
export declare function parseStringArray(value: string[] | null | undefined): string[];
export interface QualifyResult {
    product: string;
    specs_run: number;
    total_monthly: number;
}
export interface NormalizedQualifyResult {
    primary: QualifyResult | null;
    all: QualifyResult[];
}
/**
 * Normalize Veritas entity lifecycle status values to standard UI states.
 * Veritas uses "active" for scenarios/refinements that have completed a run.
 */
export declare function normalizeVeritasStatus(raw: string | null | undefined): string;
/** Refinement with all ID arrays guaranteed to be string[], never null/encoded. */
export interface NormalizedRefinement {
    refinement_id: string;
    scenario_id: string;
    refinement_num: number | null;
    borrower_ids: string[];
    document_ids: string[];
    product_ids: string[];
    spec_ids: string[];
    note: string | null;
    identities: import("./generated.js").components["schemas"]["IdentityInfo"][];
}
/**
 * Normalize a raw RefinementResponse from the Veritas API.
 * Applies parseStringArray to all ID arrays (handles Python-list encoded strings)
 * and ensures nulls become empty arrays.
 */
export declare function normalizeRefinement(r: {
    refinement_id: string;
    scenario_id: string;
    refinement_num?: number | null;
    borrower_ids?: string[] | null;
    document_ids?: string[] | null;
    product_ids?: string[] | null;
    spec_ids?: string[] | null;
    note?: string | null;
    identities?: import("./generated.js").components["schemas"]["IdentityInfo"][] | null;
}): NormalizedRefinement;
/**
 * Parse a qualify.completed event's products[] into { primary, all }.
 *
 * Selection priority for primary:
 *   1. product === "custom" (custom-spec runs always win — these are
 *      what the user explicitly asked to run, regardless of other
 *      products that may have run in parallel)
 *   2. First product with total_monthly > 0
 *   3. First product in the list
 *   4. null if products[] is empty or missing
 *
 * Design: custom-first selection fixes the class of bug where a
 * "Personal Loan · Bank Statement Income" run shows "FANNIE MAE · $0"
 * because some mortgage product was evaluated alongside the custom
 * spec. The hook layer (useQualification) consumes .primary directly.
 */
export declare function normalizeQualifyResult(eventData: Record<string, unknown> | null | undefined): NormalizedQualifyResult;
//# sourceMappingURL=normalize.d.ts.map