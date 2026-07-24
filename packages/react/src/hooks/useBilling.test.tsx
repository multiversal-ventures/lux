import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { OperatorProvider } from "../providers/OperatorProvider.js";
import { useBillingStatus, useCreateBillingCheckout } from "./useBilling.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return (
		<QueryClientProvider client={qc}>
			<OperatorProvider bearerToken="tok-abc" queryClient={qc}>
				{children}
			</OperatorProvider>
		</QueryClientProvider>
	);
}

function ok(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body, text: async () => "" } as unknown as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("useBillingStatus", () => {
	it("fetches billing status via the operator client", async () => {
		vi.mocked(fetch).mockResolvedValue(
			ok({ card_status: "active", free_allotment_used: 1, free_allotment_total: 100 }),
		);
		const { result } = renderHook(() => useBillingStatus(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.card_status).toBe("active");
	});
});

describe("useCreateBillingCheckout", () => {
	it("mutates and returns the checkout URL", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ url: "https://checkout.stripe.com/c/sess_1" }));
		const { result } = renderHook(() => useCreateBillingCheckout(), { wrapper });
		result.current.mutate({ product: "fenero:gunnr", returnUrl: "https://app/settings" });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.url).toContain("checkout.stripe.com");
	});
});
