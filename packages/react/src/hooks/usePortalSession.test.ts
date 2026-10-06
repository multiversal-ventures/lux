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

		// Route by URL — the hook also opens the SSE stream (/portal/stream) on
		// mount, so ordered once-mocks would be consumed out from under the POST.
		vi.mocked(fetch).mockImplementation((url) => {
			const u = String(url);
			if (u.includes("/stream")) return Promise.resolve({ ok: true } as Response);
			if (u.includes("/intents"))
				return Promise.resolve({ ok: true, json: async () => ({ session: updatedSession }) } as Response);
			return Promise.resolve({ ok: true, json: async () => SESSION_FIXTURE } as Response);
		});

		const { result } = renderHook(() => usePortalSession("abc123"));
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() =>
			result.current.submitIntent([{ type: "consent", params: { consent_type: "sms_opt_in", granted: true } }]),
		);

		expect(result.current.session?.case_state).toBe("docs_submitted");
		expect(result.current.error).toBeNull();
	});

	it("submitIntent sets server error on non-ok HTTP response", async () => {
		vi.mocked(fetch).mockImplementation((url) => {
			const u = String(url);
			if (u.includes("/stream")) return Promise.resolve({ ok: true } as Response);
			if (u.includes("/intents")) return Promise.resolve({ ok: false, status: 409 } as Response);
			return Promise.resolve({ ok: true, json: async () => SESSION_FIXTURE } as Response);
		});

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

describe("verify proof persistence", () => {
	beforeEach(() => sessionStorage.clear());

	/** Headers sent on the /portal/session fetch (the stream fetch also fires on mount). */
	function sessionFetchHeaders(): Headers {
		const call = vi
			.mocked(fetch)
			.mock.calls.find(([url]) => String(url).endsWith("/portal/session"));
		expect(call).toBeDefined();
		return new Headers((call?.[1] as RequestInit).headers);
	}

	it("reuses a stored proof for the same token across a remount", async () => {
		sessionStorage.setItem(
			"lux.portal.verify",
			JSON.stringify({ token: "tok-1", proof: "proof-1" }),
		);
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ session_id: "s", verification: { verified: true } }),
		} as Response);

		renderHook(() => usePortalSession("tok-1"));
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		await waitFor(() => expect(sessionFetchHeaders().get("X-Portal-Verify")).toBe("proof-1"));
	});

	it("ignores a proof stored under a different token", async () => {
		sessionStorage.setItem(
			"lux.portal.verify",
			JSON.stringify({ token: "other", proof: "proof-1" }),
		);
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ session_id: "s" }),
		} as Response);

		renderHook(() => usePortalSession("tok-1"));
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		await waitFor(() => expect(sessionFetchHeaders().get("X-Portal-Verify")).toBeNull());
	});

	it("clears the stored proof when the server asks for a code", async () => {
		sessionStorage.setItem("lux.portal.verify", JSON.stringify({ token: "tok-1", proof: "stale" }));
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ session_id: "s", requires_code: true }),
		} as Response);

		renderHook(() => usePortalSession("tok-1"));
		await waitFor(() => expect(sessionStorage.getItem("lux.portal.verify")).toBeNull());
	});
});
