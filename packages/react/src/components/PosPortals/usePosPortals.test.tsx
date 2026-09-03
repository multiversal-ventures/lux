import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PORTAL = {
	pos_portal_id: "pp-1",
	product_id: "dscr",
	slug: "abc123def456",
	label: "DSCR — my website",
	url: "https://apply.example.com/apply/abc123def456",
	active: true,
	expires_at: null,
	created_at: "2026-08-25T00:00:00Z",
};

const listPosPortals = vi.fn(async () => [] as (typeof PORTAL)[]);
const createPosPortal = vi.fn(async () => PORTAL);
const deactivatePosPortal = vi.fn(async () => ({ ...PORTAL, active: false }));

vi.mock("@multiversal-ventures/lux-core", () => ({
	getDefaultClient: () => ({ listPosPortals, createPosPortal, deactivatePosPortal }),
}));

// Imported after the mock so the hook picks up the mocked client.
const { usePosPortals } = await import("./usePosPortals");

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Reset the implementations, not just the call counts: these tests set steady
// -state resolved values (a one-shot would make green depend on react-query
// fetching exactly once), so each test must start from a known default.
beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	listPosPortals.mockReset();
	listPosPortals.mockResolvedValue([]);
	createPosPortal.mockReset();
	createPosPortal.mockResolvedValue(PORTAL);
	deactivatePosPortal.mockReset();
	deactivatePosPortal.mockResolvedValue({ ...PORTAL, active: false });
});

describe("usePosPortals", () => {
	it("loads this tenant's links from the client", async () => {
		listPosPortals.mockResolvedValue([PORTAL]);
		const { result } = renderHook(() => usePosPortals(), { wrapper });

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.portals).toEqual([PORTAL]);
		expect(result.current.error).toBeNull();
	});

	it("create publishes through the client and the list picks the new link up", async () => {
		const { result } = renderHook(() => usePosPortals(), { wrapper });
		await waitFor(() => expect(result.current.loading).toBe(false));

		// Steady state, not a one-shot: the assertion below is about the invalidation
		// refetching, and must not depend on react-query fetching exactly once.
		listPosPortals.mockResolvedValue([PORTAL]);
		await result.current.create({ product_id: "dscr", label: "DSCR — my website" });

		expect(createPosPortal).toHaveBeenCalledWith({
			product_id: "dscr",
			label: "DSCR — my website",
		});
		// Observable consequence, not just the mock call: the invalidation refetched
		// and the freshly published link is now in `portals`.
		await waitFor(() => expect(result.current.portals).toEqual([PORTAL]));
	});

	it("deactivate soft-disables through the client and the list reflects it", async () => {
		listPosPortals.mockResolvedValue([PORTAL]);
		const { result } = renderHook(() => usePosPortals(), { wrapper });
		await waitFor(() => expect(result.current.portals).toEqual([PORTAL]));

		listPosPortals.mockResolvedValue([{ ...PORTAL, active: false }]);
		const updated = await result.current.deactivate("pp-1");

		expect(deactivatePosPortal).toHaveBeenCalledWith("pp-1");
		expect(updated.active).toBe(false);
		await waitFor(() => expect(result.current.portals[0].active).toBe(false));
	});

	it("surfaces a load failure as an error instead of an empty list", async () => {
		listPosPortals.mockRejectedValueOnce(new Error("boom"));
		const { result } = renderHook(() => usePosPortals(), { wrapper });

		await waitFor(() => expect(result.current.error?.message).toBe("boom"));
		expect(result.current.portals).toEqual([]);
	});
});
