import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `usePosPortalCases` — one link's applications, plus the resend action.
 *
 * The two things worth pinning here are the ones a green test can most easily
 * fake:
 *
 * 1. **The `null` gate really gates.** "No request was made" passes trivially
 *    if the client spy was never reachable, so every such assertion below is
 *    paired with a re-render that DOES fetch through the SAME spy.
 * 2. **The four refusal statuses stay four things.** The server returns 404 /
 *    409 / 429 / 502 with different remedies; collapsing them into one error is
 *    the failure this maps against, so they are asserted as four distinct
 *    `kind`s in one test rather than one at a time.
 */

/** Minimal `APIError` stand-in. The real one is a class with a `status` field
 * and nothing else this code reads; `resendOutcomeFromError` narrows with
 * `instanceof`, so the mock must export the same class the module imports. */
class APIError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "APIError";
		this.status = status;
	}
}

const CASE = {
	case_id: "case-1",
	name: null,
	state: "awaiting_verification",
	created_at: "2026-08-25T00:00:00Z",
	parties: [
		{
			party_id: "party-1",
			email: "maria@example.com",
			display_name: null,
			role: "borrower",
		},
	],
};

const listPosPortalCases = vi.fn(async () => [CASE]);
const resendAccessCode = vi.fn(async () => ({ ok: true, detail: "Access code re-sent." }));

vi.mock("@multiversal-ventures/lux-core", () => ({
	APIError,
	getDefaultClient: () => ({ listPosPortalCases, resendAccessCode }),
}));

const { usePosPortalCases, resendOutcomeFromError } = await import("./usePosPortalCases");

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	listPosPortalCases.mockReset();
	listPosPortalCases.mockResolvedValue([CASE]);
	resendAccessCode.mockReset();
	resendAccessCode.mockResolvedValue({ ok: true, detail: "Access code re-sent." });
});

describe("usePosPortalCases", () => {
	it("fetches nothing for a null portal id, and fetches for a real one", async () => {
		// Negative half.
		const { rerender, result } = renderHook(
			({ id }: { id: string | null }) => usePosPortalCases(id),
			{ wrapper, initialProps: { id: null } },
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(listPosPortalCases).not.toHaveBeenCalled();
		expect(result.current.cases).toEqual([]);

		// Positive control, through the SAME spy: without this, the assertion
		// above would also pass if the mocked client were never reachable.
		rerender({ id: "pp-1" });
		await waitFor(() => expect(result.current.cases).toEqual([CASE]));
		expect(listPosPortalCases).toHaveBeenCalledWith("pp-1");
	});

	it("resend calls the route with no body and reports the server's sentence", async () => {
		const { result } = renderHook(() => usePosPortalCases("pp-1"), { wrapper });
		await waitFor(() => expect(result.current.cases).toEqual([CASE]));

		const outcome = await result.current.resend("case-1", "party-1");

		// Positional args only — the client method takes no body precisely so an
		// operator cannot name the recipient. A third argument here would be the
		// redirect this design forbids.
		expect(resendAccessCode).toHaveBeenCalledWith("case-1", "party-1");
		expect(resendAccessCode.mock.calls[0]).toHaveLength(2);
		expect(outcome.kind).toBe("sent");
		expect(outcome.message).toBe("Access code re-sent.");
	});

	it("never rejects: each refusal status becomes its own outcome kind", async () => {
		const { result } = renderHook(() => usePosPortalCases("pp-1"), { wrapper });
		await waitFor(() => expect(result.current.cases).toEqual([CASE]));

		const cases: Array<[number, string, string]> = [
			[404, "Case not found", "gone"],
			[409, "This link has expired. Send them a new link.", "refused"],
			[429, "This borrower's inbox has had its limit.", "throttled"],
			[502, "Email delivery failed. Try again.", "undelivered"],
		];
		const seen: string[] = [];
		for (const [status, detail, expected] of cases) {
			resendAccessCode.mockRejectedValueOnce(new APIError(detail, status));
			const outcome = await result.current.resend("case-1", "party-1");
			expect(outcome.kind).toBe(expected);
			// The SERVER's sentence, not one restated here.
			expect(outcome.message).toBe(detail);
			expect(outcome.status).toBe(status);
			seen.push(outcome.kind);
		}
		// The whole point: four statuses stayed four things.
		expect(new Set(seen).size).toBe(4);
	});

	it("a 404 refetches the list, because the row it names is gone", async () => {
		const { result } = renderHook(() => usePosPortalCases("pp-1"), { wrapper });
		await waitFor(() => expect(result.current.cases).toEqual([CASE]));
		const before = listPosPortalCases.mock.calls.length;

		listPosPortalCases.mockResolvedValue([]);
		resendAccessCode.mockRejectedValueOnce(new APIError("Case not found", 404));
		await result.current.resend("case-1", "party-1");

		// Observable consequence, not just a call count: the reaped case is gone
		// from what the hook returns.
		await waitFor(() => expect(result.current.cases).toEqual([]));
		expect(listPosPortalCases.mock.calls.length).toBeGreaterThan(before);
	});

	it("a 409 does NOT refetch — the case is still there, the link is not", async () => {
		// The positive control for the test above: if `resend` invalidated on
		// every failure, that test would pass for the wrong reason.
		const { result } = renderHook(() => usePosPortalCases("pp-1"), { wrapper });
		await waitFor(() => expect(result.current.cases).toEqual([CASE]));
		const before = listPosPortalCases.mock.calls.length;

		resendAccessCode.mockRejectedValueOnce(new APIError("This link has already been used.", 409));
		await result.current.resend("case-1", "party-1");

		expect(listPosPortalCases.mock.calls.length).toBe(before);
		expect(result.current.cases).toEqual([CASE]);
	});

	it("an error with no status at all is undelivered, not silently sent", async () => {
		// A network failure, a proxy 500, an aborted fetch: none of them prove the
		// mail did or did not go, and the instruction is the same as a 502's.
		expect(resendOutcomeFromError(new Error("Failed to fetch")).kind).toBe("undelivered");
		expect(resendOutcomeFromError(new Error("Failed to fetch")).status).toBeNull();
		// Positive control that `kind` is not simply always "undelivered".
		expect(resendOutcomeFromError(new APIError("nope", 409)).kind).toBe("refused");
	});
});
