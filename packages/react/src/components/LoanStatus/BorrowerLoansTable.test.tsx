import type { BorrowerLoanRow } from "@multiversal-ventures/lux-core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BorrowerLoansTable } from "./BorrowerLoansTable";

/** Two rows as `GET /api/portal/my-loans` answers them: status and summary
 * flattened onto the row, `action_count` riding on `status`, and no decision
 * block — the row links INTO the loan. */
const LOANS: BorrowerLoanRow[] = [
	{
		case_id: "case-1",
		token: "tok-1",
		property_label: "412 Alder St, Portland OR",
		product_label: "DSCR Investor Loan",
		officer_name: "Dana Reyes",
		updated_at: "2026-10-02T17:30:00Z",
		created_at: "2026-09-28T09:00:00Z",
		status: {
			key: "documents_needed",
			label: "Additional documents needed",
			tone: "warning",
			description: "Your loan officer needs a few more documents.",
			action_count: 3,
		},
		summary: [
			{ label: "Loan amount", display: "$420,000" },
			{ label: "Purpose", display: "Purchase" },
		],
	},
	{
		case_id: "case-2",
		token: "tok-2",
		property_label: "Maria Chen",
		product_label: "Bank Statement Loan",
		officer_name: "Dana Reyes",
		updated_at: "2026-09-30T12:00:00Z",
		created_at: "2026-09-01T09:00:00Z",
		status: {
			key: "under_review",
			label: "Under review",
			tone: "info",
			description: "Your loan officer is reviewing your file.",
			action_count: 0,
		},
		summary: [],
	},
];

describe("BorrowerLoansTable", () => {
	/** The table and the stacked cards are the same data at two breakpoints
	 * (`hidden sm:table` / `sm:hidden`), and happy-dom applies no CSS, so both
	 * are in the tree. Every assertion below is scoped to one of them. */
	function desktop(): HTMLElement {
		return screen.getByRole("table");
	}

	it("renders one row per loan with the subject, the product and the badge", () => {
		render(<BorrowerLoansTable loans={LOANS} onOpen={() => {}} />);
		expect(within(desktop()).getAllByRole("row")).toHaveLength(LOANS.length + 1); // + header
		// `property_label` can be a person, not an address — both render as the subject.
		expect(within(desktop()).getByText("412 Alder St, Portland OR")).toBeInTheDocument();
		expect(within(desktop()).getByText("Maria Chen")).toBeInTheDocument();
		expect(within(desktop()).getByText("DSCR Investor Loan")).toBeInTheDocument();
		expect(within(desktop()).getByText("Additional documents needed")).toBeInTheDocument();
		expect(within(desktop()).getByText("Under review")).toBeInTheDocument();
	});

	it("joins the summary fields under the product label", () => {
		render(<BorrowerLoansTable loans={LOANS} onOpen={() => {}} />);
		expect(within(desktop()).getByText("$420,000 · Purchase")).toBeInTheDocument();
	});

	it("names the loan officer and the date the case was last updated", () => {
		render(<BorrowerLoansTable loans={LOANS} onOpen={() => {}} />);
		expect(within(desktop()).getAllByText("Dana Reyes")).toHaveLength(2);
		const updated = new Date("2026-10-02T17:30:00Z").toLocaleDateString();
		expect(within(desktop()).getByText(updated)).toBeInTheDocument();
	});

	it("shows the action-needed pill only for a loan with open items", () => {
		render(<BorrowerLoansTable loans={LOANS} onOpen={() => {}} />);
		expect(within(desktop()).getAllByText("3 actions needed")).toHaveLength(1);
		expect(within(desktop()).queryByText("0 actions needed")).not.toBeInTheDocument();
	});

	it("hands the clicked row's token and case id to onOpen", async () => {
		const onOpen = vi.fn();
		render(<BorrowerLoansTable loans={LOANS} onOpen={onOpen} />);
		await userEvent.click(within(desktop()).getByText("Maria Chen"));
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onOpen).toHaveBeenCalledWith("tok-2", "case-2");
	});

	it("opens the same loan from the stacked card below sm", async () => {
		const onOpen = vi.fn();
		const { container } = render(<BorrowerLoansTable loans={LOANS} onOpen={onOpen} />);
		const cards = container.querySelector(".sm\\:hidden") as HTMLElement;
		await userEvent.click(within(cards).getByText("Maria Chen"));
		expect(onOpen).toHaveBeenCalledWith("tok-2", "case-2");
	});

	it("renders an em dash rather than a date for a loan with no updated_at", () => {
		const undated: BorrowerLoanRow[] = [{ ...LOANS[1], updated_at: null, created_at: null }];
		render(<BorrowerLoansTable loans={undated} onOpen={() => {}} />);
		expect(within(desktop()).getByText("—")).toBeInTheDocument();
	});

	it("names the signed-in email in the empty state", () => {
		render(<BorrowerLoansTable loans={[]} onOpen={() => {}} email="maria@example.com" />);
		expect(screen.getByText(/maria@example\.com/)).toBeInTheDocument();
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});
});
