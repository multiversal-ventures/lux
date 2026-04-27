/**
 * Pure helpers that normalize Veritas event data into consumer-friendly
 * shapes. Keeping these in lux-core (not lux-react) means any consumer —
 * React, Vue, vanilla JS, an agent harness — gets the same result.
 */

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
