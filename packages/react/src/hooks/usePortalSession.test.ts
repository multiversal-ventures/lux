import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePortalSession } from "@multiversal-ventures/lux-react";

// Capture the stream callback so tests can push events synchronously instead
// of driving a real SSE body. Everything else on the client stays real, so
// `fetchSession` still goes through the stubbed global `fetch`.
const stream = vi.hoisted(() => ({
	onPing: null as ((ping: { type: string; actor?: string }) => void) | null,
}));

vi.mock("@multiversal-ventures/lux-core", async () => {
	const actual = await vi.importActual<typeof import("@multiversal-ventures/lux-core")>(
		"@multiversal-ventures/lux-core",
	);
	return {
		...actual,
		createPortalClient: (...args: Parameters<typeof actual.createPortalClient>) => ({
			...actual.createPortalClient(...args),
			streamPortalEvents: (
				_token: string,
				onPing: (ping: { type: string; actor?: string }) => void,
			) => {
				stream.onPing = onPing;
				return () => {
					stream.onPing = null;
				};
			},
		}),
	};
});

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

	/** Headers of the most recent /portal/session fetch. */
	function lastSessionHeaders(): Headers {
		const calls = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/portal/session"));
		expect(calls.length).toBeGreaterThan(0);
		return new Headers((calls[calls.length - 1][1] as RequestInit).headers);
	}

	it("re-reads the proof when the token changes after mount", async () => {
		// Stored for tok-2 only: the mount-time read for tok-1 yields nothing, so
		// only the token-change effect can pick this up.
		sessionStorage.setItem("lux.portal.verify", JSON.stringify({ token: "tok-2", proof: "proof-2" }));
		vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ session_id: "s" }) } as Response);

		const { rerender } = renderHook(({ token }) => usePortalSession(token), {
			initialProps: { token: "tok-1" },
		});
		await waitFor(() => expect(lastSessionHeaders().get("X-Portal-Token")).toBe("tok-1"));
		expect(lastSessionHeaders().get("X-Portal-Verify")).toBeNull();

		rerender({ token: "tok-2" });

		await waitFor(() => expect(lastSessionHeaders().get("X-Portal-Token")).toBe("tok-2"));
		expect(lastSessionHeaders().get("X-Portal-Verify")).toBe("proof-2");
	});

	it("never carries one token's proof over to a token with no stored proof", async () => {
		sessionStorage.setItem("lux.portal.verify", JSON.stringify({ token: "tok-1", proof: "proof-1" }));
		vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ session_id: "s" }) } as Response);

		const { rerender } = renderHook(({ token }) => usePortalSession(token), {
			initialProps: { token: "tok-1" },
		});
		await waitFor(() => expect(lastSessionHeaders().get("X-Portal-Verify")).toBe("proof-1"));

		rerender({ token: "tok-2" });

		await waitFor(() => expect(lastSessionHeaders().get("X-Portal-Token")).toBe("tok-2"));
		expect(lastSessionHeaders().get("X-Portal-Verify")).toBeNull();
	});

	it("treats a malformed stored value as no proof instead of throwing", async () => {
		sessionStorage.setItem("lux.portal.verify", "{not json");
		vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ session_id: "s" }) } as Response);

		const { result } = renderHook(() => usePortalSession("tok-1"));

		await waitFor(() => expect(result.current.session).not.toBeNull());
		expect(result.current.error).toBeNull();
		expect(sessionFetchHeaders().get("X-Portal-Verify")).toBeNull();
	});
});

describe("stream-driven refetch", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.useFakeTimers();
		vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ session_id: "s" }) } as Response);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const sessionFetches = () =>
		vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/portal/session")).length;

	const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

	const emit = (ping: { type: string; actor?: string }) =>
		act(() => {
			expect(stream.onPing).not.toBeNull();
			stream.onPing?.(ping);
		});

	/** Mount and let the initial load settle; returns the hook result. */
	async function mount() {
		const hook = renderHook(() => usePortalSession("tok-1"));
		await advance(0);
		expect(sessionFetches()).toBe(1);
		return hook.result;
	}

	it("coalesces a burst of events within 400 ms into one refetch", async () => {
		await mount();

		for (let i = 0; i < 5; i++) {
			await emit({ type: "extraction.system.extracted" });
			await advance(100);
		}
		// Last event was 100 ms ago; the trailing edge is still 300 ms away.
		expect(sessionFetches()).toBe(1);

		await advance(300);
		expect(sessionFetches()).toBe(2);

		await advance(5000);
		expect(sessionFetches()).toBe(2);
	});

	it("does not let a typing event cancel a pending refetch", async () => {
		const result = await mount();

		await emit({ type: "extraction.system.extracted" });
		await advance(200);
		await emit({ type: "portal.typing", actor: "operator" });
		expect(result.current.operatorTyping).toBe(true);

		await advance(200); // 400 ms after the refetch event
		expect(sessionFetches()).toBe(2);
		expect(result.current.operatorTyping).toBe(true);
	});

	it("does not let a pending refetch cancel the typing reset", async () => {
		const result = await mount();

		await emit({ type: "portal.typing", actor: "operator" });
		expect(result.current.operatorTyping).toBe(true);

		// Arrives 200 ms before the typing reset, so the refetch is still pending
		// at the moment the 3000 ms typing timer fires.
		await advance(2800);
		await emit({ type: "extraction.system.extracted" });

		await advance(200); // t = 3000
		expect(result.current.operatorTyping).toBe(false);
		expect(sessionFetches()).toBe(1); // refetch still pending, not cancelled

		await advance(200); // t = 3200
		expect(sessionFetches()).toBe(2);
	});
});
