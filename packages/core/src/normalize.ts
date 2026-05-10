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
export const NON_QM_BANK_STATEMENT_PRODUCT_IDS = new Set([
	"bank_statement",
	"non_qm",
	"non_qm_bank_statement",
]);

/**
 * Returns true if any product ID in the array indicates a Non-QM
 * bank statement scenario. Use when `approach` may be null (e.g. CLI runs).
 */
export function isNonQmBankStatementByProducts(productIds: string[]): boolean {
	return productIds.some((id) => NON_QM_BANK_STATEMENT_PRODUCT_IDS.has(id));
}

function parsePythonList(s: string): string[] {
	const trimmed = s.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
	const inner = trimmed.slice(1, -1);
	const matches =
		Array.from(inner.matchAll(/'([^']*)'/g), (m) => m[1]) ??
		Array.from(inner.matchAll(/"([^"]*)"/g), (m) => m[1]);
	return matches.length > 0 ? matches : [];
}

/**
 * Normalize a string array that may have been serialized as a Python list.
 *
 * Veritas can return product_ids as `["['fannie_mae', 'fha']"]` (a JSON
 * array containing one Python-list string) instead of `["fannie_mae", "fha"]`.
 * This unwraps that encoding transparently.
 */
export function parseStringArray(value: string[] | null | undefined): string[] {
	if (value == null) return [];
	if (
		value.length === 1 &&
		typeof value[0] === "string" &&
		value[0].trimStart().startsWith("[")
	) {
		const parsed = parsePythonList(value[0]);
		if (parsed.length > 0) return parsed;
	}
	return value;
}

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
export function normalizeVeritasStatus(raw: string | null | undefined): string {
	if (!raw) return "unknown";
	return raw === "active" ? "completed" : raw;
}

// ─── Refinement normalization ─────────────────────────────────────────────────

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
export function normalizeRefinement(r: {
	refinement_id: string;
	scenario_id: string;
	refinement_num?: number | null;
	borrower_ids?: string[] | null;
	document_ids?: string[] | null;
	product_ids?: string[] | null;
	spec_ids?: string[] | null;
	note?: string | null;
	identities?: import("./generated.js").components["schemas"]["IdentityInfo"][] | null;
}): NormalizedRefinement {
	return {
		refinement_id: r.refinement_id,
		scenario_id: r.scenario_id,
		refinement_num: r.refinement_num ?? null,
		borrower_ids: parseStringArray(r.borrower_ids),
		document_ids: parseStringArray(r.document_ids),
		product_ids: parseStringArray(r.product_ids),
		spec_ids: parseStringArray(r.spec_ids),
		note: r.note ?? null,
		identities: r.identities ?? [],
	};
}

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
export function normalizeQualifyResult(
	eventData: Record<string, unknown> | null | undefined,
): NormalizedQualifyResult {
	const all = (eventData?.products as QualifyResult[] | undefined) ?? [];
	if (!Array.isArray(all) || all.length === 0) {
		return { primary: null, all: [] };
	}

	const custom = all.find((p) => p?.product === "custom");
	if (custom) return { primary: custom, all };

	const withMonthly = all.find((p) => (p?.total_monthly ?? 0) > 0);
	if (withMonthly) return { primary: withMonthly, all };

	return { primary: all[0] ?? null, all };
}
