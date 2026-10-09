import type {
	LoanDecisionInfo,
	LoanStatusInfo,
	LoanSummaryInfo,
} from "@multiversal-ventures/lux-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoanStatusCard } from "./LoanStatusCard";

/** Every status key `borrower_statuses.yaml` declares, with the YAML's own
 * label, tone and description — the card renders all three verbatim. */
const STATUSES: Record<string, LoanStatusInfo> = {
	in_progress: {
		key: "in_progress",
		label: "Application in progress",
		tone: "neutral",
		description: "Finish your application and upload the documents listed below.",
		action_count: 0,
	},
	processing: {
		key: "processing",
		label: "Processing documents",
		tone: "info",
		description: "We're reading your documents. This usually takes a few minutes.",
		action_count: 0,
	},
	under_review: {
		key: "under_review",
		label: "Under review",
		tone: "info",
		description: "Your loan officer is reviewing your file.",
		action_count: 0,
	},
	documents_needed: {
		key: "documents_needed",
		label: "Additional documents needed",
		tone: "warning",
		description: "Your loan officer needs a few more documents.",
		action_count: 2,
	},
	approved: {
		key: "approved",
		label: "Approved",
		tone: "success",
		description: "Your loan is approved. Your terms are below.",
		action_count: 0,
	},
	conditionally_approved: {
		key: "conditionally_approved",
		label: "Conditionally approved",
		tone: "success",
		description: "Your loan is approved subject to the conditions below.",
		action_count: 1,
	},
	not_approved: {
		key: "not_approved",
		label: "Not approved",
		tone: "danger",
		description: "We're unable to approve this loan as requested.",
		action_count: 0,
	},
};

const SUMMARY: LoanSummaryInfo = {
	property_label: "412 Alder St, Portland OR",
	product_label: "DSCR Investor Loan",
	fields: [
		{ label: "Loan amount", display: "$420,000" },
		{ label: "Purpose", display: "Purchase" },
	],
};

function decision(overrides: Partial<LoanDecisionInfo> = {}): LoanDecisionInfo {
	return {
		kind: "approved",
		label: "Approved",
		tone: "success",
		decided_at: "2026-10-02T17:30:00Z",
		decided_by_name: "Dana Reyes",
		message: "Congratulations — we're clear to proceed.",
		terms: [
			{ label: "DSCR", display: "1.28" },
			{ label: "LTV", display: "72.5%" },
		],
		conditions: [],
		conditions_state: "received",
		...overrides,
	};
}

describe("LoanStatusCard", () => {
	it.each(Object.keys(STATUSES))("renders the %s status label and description", (key) => {
		render(<LoanStatusCard status={STATUSES[key]} summary={SUMMARY} />);
		expect(screen.getByText(STATUSES[key].label)).toBeInTheDocument();
		// The description is YAML copy, so it is only ever read, never derived —
		// and it is on screen immediately. The card used to collapse to the badge
		// alone, which hid the one sentence that explains what is happening; the
		// click that used to be here is gone because the disclosure is gone.
		expect(screen.getByText(STATUSES[key].description)).toBeInTheDocument();
	});

	// This replaces "starts collapsed without a decision and shows only the
	// badge". The card is the hero of the borrower's loan screen now, so there is
	// no disclosure at all: hiding the status description and the loan's own
	// numbers behind "View details" is what made the screen unreadable. The
	// property pinned here is the one that matters — nothing the borrower needs
	// in order to understand their loan is behind a click.
	it("shows the status, its description and the summary with nothing to open", () => {
		render(<LoanStatusCard status={STATUSES.under_review} summary={SUMMARY} />);
		expect(screen.getByText("Under review")).toBeInTheDocument();
		expect(screen.getByText("Your loan officer is reviewing your file.")).toBeInTheDocument();
		expect(screen.getByText("Loan amount")).toBeInTheDocument();
		expect(screen.getByText("$420,000")).toBeInTheDocument();
		expect(screen.getByText("Purpose")).toBeInTheDocument();
		// No disclosure control of any kind — not a collapsed one, not an
		// expanded one.
		expect(screen.queryByRole("button", { name: /details|terms/i })).not.toBeInTheDocument();
	});

	it("titles the card with the product label when there is no subject yet", () => {
		render(
			<LoanStatusCard
				status={STATUSES.processing}
				summary={{ property_label: null, product_label: "DSCR Investor Loan", fields: [] }}
			/>,
		);
		expect(screen.getByText("DSCR Investor Loan")).toBeInTheDocument();
	});

	it("shows no term values at all when there is no decision", () => {
		render(<LoanStatusCard status={STATUSES.under_review} summary={SUMMARY} decision={null} />);
		expect(screen.queryByText("DSCR")).not.toBeInTheDocument();
		expect(screen.queryByText("1.28")).not.toBeInTheDocument();
		expect(screen.queryByText("LTV")).not.toBeInTheDocument();
		expect(screen.queryByText("72.5%")).not.toBeInTheDocument();
	});

	it("expands by default and shows an approval's terms, note, date and officer", () => {
		render(<LoanStatusCard status={STATUSES.approved} summary={SUMMARY} decision={decision()} />);
		expect(screen.getByText("DSCR")).toBeInTheDocument();
		expect(screen.getByText("1.28")).toBeInTheDocument();
		expect(screen.getByText("LTV")).toBeInTheDocument();
		expect(screen.getByText("72.5%")).toBeInTheDocument();
		expect(screen.getByText("Congratulations — we're clear to proceed.")).toBeInTheDocument();
		expect(screen.getByText(/Dana Reyes/)).toBeInTheDocument();
		expect(
			screen.getByText(new RegExp(new Date("2026-10-02T17:30:00Z").toLocaleDateString())),
		).toBeInTheDocument();
	});

	// This replaces "offers to hide the terms of a decision it has expanded".
	// The View/Hide terms toggle is gone with the rest of the disclosure, so what
	// is pinned instead is the property it protected: a published decision's
	// terms are readable, alongside the status badge, with no interaction.
	it("shows a decision's terms and the badge together, with no toggle", () => {
		render(<LoanStatusCard status={STATUSES.approved} summary={SUMMARY} decision={decision()} />);
		expect(screen.getByText("1.28")).toBeInTheDocument();
		expect(screen.getByText("Approved")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /terms|details/i })).not.toBeInTheDocument();
	});

	it("lists outstanding conditions and says where to send them", () => {
		render(
			<LoanStatusCard
				status={STATUSES.conditionally_approved}
				summary={SUMMARY}
				decision={decision({
					kind: "conditionally_approved",
					label: "Conditionally approved",
					conditions_state: "outstanding",
					conditions: [
						{ title: "2025 tax return", detail: "All schedules, signed." },
						{ title: "Hazard insurance binder", detail: "" },
					],
				})}
			/>,
		);
		expect(screen.getByText("2025 tax return")).toBeInTheDocument();
		expect(screen.getByText("All schedules, signed.")).toBeInTheDocument();
		expect(screen.getByText("Hazard insurance binder")).toBeInTheDocument();
		expect(screen.getByText("Outstanding")).toBeInTheDocument();
		expect(screen.getByText("Upload them under Next step below.")).toBeInTheDocument();
	});

	it("marks fulfilled conditions received and stops asking for them", () => {
		render(
			<LoanStatusCard
				status={STATUSES.conditionally_approved}
				summary={SUMMARY}
				decision={decision({
					kind: "conditionally_approved",
					label: "Conditionally approved",
					conditions_state: "received",
					conditions: [{ title: "2025 tax return", detail: "All schedules, signed." }],
				})}
			/>,
		);
		expect(screen.getByText("Received")).toBeInTheDocument();
		expect(screen.queryByText("Outstanding")).not.toBeInTheDocument();
		expect(screen.queryByText("Upload them under Next step below.")).not.toBeInTheDocument();
	});

	it("shows the officer's note on a declined loan", () => {
		render(
			<LoanStatusCard
				status={STATUSES.not_approved}
				summary={SUMMARY}
				decision={decision({
					kind: "not_approved",
					label: "Not approved",
					tone: "danger",
					message: "The rental income does not cover the payment at this loan amount.",
					terms: [],
					conditions: [],
					conditions_state: null,
				})}
			/>,
		);
		expect(
			screen.getByText("The rental income does not cover the payment at this loan amount."),
		).toBeInTheDocument();
		expect(screen.getByText("Not approved")).toBeInTheDocument();
	});
});
