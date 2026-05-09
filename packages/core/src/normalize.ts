/**
 * Pure helpers that normalize Veritas event data into consumer-friendly
 * shapes. Keeping these in lux-core (not lux-react) means any consumer —
 * React, Vue, vanilla JS, an agent harness — gets the same result.
 */

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
