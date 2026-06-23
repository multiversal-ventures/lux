import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePortalSession } from "@multiversal-ventures/lux-react";

const SESSION_FIXTURE = {
	session_id: "sess-1",
	entity: { identity_id: "id-1", name: "Alice", role: "borrower" },
	case_id: "case-1",
	case_state: "active",
	checklist: [],
	consent: {
		sms_opt_in: false,
		email_opt_in: false,
		doc_sharing: false,
		electronic_records: false,
		credit_pull: false,
	},
	verification: { level: 0, verified: false },
	upload_config: { max_file_size_mb: 10, accepted_types: ["application/pdf"], endpoint: "/upload" },
};

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});

// The hook opens a real-time event stream (GET /api/portal/stream) on mount,
// which issues its own fetch. Sequence-based tests must ignore that call so it
// doesn't consume an intended mockResolvedValueOnce. This helper returns the
// given responses in order for non-stream calls and a benign non-ok for stream.
function seqFetch(responses: Partial<Response>[]) {
	let i = 0;
	return vi.fn(async (input: RequestInfo | URL) => {
		if (String(input).includes("/portal/stream")) return { ok: false } as Response;
		return responses[i++] as Response;
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("usePortalSession", () => {
	it("sets error when null token is passed", async () => {
		const { result } = renderHook(() => usePortalSession(null));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?.code).toBe("no_token");
		expect(result.current.session).toBeNull();
	});

	it("fetches session successfully when token is provided", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => SESSION_FIXTURE,
		} as Response);

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.session).toEqual(SESSION_FIXTURE);
		expect(result.current.error).toBeNull();
	});

	it("sets error code 'expired' on 401 response", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 401,
		} as Response);

		const { result } = renderHook(() => usePortalSession("expired-tok"));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?.code).toBe("expired");
	});

	it("sets error code 'server' on non-401 HTTP error", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 500,
		} as Response);

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?.code).toBe("server");
		expect(result.current.error?.message).toContain("500");
	});

	it("sets error code 'network' on network failure", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("network down"));

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?.code).toBe("network");
	});

	it("submitIntent updates session on success", async () => {
		const updatedSession = { ...SESSION_FIXTURE, case_state: "docs_submitted" };

		vi.stubGlobal(
			"fetch",
			seqFetch([
				{ ok: true, json: async () => SESSION_FIXTURE },
				{ ok: true, json: async () => ({ session: updatedSession }) },
			]),
		);

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() =>
			result.current.submitIntent([{ type: "consent", params: { consent_type: "sms_opt_in", granted: true } }]),
		);

		expect(result.current.session?.case_state).toBe("docs_submitted");
		expect(result.current.error).toBeNull();
	});

	it("submitIntent sets server error on non-ok HTTP response", async () => {
		vi.stubGlobal(
			"fetch",
			seqFetch([
				{ ok: true, json: async () => SESSION_FIXTURE },
				{ ok: false, status: 409 },
			]),
		);

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.submitIntent([{ type: "consent", params: {} }]));

		expect(result.current.error?.code).toBe("server");
	});

	it("submitIntent sets not_ready error when session is null", async () => {
		const { result } = renderHook(() => usePortalSession(null));
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.submitIntent([{ type: "consent", params: {} }]));
		expect(fetch).not.toHaveBeenCalled();
		expect(result.current.error?.code).toBe("not_ready");
	});
});
