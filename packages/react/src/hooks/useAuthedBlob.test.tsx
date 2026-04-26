import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OperatorProvider } from "../providers/OperatorProvider";
import { useAuthedBlob } from "./useAuthedBlob";

function makeWrapper(qc?: QueryClient) {
	const q = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={q}>
			<OperatorProvider bearerToken="test-tok" queryClient={q}>
				{children}
			</OperatorProvider>
		</QueryClientProvider>
	);
}

describe("useAuthedBlob", () => {
	let createObjectURL: ReturnType<typeof vi.fn>;
	let revokeObjectURL: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		createObjectURL = vi.fn((_blob: Blob) => "blob:mock-url");
		revokeObjectURL = vi.fn();
		(globalThis.URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
		(globalThis.URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches URL with Authorization header and returns an object URL", async () => {
		const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			blob: async () => blob,
		} as unknown as Response);

		const { result } = renderHook(() => useAuthedBlob("/api/cases/c/files/f/pages/1.png"), {
			wrapper: makeWrapper(),
		});
		await waitFor(() => expect(result.current.data).toBe("blob:mock-url"));

		const [, init] = vi.mocked(fetch).mock.calls[0];
		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer test-tok");
		expect(createObjectURL).toHaveBeenCalledWith(blob);
	});

	it("is disabled when url is null", async () => {
		const { result } = renderHook(() => useAuthedBlob(null), {
			wrapper: makeWrapper(),
		});
		// should not have fetched
		await new Promise((r) => setTimeout(r, 10));
		expect(fetch).not.toHaveBeenCalled();
		expect(result.current.data).toBeUndefined();
	});

	it("revokes the object URL when the query cache entry is removed", async () => {
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: 0 } },
		});
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			blob: async () => new Blob([new Uint8Array([1])], { type: "image/png" }),
		} as unknown as Response);

		const { result, unmount } = renderHook(
			() => useAuthedBlob("/api/test.png"),
			{ wrapper: makeWrapper(qc) },
		);
		await waitFor(() => expect(result.current.data).toBe("blob:mock-url"));
		unmount();
		// With gcTime=0 the cache entry is evicted next tick.
		await new Promise((r) => setTimeout(r, 20));
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
	});
});
