import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BankingSummary } from "./BankingSummary.js";

describe("BankingSummary", () => {
	it("renders totals and per-account metrics", () => {
		const { getByText } = render(
			<BankingSummary
				data={{
					accounts: [
						{
							account_id: "****1234",
							account_holder_name: "HOLLY LY",
							currency: "USD",
							gross_deposits_aggressive: 12450,
							gross_deposits_conservative: 12000,
							average_monthly_deposits: 4150,
							months_covered: 3,
							stream_count: 1,
							payroll_stream_confidence: 0.92,
							balance_reconciled: true,
							coverage_passed: true,
							summary_matched: true,
							header_fallback: null,
							source_doc_ids: [],
						},
					],
					borrowers: [],
					total_gross_deposits: 12450,
					total_average_monthly: 4150,
				}}
			/>,
		);
		expect(getByText(/HOLLY LY · \*\*\*\*1234/)).toBeInTheDocument();
		expect(getByText("3 months")).toBeInTheDocument();
	});
});
