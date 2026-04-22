/**
 * Pure helpers and constants for PartiesView (no React).
 */

import type { Party } from "../../../types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Authority ranking for picking top source document type */
export const DOC_AUTHORITY: Record<string, number> = {
	IRS1040: 10,
	IRSW2: 9,
	IRS1065: 8,
	IRS1120: 8,
	IRS1120S: 8,
	IRS1065ScheduleK1: 7,
	IRSScheduleK1Form1065: 7,
	IRS1120SScheduleK1: 7,
	IRSScheduleK1Form1120S: 7,
	IRS1040ScheduleC: 6,
	IRS1040ScheduleE: 6,
	IRS1040ScheduleSE: 6,
	IRS1099NEC: 5,
	IRS1099MISC: 5,
	PayStub: 4,
	VerificationOfEmployment: 4,
	BankStatement: 3,
};

// -----------------------------------------------------------------------------
// Identifier / value extraction
// -----------------------------------------------------------------------------

/** Extract the actual string value from an identifier (handles objects, arrays, strings) */
export function extractIdentifierValue(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return null;
		return extractIdentifierValue(value[0]);
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		for (const prop of ["value", "id", "identifier", "ssn", "ein", "number"]) {
			if (obj[prop] !== undefined) {
				return extractIdentifierValue(obj[prop]);
			}
		}
		const keys = Object.keys(obj);
		if (keys.length === 1) {
			return extractIdentifierValue(obj[keys[0]]);
		}
	}
	return null;
}

/** Extract last 4 digits from any identifier (SSN, EIN, etc.) */
export function extractLast4Digits(value: unknown): string | null {
	const strValue = extractIdentifierValue(value);
	if (!strValue) return null;
	const digits = strValue.replace(/[^\d]/g, "");
	return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Extract string value from potentially complex field (handles {value, source_refs} structure) */
export function extractStringValue(field: unknown): string {
	if (field === null || field === undefined) return "";
	if (typeof field === "string") return field;
	if (typeof field === "number") return String(field);
	if (typeof field === "object") {
		const obj = field as Record<string, unknown>;
		if ("value" in obj) return extractStringValue(obj.value);
		if ("name" in obj) return extractStringValue(obj.name);
	}
	return String(field);
}

/** Format identifier for display (mask SSN-like values) */
export function formatIdentifier(key: string, value: unknown): string {
	const strValue = extractIdentifierValue(value);
	if (!strValue) return "N/A";
	const keyLower = key.toLowerCase();
	if (keyLower.includes("ssn") || keyLower === "social_security") {
		if (strValue.includes("X") || strValue.includes("*")) return strValue;
		const digits = strValue.replace(/[^\d]/g, "");
		if (digits.length === 9) {
			return `***-**-${digits.slice(-4)}`;
		}
		return strValue;
	}
	return strValue;
}

// -----------------------------------------------------------------------------
// Party / document display
// -----------------------------------------------------------------------------

/** Format party name for display */
export function formatPartyName(name: unknown): string {
	return extractStringValue(name) || "Unknown";
}

/** Get document type display name */
export function getDocTypeDisplay(docType: string): string {
	const mapping: Record<string, string> = {
		IRSW2: "W-2",
		IRS1040: "1040",
		PayStub: "Pay Stub",
		VerificationOfEmployment: "VOE",
		IRS1065: "Form 1065",
		IRSScheduleK1Form1065: "K-1 (1065)",
		IRS1120S: "Form 1120S",
		IRSScheduleK1Form1120S: "K-1 (1120S)",
		IRS1120: "Form 1120",
		IRS1040ScheduleC: "Schedule C",
		IRS1040ScheduleE: "Schedule E",
	};
	return mapping[docType] ?? docType;
}

/** Get the single best source ref for a party (highest authority doc type) */
export function getTopSourceRef(
	party: Party,
): { docType: string; file_id?: string; page?: number } | null {
	if (!party.source_refs || party.source_refs.length === 0) return null;
	let best: { docType: string; file_id?: string; page?: number } | null = null;
	let bestAuth = -1;
	for (const ref of party.source_refs) {
		const dt = ref.document_type ?? "Unknown";
		const auth = DOC_AUTHORITY[dt] ?? 1;
		if (auth > bestAuth) {
			bestAuth = auth;
			best = { docType: dt, file_id: ref.file_id, page: ref.page_number };
		}
	}
	return best;
}

// -----------------------------------------------------------------------------
// Classification helpers
// -----------------------------------------------------------------------------

/** Check if a name looks like an organization/business (not a person) */
export function isOrganizationName(name: string): boolean {
	const upperName = name.toUpperCase();
	const orgPatterns = [
		/\b(LLC|INC|CORP|LTD|LP|LLP|PC|PLLC|CO|COMPANY)\b/,
		/\b(UNIVERSITY|COLLEGE|SCHOOL|INSTITUTE|ACADEMY)\b/,
		/\b(HOSPITAL|CLINIC|MEDICAL|HEALTH)\b/,
		/\b(BANK|CREDIT UNION|FINANCIAL)\b/,
		/\b(SENATE|CONGRESS|GOVERNMENT|FEDERAL|STATE|COUNTY|CITY)\b/,
		/\b(FOUNDATION|ASSOCIATION|ORGANIZATION|SOCIETY)\b/,
		/\b(PARTNERS|PARTNERSHIP|VENTURES|HOLDINGS|GROUP)\b/,
		/\b(SERVICES|SOLUTIONS|SYSTEMS|TECHNOLOGIES)\b/,
	];
	return orgPatterns.some((pattern) => pattern.test(upperName));
}

/** Check if a field name suggests it's a person identifier (SSN-like) */
export function isPersonIdentifierField(fieldName: string): boolean {
	const lower = fieldName.toLowerCase();
	return (
		lower.includes("ssn") ||
		lower.includes("social_security") ||
		lower.includes("taxpayer") ||
		lower.includes("employee_ssn") ||
		lower.includes("partner_ssn") ||
		lower.includes("shareholder_ssn")
	);
}

/** Check if a field name suggests it's a business identifier (EIN-like) */
export function isBusinessIdentifierField(fieldName: string): boolean {
	const lower = fieldName.toLowerCase();
	return (
		lower.includes("ein") ||
		lower.includes("employer_id") ||
		lower.includes("partnership_ein") ||
		lower.includes("corporation_ein")
	);
}
