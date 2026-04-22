import type { StoredCase } from "../hooks/useCaseHistory";

/**
 * Generates a default case name.
 *
 * @param _cases - Array of all stored cases (unused, kept for API compatibility)
 * @returns Default case name "Case Name"
 */
export function generateDefaultCaseName(_cases: StoredCase[]): string {
	return "Case Name";
}

/**
 * Gets the display name for a case, generating a default if empty.
 *
 * @param caseData - The case data (can be null/undefined)
 * @param allCases - Array of all stored cases (for generating unique default names)
 * @returns The case name or a generated default name
 */
export function getCaseDisplayName(
	caseData: StoredCase | null | undefined,
	allCases: StoredCase[],
): string {
	if (!caseData) {
		return generateDefaultCaseName(allCases);
	}

	if (caseData.name && caseData.name.trim()) {
		return caseData.name.trim();
	}

	// Generate default name if empty
	// Exclude the current case from the list when checking for conflicts
	// (so we don't count its own empty name as a conflict)
	const otherCases = allCases.filter((c) => c.case_id !== caseData.case_id);
	return generateDefaultCaseName(otherCases);
}
