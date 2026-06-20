import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

export type PortalLink = components["schemas"]["PortalLinkResponse"];
export type PortalLinkRequest = components["schemas"]["PortalLinkRequest"];
export type PortalRequestItem = components["schemas"]["PortalRequestItem"];
export type PortalLinkStatus = components["schemas"]["PortalLinkStatusResponse"];

/**
 * Operator-facing status of a case's borrower portal link
 * (none / waiting / submitted) for rendering the Portal Link button. Polls so
 * the button flips to "submitted" when the borrower finishes.
 */
export function usePortalLinkStatus(
	caseId: string | null,
): UseQueryResult<PortalLinkStatus, Error> {
	return useQuery<PortalLinkStatus, Error>({
		queryKey: ["portal-link-status", caseId],
		enabled: !!caseId,
		refetchInterval: 30_000,
		queryFn: async () => getDefaultClient().getPortalLinkStatus(caseId as string),
	});
}

/**
 * Mutation that issues a one-time, expiring borrower portal token for a case
 * (`POST /cases/{case_id}/portal-link`, operator-only). Veritas returns the
 * token + expiry; the caller builds the shareable URL (see
 * {@link buildPortalUrl}). The token is tied to the case's primary borrower so
 * the borrower opens a no-login portal scoped to their own case.
 *
 * Fails with a 409 when no borrower is resolved yet — surface that to the
 * operator ("run identity resolution first").
 */
export function useCreatePortalLink(
	caseId: string | null,
): UseMutationResult<PortalLink, Error, PortalLinkRequest | void> {
	return useMutation<PortalLink, Error, PortalLinkRequest | void>({
		mutationFn: async (body) => {
			if (!caseId) throw new Error("caseId required");
			return await getDefaultClient().createPortalLink(caseId, body || undefined);
		},
	});
}

/**
 * Suggested follow-up / document items for the portal request modal, derived
 * from the case's findings. Disabled when ``caseId`` is null (e.g. the caller
 * supplies its own items).
 */
export function usePortalSuggestions(
	caseId: string | null,
): UseQueryResult<PortalRequestItem[], Error> {
	return useQuery<PortalRequestItem[], Error>({
		queryKey: ["portal-suggestions", caseId],
		enabled: !!caseId,
		queryFn: async () => getDefaultClient().getPortalSuggestions(caseId as string),
	});
}

/** Build the shareable borrower URL from a host-supplied base + the token. */
export function buildPortalUrl(portalBaseUrl: string, token: string): string {
	const base = portalBaseUrl.replace(/\/+$/, "");
	return `${base}?token=${encodeURIComponent(token)}`;
}
