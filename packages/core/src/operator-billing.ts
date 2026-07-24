import type { Result } from "./operator-types.js";

// Inline until veritas publishes these routes to OpenAPI; then replace with
// components["schemas"][...] and run `pnpm codegen` (same pattern as the
// inline CreatePortalTokenRequest in operator-cases.ts).
export type BillingCheckoutRequest = { product: string; returnUrl: string };
export type BillingCheckoutResponse = { url: string };
export type RecordUsageRequest = { eventKey: string; dedupId: string };
// Mirrors veritas RecordResult: waived|billed|blocked|failed|errored|duplicate.
export type RecordUsageResponse = {
	status: string;
	ledger_id?: number | null;
	// Not currently returned by veritas's /usage route (router.py only sends
	// status/ledger_id) — typed here for when that's fixed, but always
	// undefined today.
	stripe_event_id?: string | null;
};
export type BillingStatusResponse = {
	card_status: string;
	stripe_customer_id?: string | null;
	free_allotment_used: number;
	free_allotment_total: number;
};

// stripe_billing is an integration adapter — mounts WITHOUT the /api prefix
// veritas's first-party routers get (confirmed against
// src/veritas/integrations/stripe_billing/router.py).
const PATHS = {
	checkout: "/integrations/stripe/checkout",
	usage: "/integrations/stripe/usage",
	status: "/integrations/stripe/status",
} as const;

/**
 * Billing methods bound to a shared request context. Spread into the
 * OperatorClient return value, identical to createCaseMethods.
 */
export function createBillingMethods(
	base: string,
	authHeaders: (extra?: Record<string, string>) => Record<string, string>,
	request: <T>(res: Response) => Promise<Result<T>>,
) {
	/** Create a setup-mode Stripe Checkout session; returns the hosted URL to redirect to. */
	async function createBillingCheckout(
		body: BillingCheckoutRequest,
	): Promise<Result<BillingCheckoutResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.checkout}`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ product: body.product, return_url: body.returnUrl }),
			});
			return await request<BillingCheckoutResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Meter one billable unit. Only used by out-of-veritas completion paths — gunnr's own
	 * case-close billing is triggered veritas-side, not from this client. */
	async function recordUsage(body: RecordUsageRequest): Promise<Result<RecordUsageResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.usage}`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ event_key: body.eventKey, dedup_id: body.dedupId }),
			});
			return await request<RecordUsageResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Card status + lifetime free-case allotment usage for the caller's tenant. */
	async function getBillingStatus(): Promise<Result<BillingStatusResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.status}`, { headers: authHeaders() });
			return await request<BillingStatusResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	return { createBillingCheckout, recordUsage, getBillingStatus };
}
