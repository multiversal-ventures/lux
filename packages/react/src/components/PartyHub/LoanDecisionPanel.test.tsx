import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The draft as `GET /api/cases/{id}/decision/draft` answers it: the engine's
 * suggestion, the terms snapshotted off ONE calculation, and the conditions the
 * operator may check off. */
function draftFixture(overrides: Record<string, unknown> = {}) {
	return {
		current_status: {
			key: "under_review",
			label: "Under review",
			tone: "info",
			description: "Your loan officer is reviewing your file.",
			action_count: 0,
		},
		basis: {
			result_id: "r-1",
			manifest_id: "m-1",
			manifest_name: "DSCR base case",
			computed_at: "2026-10-01T10:00:00Z",
		},
		kinds: [
			{ key: "approved", label: "Approved", tone: "success" },
			{ key: "conditionally_approved", label: "Conditionally approved", tone: "success" },
			{ key: "not_approved", label: "Not approved", tone: "danger" },
		],
		suggested_kind: "conditionally_approved",
		terms: [
			{ field: "loan_amount", source: "input", label: "Loan amount", display: "$420,000" },
			{ field: "dscr", source: "derivation", label: "DSCR", display: "1.28" },
		],
		conditions: [
			{
				id: "c1",
				title: "2025 tax return",
				detail: "All schedules, signed.",
				action: "upload",
				priority: "high",
				source: "completeness",
			},
		],
		...overrides,
	};
}

let draft: Record<string, unknown> = draftFixture();
let history: Record<string, unknown> = { current_status: null, decisions: [] };

const getDecisionDraft = vi.fn(async () => draft);
const listDecisions = vi.fn(async () => history);
const publishDecision = vi.fn(async () => ({
	decision_id: "d-1",
	kind: "conditionally_approved",
	label: "Conditionally approved",
	tone: "success",
	created_at: "2026-10-07T12:00:00Z",
	decided_by_name: "Dana Reyes",
	message: null,
	terms: [],
	conditions: [],
}));

vi.mock("@multiversal-ventures/lux-core", () => ({
	getDefaultClient: () => ({ getDecisionDraft, listDecisions, publishDecision }),
}));

// Imported after the mock so the hooks pick up the mocked client.
const { LoanDecisionPanel } = await import("./LoanDecisionPanel");

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	queryClient.clear();
	draft = draftFixture();
	history = { current_status: null, decisions: [] };
	getDecisionDraft.mockClear();
	listDecisions.mockClear();
	publishDecision.mockClear();
});

/** Render the panel and open the modal. */
async function openModal() {
	render(
		<RQ>
			<LoanDecisionPanel caseId="c1" />
		</RQ>,
	);
	const open = await screen.findByRole("button", { name: /update borrower status/i });
	await userEvent.click(open);
	return screen.getByRole("dialog");
}

describe("LoanDecisionPanel", () => {
	it("shows the borrower's current status", async () => {
		render(
			<RQ>
				<LoanDecisionPanel caseId="c1" />
			</RQ>,
		);
		expect(await screen.findByText("Under review")).toBeInTheDocument();
	});

	it("marks the engine's suggestion as suggested", async () => {
		const modal = await openModal();
		const suggested = modal.querySelector('[data-kind="conditionally_approved"]') as HTMLElement;
		expect(suggested.textContent).toMatch(/suggested/i);
		// The annotation names the calculation, not a hardcoded product.
		expect(suggested.textContent).toContain("DSCR base case");
		const other = modal.querySelector('[data-kind="approved"]') as HTMLElement;
		expect(other.textContent).not.toMatch(/suggested/i);
	});

	it("renders the terms read-only, naming the basis", async () => {
		const modal = await openModal();
		expect(screen.getByText("$420,000")).toBeInTheDocument();
		expect(screen.getByText("1.28")).toBeInTheDocument();
		expect(screen.getByText(/Based on: DSCR base case/)).toBeInTheDocument();
		expect(screen.getByText(/refinement/i)).toBeInTheDocument();
		// Read-only: no term is an editable control.
		expect(modal.querySelectorAll('input[name^="term-"]')).toHaveLength(0);
	});

	it("prefills the conditions from the draft", async () => {
		await openModal();
		const condition = screen.getByRole("checkbox", { name: /2025 tax return/i });
		expect(condition).toBeChecked();
		expect(screen.getByText("All schedules, signed.")).toBeInTheDocument();
	});

	it("hides the conditions section for Not approved", async () => {
		await openModal();
		await userEvent.click(screen.getByRole("radio", { name: /not approved/i }));
		expect(screen.queryByRole("checkbox", { name: /2025 tax return/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /add condition/i })).not.toBeInTheDocument();
	});

	it("publishes the draft's basis, the chosen kind and the checked conditions", async () => {
		await openModal();
		await userEvent.type(screen.getByLabelText(/message to borrower/i), "Nearly there.");
		await userEvent.click(screen.getByRole("button", { name: /publish to borrower/i }));

		await waitFor(() => expect(publishDecision).toHaveBeenCalledTimes(1));
		expect(publishDecision).toHaveBeenCalledWith("c1", {
			kind: "conditionally_approved",
			result_id: "r-1",
			conditions: [
				{
					id: "c1",
					title: "2025 tax return",
					detail: "All schedules, signed.",
					action: "upload",
					priority: "high",
					source: "completeness",
				},
			],
			message: "Nearly there.",
		});
	});

	it("sends no conditions once the officer unchecks the one the draft suggested", async () => {
		await openModal();
		await userEvent.click(screen.getByRole("checkbox", { name: /2025 tax return/i }));
		await userEvent.click(screen.getByRole("button", { name: /publish to borrower/i }));

		await waitFor(() => expect(publishDecision).toHaveBeenCalledTimes(1));
		expect(publishDecision.mock.calls[0][1]).toMatchObject({
			conditions: [],
			message: null,
		});
	});

	it("lets the officer add a custom condition", async () => {
		await openModal();
		await userEvent.type(screen.getByLabelText(/condition title/i), "Hazard insurance binder");
		await userEvent.type(screen.getByLabelText(/condition detail/i), "Named lender as payee.");
		await userEvent.click(screen.getByRole("button", { name: /add condition/i }));

		expect(screen.getByRole("checkbox", { name: /hazard insurance binder/i })).toBeChecked();

		await userEvent.click(screen.getByRole("button", { name: /publish to borrower/i }));
		await waitFor(() => expect(publishDecision).toHaveBeenCalledTimes(1));
		const body = publishDecision.mock.calls[0][1] as {
			conditions: { title: string; detail: string; source: string }[];
		};
		expect(body.conditions).toHaveLength(2);
		expect(body.conditions[1]).toMatchObject({
			title: "Hazard insurance binder",
			detail: "Named lender as payee.",
			source: "custom",
		});
	});

	it("says the analysis has not run and disables publishing when there is no basis", async () => {
		draft = draftFixture({ basis: null, terms: [], suggested_kind: null });
		await openModal();
		expect(screen.getByText(/analysis has not run/i)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("radio", { name: /^approved$/i }));
		expect(screen.getByRole("button", { name: /publish to borrower/i })).toBeDisabled();
		expect(publishDecision).not.toHaveBeenCalled();
	});

	it("shows the new status and a short history after publishing", async () => {
		await openModal();
		history = {
			current_status: {
				key: "conditionally_approved",
				label: "Conditionally approved",
				tone: "success",
				description: "Your loan is approved subject to the conditions below.",
				action_count: 1,
			},
			decisions: [
				{
					decision_id: "d-1",
					kind: "conditionally_approved",
					label: "Conditionally approved",
					tone: "success",
					created_at: "2026-10-07T12:00:00Z",
					decided_by_name: "Dana Reyes",
					message: null,
					terms: [],
					conditions: [],
				},
			],
		};
		draft = draftFixture({
			current_status: history.current_status,
			suggested_kind: "conditionally_approved",
		});

		await userEvent.click(screen.getByRole("button", { name: /publish to borrower/i }));
		await waitFor(() => expect(publishDecision).toHaveBeenCalledTimes(1));

		expect(await screen.findByText("Conditionally approved")).toBeInTheDocument();
		const entry = await screen.findByTestId("decision-history-entry");
		expect(entry.textContent).toContain("Conditionally approved");
		expect(entry.textContent).toContain("Dana Reyes");
		expect(entry.textContent).toContain(new Date("2026-10-07T12:00:00Z").toLocaleDateString());
	});
});
