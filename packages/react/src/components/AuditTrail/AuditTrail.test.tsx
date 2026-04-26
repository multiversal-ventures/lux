import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AuditTrail } from "./AuditTrail";

describe("AuditTrail", () => {
	it("renders spec with calculation steps", () => {
		const { getByText } = render(
			<AuditTrail
				caseId="c"
				events={[]}
				initialTab="specs"
				specs={[
					{
						spec_name: "bank_statement_income",
						spec_version: "1.0",
						outcome: "eligible",
						monthly_amount: 2075,
						input_hash: null,
						result_hash: null,
						proof_trace: [],
						steps: [
							{
								step_number: 1,
								derivation_name: "qualifying_income",
								formula: "avg * factor",
								formula_display: "4150 * 0.5",
								formula_description: null,
								result: 2075,
								result_type: null,
								is_final: true,
								function_calls: [],
							},
						],
					},
				]}
			/>,
		);
		expect(getByText(/bank_statement_income/)).toBeInTheDocument();
		expect(getByText(/qualifying_income/)).toBeInTheDocument();
	});
});
