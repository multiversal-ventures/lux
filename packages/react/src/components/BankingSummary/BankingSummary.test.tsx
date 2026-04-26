import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BankingSummary } from "./BankingSummary.js";

describe("BankingSummary", () => {
	it("renders totals and per-account streams", () => {
		const { getByText } = render(
			<BankingSummary data={{
				accounts: [{
					account_id: "****1234",
					gross_deposits: 12450,
					average_monthly: 4150,
					months_covered: 3,
					streams: [{
						description_pattern: "ACME CORP PAYROLL",
						classification: "Payroll",
						frequency: "biweekly",
						average_amount: 1800,
						occurrence_count: 6,
						confidence: 0.92,
					}],
				}],
				total_gross_deposits: 12450,
				total_average_monthly: 4150,
			}} />,
		);
		expect(getByText("Payroll")).toBeInTheDocument();
		expect(getByText("ACME CORP PAYROLL")).toBeInTheDocument();
		expect(getByText("Account ****1234")).toBeInTheDocument();
	});
});
