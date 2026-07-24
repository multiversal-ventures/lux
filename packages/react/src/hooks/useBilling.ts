import { useMutation, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import type {
	BillingCheckoutRequest,
	BillingCheckoutResponse,
	BillingStatusResponse,
} from "@multiversal-ventures/lux-core";
import { useOperatorClient } from "../providers/OperatorProvider.js";
import { useOperatorQuery } from "./_useOperatorQuery.js";

/** Card status + lifetime free-case allotment for the current operator's tenant. */
export function useBillingStatus(): UseQueryResult<BillingStatusResponse, { status: number; message: string }> {
	return useOperatorQuery<BillingStatusResponse>(["billing-status"], (client) => client.getBillingStatus());
}

/** Launch a setup-mode Stripe Checkout session; resolves with the hosted URL to redirect to. */
export function useCreateBillingCheckout(): UseMutationResult<
	BillingCheckoutResponse,
	{ status: number; message: string },
	BillingCheckoutRequest
> {
	const client = useOperatorClient();
	return useMutation<BillingCheckoutResponse, { status: number; message: string }, BillingCheckoutRequest>({
		mutationFn: async (body) => {
			const res = await client.createBillingCheckout(body);
			if (res.error) throw res.error;
			return res.data as BillingCheckoutResponse;
		},
	});
}
