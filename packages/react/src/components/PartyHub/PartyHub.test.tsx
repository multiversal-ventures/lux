import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";

const addParty = vi.fn(async () => ({ party_id: "p-new" }));
const getPortalOverview = vi.fn(async () => ({
	parties: [],
	case_documents: [],
	officer_name: "",
	officer_avatar: "",
}));
const getPortalCandidates = vi.fn(async () => [
	{ identity_id: "id-john", display_name: "John Smith", role: "borrower", party_type: "individual" },
	{ identity_id: "id-tech", display_name: "TechCorp Industries Inc.", role: "business", party_type: "business" },
]);

vi.mock("@multiversal-ventures/lux-core", () => ({
	getDefaultClient: () => ({ getPortalOverview, getPortalCandidates, addParty }),
}));

// Imported after the mock so the hooks pick up the mocked client.
const { PartyHub } = await import("./PartyHub");

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	queryClient.clear();
	addParty.mockClear();
});

describe("PartyHub — resolved candidates in the list", () => {
	it("shows resolved case identities with a one-click Add, not an empty hub", async () => {
		render(<RQ><PartyHub caseId="c1" /></RQ>);

		expect(await screen.findByText("John Smith")).toBeTruthy();
		expect(screen.getByText("TechCorp Industries Inc.")).toBeTruthy();
		// The bare "No matching people" empty state must NOT show when candidates exist.
		expect(screen.queryByText("No matching people.")).toBeNull();
	});

	it("adds a candidate as a party with its linked identity", async () => {
		render(<RQ><PartyHub caseId="c1" /></RQ>);
		await screen.findByText("John Smith");

		const addButtons = screen.getAllByTitle(/^Add /);
		fireEvent.click(addButtons[0]);

		await waitFor(() => expect(addParty).toHaveBeenCalledTimes(1));
		expect(addParty).toHaveBeenCalledWith(
			"c1",
			expect.objectContaining({ display_name: "John Smith", linked_identity_id: "id-john" }),
		);
	});
});
