import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOperatorClient } from "./operator-client.js";

function makeClient() {
	return createOperatorClient({ bearerToken: "tok-abc", baseUrl: "" });
}
function ok(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body, text: async () => "" } as unknown as Response;
}
function fail(status = 400, text = "Bad request"): Response {
	return { ok: false, status, text: async () => text } as unknown as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("createOperatorClient — billing methods", () => {
	const client = makeClient();

	it("createBillingCheckout: POSTs {product, return_url} to /integrations/stripe/checkout", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ url: "https://checkout.stripe.com/c/sess_1" }));
		const res = await client.createBillingCheckout({ product: "fenero:gunnr", returnUrl: "https://app/settings?billing=done" });
		expect(res.error).toBeNull();
		expect(res.data?.url).toContain("checkout.stripe.com");
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/integrations/stripe/checkout");
		expect(init?.method).toBe("POST");
		expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-abc");
		const body = JSON.parse(init?.body as string);
		expect(body).toEqual({ product: "fenero:gunnr", return_url: "https://app/settings?billing=done" });
	});

	it("createBillingCheckout: surfaces API error", async () => {
		vi.mocked(fetch).mockResolvedValue(fail(402, "No customer"));
		const res = await client.createBillingCheckout({ product: "fenero:gunnr", returnUrl: "r" });
		expect(res.error?.status).toBe(402);
		expect(res.error?.message).toBe("No customer");
	});

	it("recordUsage: POSTs {event_key, dedup_id} to /integrations/stripe/usage", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ status: "billed" }));
		const res = await client.recordUsage({ eventKey: "gunnr.case", dedupId: "case-42" });
		expect(res.error).toBeNull();
		expect(res.data?.status).toBe("billed");
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/integrations/stripe/usage");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body as string)).toEqual({ event_key: "gunnr.case", dedup_id: "case-42" });
	});

	it("getBillingStatus: GETs /integrations/stripe/status with bearer", async () => {
		vi.mocked(fetch).mockResolvedValue(
			ok({ card_status: "active", stripe_customer_id: "cus_1", free_allotment_used: 4, free_allotment_total: 100 }),
		);
		const res = await client.getBillingStatus();
		expect(res.error).toBeNull();
		expect(res.data?.card_status).toBe("active");
		expect(res.data?.free_allotment_total).toBe(100);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/integrations/stripe/status");
		expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-abc");
	});

	it("returns network error on fetch throw", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("offline"));
		const res = await client.getBillingStatus();
		expect(res.error?.status).toBe(0);
		expect(res.error?.message).toBe("Network error");
	});
});
