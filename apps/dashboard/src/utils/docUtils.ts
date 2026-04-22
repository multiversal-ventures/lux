/**
 * Document utilities for consistent rendering across the UI.
 * Single source of truth for document class names and effective period formatting.
 */

import type { Provenance } from "../types";

// =============================================================================
// MISMO STANDARD DOCUMENT CLASSES
// =============================================================================

/**
 * MISMO 3.4.0 Standard Document Types
 * These are the official MISMO document classifications supported by Gunnr.
 * Any classification not in this list is considered "custom" and may need cleanup.
 */
export const MISMO_STANDARD_CLASSES: Set<string> = new Set([
	// Tax Forms - Main
	"IRS1040",
	"IRS1040Schedule1",
	"IRS1040Schedule2",
	"IRS1040Schedule3",
	"IRS1040ScheduleA",
	"IRS1040ScheduleB",
	"IRS1040ScheduleC",
	"IRS1040ScheduleD",
	"IRS1040ScheduleE",
	"IRS1040ScheduleF",
	"IRS1040ScheduleSE",
	"IRS1120SScheduleK1",
	"IRS1065ScheduleK1",
	// 1099 Forms
	"IRS1099NEC",
	"IRS1099B",
	"IRS1099K",
	"IRS1099MISC",
	"IRS1099S",
	"IRS1099R",
	"IRS1099DIV",
	"IRS1099INT",
	"IRS1099G",
	// Business Tax Forms
	"IRS4506T",
	"IRS1120",
	"IRS1120S",
	"IRS1065",
	"IRS8825",
	// Income Documents
	"IRSW2",
	"PayStub",
	"ProfitLossStatement",
	"VerificationOfEmployment",
	// Banking
	"BankStatement",
	// Benefits & Non-Employment Income
	"SocialSecurityAwardLetter",
	"BenefitPlanDistributionStatement:Pension",
	"VerificationOfIncome",
	"DivorceDecree",
	"VerificationOfDependentCare",
	"TrustIncomeStatement",
	// VA / Military
	"VACertificateOfEligibility",
	"MilitaryDischarge",
	"MilitaryLeaveEarningsStatement",
	// Assets / Down Payment
	"GiftLetter",
	"VerificationOfDeposit",
	"VerificationOfMortgageOrRent",
	"RetirementAccountStatement",
	// Other
	"TaxReturn",
	"Other",
	"Unknown",
]);

/**
 * Check if a document class is MISMO standard or custom
 */
export function isMISMOStandard(docClass: string): boolean {
	return MISMO_STANDARD_CLASSES.has(docClass);
}

// =============================================================================
// DOCUMENT CLASS DISPLAY NAMES
// =============================================================================

/** Human-readable document class names for MISMO standard types */
export const DOC_CLASS_NAMES: Record<string, string> = {
	// Tax Forms - Main
	IRS1040: "Form 1040",
	IRS1040Schedule1: "Schedule 1",
	IRS1040Schedule2: "Schedule 2",
	IRS1040Schedule3: "Schedule 3",
	IRS1040ScheduleA: "Schedule A",
	IRS1040ScheduleB: "Schedule B",
	IRS1040ScheduleC: "Schedule C",
	IRS1040ScheduleD: "Schedule D",
	IRS1040ScheduleE: "Schedule E",
	IRS1040ScheduleF: "Schedule F",
	IRS1040ScheduleSE: "Schedule SE",
	IRS1120SScheduleK1: "K-1 (S-Corp)",
	IRS1065ScheduleK1: "K-1 (Partnership)",
	// 1099 Forms
	IRS1099NEC: "1099-NEC",
	IRS1099B: "1099-B",
	IRS1099K: "1099-K",
	IRS1099MISC: "1099-MISC",
	IRS1099S: "1099-S",
	IRS1099R: "1099-R",
	IRS1099DIV: "1099-DIV",
	IRS1099INT: "1099-INT",
	IRS1099G: "1099-G",
	// Business Tax Forms
	IRS4506T: "Form 4506-T",
	IRS1120: "Form 1120",
	IRS1120S: "Form 1120-S",
	IRS1065: "Form 1065",
	IRS8825: "Form 8825",
	// Income Documents
	IRSW2: "W-2",
	PayStub: "Pay Stub",
	ProfitLossStatement: "Profit & Loss",
	VerificationOfEmployment: "VOE",
	// Banking
	BankStatement: "Bank Statement",
	// Benefits
	SocialSecurityAwardLetter: "SS Award Letter",
	"BenefitPlanDistributionStatement:Pension": "Pension Statement",
	VerificationOfIncome: "Disability Letter",
	DivorceDecree: "Divorce Decree",
	VerificationOfDependentCare: "Child Support",
	TrustIncomeStatement: "Trust Income",
	// VA / Military
	VACertificateOfEligibility: "VA COE",
	MilitaryDischarge: "DD-214",
	MilitaryLeaveEarningsStatement: "Military LES",
	// Assets
	GiftLetter: "Gift Letter",
	VerificationOfDeposit: "VOD",
	VerificationOfMortgageOrRent: "VOR",
	RetirementAccountStatement: "Retirement Account",
	// Other
	TaxReturn: "Tax Document",
	Other: "Other Document",
	Unknown: "Unknown",
};

/**
 * Get human-readable document class name.
 * For custom (non-MISMO) classes, returns the raw class name as-is.
 */
export function getDocClassName(docClass: string): string {
	return DOC_CLASS_NAMES[docClass] || docClass;
}

/**
 * Get document class info including whether it's standard or custom.
 * Returns display name and isCustom flag.
 */
export function getDocClassInfo(docClass: string): { displayName: string; isCustom: boolean } {
	const isCustom = !isMISMOStandard(docClass);
	const displayName = DOC_CLASS_NAMES[docClass] || docClass;
	return { displayName, isCustom };
}

/** Get all available document classes for dropdown */
export function getAvailableDocClasses(): Array<{ value: string; label: string }> {
	return Object.entries(DOC_CLASS_NAMES)
		.filter(([key]) => key !== "Unknown")
		.map(([value, label]) => ({ value, label }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

// =============================================================================
// EFFECTIVE PERIOD
// =============================================================================

/** Format type for effective period */
export type EffectivePeriodFormat = "full" | "short" | "badge";

/** Period object from ExtractedDocument */
interface EffectivePeriodObj {
	period_start?: string;
	period_end?: string;
}

/**
 * Format effective period from an EffectivePeriod object.
 * Returns as a date range format for consistency.
 * Returns null if period is undetermined.
 */
export function formatEffectivePeriod(
	period: EffectivePeriodObj | null | undefined,
	format: EffectivePeriodFormat = "full",
): string | null {
	if (!period) return null;

	const start = period.period_start;
	const end = period.period_end;

	if (start && end) {
		switch (format) {
			case "short":
				return `${start} - ${end}`;
			case "badge":
				// Compact format: MM/DD - MM/DD
				return `${start.slice(5, 10)} - ${end.slice(5, 10)}`;
			case "full":
			default:
				return `${start} to ${end}`;
		}
	}

	if (start) {
		return format === "badge" ? `From ${start.slice(5, 10)}` : `From ${start}`;
	}

	if (end) {
		return format === "badge" ? `To ${end.slice(5, 10)}` : `To ${end}`;
	}

	return null;
}

/** Field names that may contain tax year in extracted facts (case-insensitive match) */
const TAX_YEAR_FIELD_NAMES = [
	"TaxYear",
	"tax_year",
	"taxyear",
	"Tax_Year",
	"Tax Year",
	"taxYear",
	"effective_year",
	"year",
];

/**
 * Extract a 4-digit year string from a fact value (number or string).
 */
function parseYearFromValue(value: string | number | boolean): string | null {
	if (typeof value === "number") {
		const y = Math.floor(value);
		if (y >= 1900 && y <= 2100) return String(y);
		return null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		const four = trimmed.slice(0, 4);
		if (/^\d{4}$/.test(four)) {
			const y = Number.parseInt(four, 10);
			if (y >= 1900 && y <= 2100) return four;
		}
		const match = trimmed.match(/\b(19|20)\d{2}\b/);
		if (match) return match[0];
		return null;
	}
	return null;
}

/**
 * Get tax year from an extracted document.
 * 1. Uses effective_period.period_end or period_start if present.
 * 2. Otherwise looks for a tax-year fact (e.g. TaxYear, tax_year) in doc.facts.
 * Returns string year or "Unknown".
 */
export function getYearFromDocument(doc: {
	effective_period?: { period_start?: string; period_end?: string };
	facts?: Array<{ field_name: string; value: string | number | boolean }>;
}): string {
	const period = doc.effective_period;
	if (period) {
		const end = period.period_end;
		if (end && end.length >= 4) return end.slice(0, 4);
		const start = period.period_start;
		if (start && start.length >= 4) return start.slice(0, 4);
	}

	const facts = doc.facts ?? [];
	const nameSet = new Set(TAX_YEAR_FIELD_NAMES.map((n) => n.toLowerCase()));
	let fallbackYear: string | null = null;

	for (const fact of facts) {
		const key = (fact.field_name ?? "").trim().toLowerCase();
		if (!key) continue;
		const year = parseYearFromValue(fact.value);
		if (!year) continue;
		if (nameSet.has(key)) return year;
		if (key.includes("year") && !fallbackYear) fallbackYear = year;
	}

	return fallbackYear ?? "Unknown";
}

/** Sort year keys descending (latest first), "Unknown" last. For use in UI. */
export function sortYearKeys(years: string[]): string[] {
	const known = years
		.filter((y) => y !== "Unknown")
		.map(Number)
		.sort((a, b) => b - a)
		.map(String);
	const unknown = years.filter((y) => y === "Unknown");
	return [...known, ...unknown];
}

/** Get unique sorted year keys from extracted documents (for header tabs / grouping). */
export function getYearKeysFromDocuments(
	docs: Array<{
		effective_period?: { period_start?: string; period_end?: string };
		facts?: Array<{ field_name: string; value: string | number | boolean }>;
	}>,
): string[] {
	const years = [...new Set(docs.map((d) => getYearFromDocument(d)))];
	return sortYearKeys(years);
}

/**
 * Derive ref's year from file→doc→effective_period.
 * Finds the document whose pages contain the ref's file_id + page_number,
 * then returns the year from effective_period.period_end or period_start.
 * Returns number (e.g. 2024) or null if not found.
 */
export function getRefYear(
	caseResult:
		| {
				extractions?: {
					documents?: Array<{
						file_id?: string;
						pages?: Array<{ file_id?: string; page_number?: number }>;
						effective_period?: { period_start?: string; period_end?: string };
					}>;
				};
		  }
		| undefined,
	ref: { file_id?: string; page_number?: number },
): number | null {
	if (!caseResult?.extractions?.documents || !ref.file_id) return null;
	const pageNum = ref.page_number ?? 1;
	for (const doc of caseResult.extractions.documents) {
		const hasMatchingPage = doc.pages?.some(
			(p) => p.file_id === ref.file_id && p.page_number === pageNum,
		);
		if (!hasMatchingPage) continue;
		const yearStr =
			doc.effective_period?.period_end?.slice(0, 4) ??
			doc.effective_period?.period_start?.slice(0, 4);
		if (yearStr) return Number.parseInt(yearStr, 10);
		return null;
	}
	return null;
}

/** Get available tax years for dropdown (current year and 5 years back) */
export function getAvailableTaxYears(): Array<{ value: number; label: string }> {
	const currentYear = new Date().getFullYear();
	const years: Array<{ value: number; label: string }> = [];

	for (let year = currentYear; year >= currentYear - 6; year--) {
		years.push({ value: year, label: `Tax Year ${year}` });
	}

	return years;
}

// =============================================================================
// PROVENANCE DISPLAY
// =============================================================================

/** Provenance type for display */
export type ProvenanceDisplayType = "mismo" | "extension" | "custom";

/** Get display label for provenance type */
export function getProvenanceLabel(provenance: Provenance | undefined): string {
	if (!provenance) return "CUSTOM";

	switch (provenance.type) {
		case "mismo":
			return "MISMO";
		case "extension":
			return "EXT";
		case "custom":
		default:
			return "CUSTOM";
	}
}

/** Get badge color classes for provenance type */
export function getProvenanceColor(type: ProvenanceDisplayType | undefined): string {
	switch (type) {
		case "mismo":
			return "bg-blue-100 text-blue-700";
		case "extension":
			return "bg-orange-100 text-orange-700";
		case "custom":
		default:
			return "bg-slate-100 text-slate-500";
	}
}

/** Get full badge class for provenance */
export function getProvenanceBadgeClass(provenance: Provenance | undefined): string {
	const color = getProvenanceColor(provenance?.type);
	return `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`;
}

/** Get tooltip text for provenance */
export function getProvenanceTooltip(provenance: Provenance | undefined): string {
	if (!provenance) return "Generic extraction field";

	const parts = [provenance.source];
	if (provenance.element) {
		parts.push(provenance.element);
	}
	if (provenance.version) {
		parts[0] = `${parts[0]} v${provenance.version}`;
	}

	return parts.join(" • ");
}

// =============================================================================
// PAGE RANGE FORMATTING
// =============================================================================

/** Format page range for display (e.g., "1-3, 5" or "Page 1") */
export function formatPageRange(pageNumbers: number[]): string {
	if (pageNumbers.length === 0) return "";
	if (pageNumbers.length === 1) return `Page ${pageNumbers[0]}`;

	// Detect consecutive ranges
	const ranges: string[] = [];
	let rangeStart = pageNumbers[0];
	let rangeEnd = pageNumbers[0];

	for (let i = 1; i < pageNumbers.length; i++) {
		if (pageNumbers[i] === rangeEnd + 1) {
			rangeEnd = pageNumbers[i];
		} else {
			ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
			rangeStart = pageNumbers[i];
			rangeEnd = pageNumbers[i];
		}
	}
	ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);

	return `Pages ${ranges.join(", ")}`;
}
