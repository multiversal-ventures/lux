/**
 * Scenario document validation - product requirements and validation logic.
 * Used by CreateScenarioPage to check if case has enough documents to run selected products.
 */

// Document types required for each product type - FAIL FAST validation
// Keys must match product IDs from getLoanProducts() (loan_products.yaml)
// Includes both short names and MISMO class names (extraction may return either)
export const PRODUCT_REQUIRED_DOCS: Record<string, string[]> = {
	// QM products need tax docs (any of these)
	fannie_mae: [
		"W2",
		"IRSW2",
		"Form1040",
		"IRS1040",
		"ScheduleC",
		"IRS1040ScheduleC",
		"K1",
		"IRS1065ScheduleK1",
		"IRS1120SScheduleK1",
	],
	freddie_mac: [
		"W2",
		"IRSW2",
		"Form1040",
		"IRS1040",
		"ScheduleC",
		"IRS1040ScheduleC",
		"K1",
		"IRS1065ScheduleK1",
		"IRS1120SScheduleK1",
	],
	fha: [
		"W2",
		"IRSW2",
		"Form1040",
		"IRS1040",
		"ScheduleC",
		"IRS1040ScheduleC",
		"K1",
		"IRS1065ScheduleK1",
		"IRS1120SScheduleK1",
	],
	usda: [
		"W2",
		"IRSW2",
		"Form1040",
		"IRS1040",
		"ScheduleC",
		"IRS1040ScheduleC",
		"K1",
		"IRS1065ScheduleK1",
		"IRS1120SScheduleK1",
	],
	va: [
		"W2",
		"IRSW2",
		"Form1040",
		"IRS1040",
		"ScheduleC",
		"IRS1040ScheduleC",
		"K1",
		"IRS1065ScheduleK1",
		"IRS1120SScheduleK1",
	],
	// Non-QM products
	non_qm_bank_statement: ["UnifiedBankStatement", "BankStatement"],
	// TODO: remove legacy `bank_statement` after old saved scenarios are migrated.
	bank_statement: ["UnifiedBankStatement", "BankStatement"],
	irs_1099_income: ["IRS1099NEC", "IRS1099MISC", "IRS1099INT", "IRS1099DIV", "IRS1099R"],
};

// Human-readable product names for error messages (keys match getLoanProducts().products[].id)
export const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
	fannie_mae: "Fannie Mae",
	freddie_mac: "Freddie Mac",
	fha: "FHA",
	usda: "USDA",
	va: "VA",
	non_qm_bank_statement: "Bank Statement",
	// TODO: remove legacy `bank_statement` after old saved scenarios are migrated.
	bank_statement: "Bank Statement",
	irs_1099_income: "1099 Income",
};

/**
 * Validate that required documents exist for selected products.
 * Returns missing product IDs that don't have required docs.
 */
export function validateRequiredDocuments(
	selectedProducts: string[],
	documents: { documentType: string }[],
): { valid: boolean; missing: string[] } {
	const docTypes = new Set(documents.map((d) => d.documentType));
	const missing: string[] = [];

	for (const productId of selectedProducts) {
		const required = PRODUCT_REQUIRED_DOCS[productId];
		if (!required) continue; // Skip products without doc requirements

		// Check if ANY of the required doc types exist
		const hasAny = required.some((type) => docTypes.has(type));
		if (!hasAny) {
			missing.push(productId);
		}
	}
	return { valid: missing.length === 0, missing };
}

/**
 * Build user-friendly error message for missing document requirements.
 */
export function getMissingDocsErrorMessage(missingProductIds: string[]): string {
	if (missingProductIds.length === 0) return "";

	const productNames = missingProductIds.map((id) => PRODUCT_DISPLAY_NAMES[id] || id).join(", ");

	const hasBankStatementMissing = missingProductIds.some((id) =>
		["bank_statement", "non_qm_bank_statement"].includes(id),
	);
	const has1099Missing = missingProductIds.includes("irs_1099_income");
	const hasQmMissing = missingProductIds.some((id) =>
		["fannie_mae", "freddie_mac", "fha", "usda", "va"].includes(id),
	);

	if (hasBankStatementMissing) {
		return "Bank Statement income requires bank statement documents. Upload bank statements to continue.";
	}
	if (has1099Missing) {
		return "1099 Income requires 1099 form documents (1099-MISC, 1099-NEC, etc.).";
	}
	if (hasQmMissing) {
		return `Qualified Mortgage products (${productNames}) require W-2, tax returns, or schedule documents.`;
	}
	return `Missing required documents for: ${productNames}`;
}
