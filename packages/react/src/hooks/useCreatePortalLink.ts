import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

export type PortalLink = components["schemas"]["PortalLinkResponse"];

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
): UseMutationResult<PortalLink, Error, void> {
	return useMutation<PortalLink, Error, void>({
		mutationFn: async () => {
			if (!caseId) throw new Error("caseId required");
			return await getDefaultClient().createPortalLink(caseId);
		},
	});
}

/** Build the shareable borrower URL from a host-supplied base + the token. */
export function buildPortalUrl(portalBaseUrl: string, token: string): string {
	const base = portalBaseUrl.replace(/\/+$/, "");
	return `${base}?token=${encodeURIComponent(token)}`;
}
