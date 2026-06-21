import { useCallback, useEffect, useRef, useState } from "react";
import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

export type PortalOverview = components["schemas"]["PortalOverview"];
export type PartyView = components["schemas"]["PartyView"];
export type ThreadMessage = components["schemas"]["ThreadMessage"];
export type PartyCandidate = components["schemas"]["PartyCandidate"];
export type SendRequestBody = components["schemas"]["SendRequestBody"];
export type DraftRequestBody = components["schemas"]["DraftRequestBody"];
export type AddPartyBody = components["schemas"]["AddPartyBody"];
export type PartyCreated = components["schemas"]["PartyCreatedResponse"];
export type MyCaseLink = components["schemas"]["MyCaseLink"];
export type CaseDocument = components["schemas"]["CaseDocument"];
export type PartyDocument = components["schemas"]["PartyDocument"];

/** Cases the signed-in borrower (magic-link account) can access, with tokens. */
export function useMyCases(enabled = true): UseQueryResult<MyCaseLink[], Error> {
	return useQuery<MyCaseLink[], Error>({
		queryKey: ["my-cases"],
		enabled,
		queryFn: async () => getDefaultClient().getMyCases(),
	});
}

const overviewKey = (caseId: string | null) => ["portal-overview", caseId];

/** Operator overview of a case's portal (parties, threads, verification, docs). */
export function usePortalOverview(caseId: string | null): UseQueryResult<PortalOverview, Error> {
	return useQuery<PortalOverview, Error>({
		queryKey: overviewKey(caseId),
		enabled: !!caseId,
		refetchInterval: 30_000,
		queryFn: async () => getDefaultClient().getPortalOverview(caseId as string),
	});
}

/** Resolved case identities not yet engaged as a party ("add party"). */
export function usePortalCandidates(caseId: string | null): UseQueryResult<PartyCandidate[], Error> {
	return useQuery<PartyCandidate[], Error>({
		queryKey: ["portal-candidates", caseId],
		enabled: !!caseId,
		queryFn: async () => getDefaultClient().getPortalCandidates(caseId as string),
	});
}

/** AI-draft request text — returns text only; the operator edits + sends it. */
export function useDraftRequest(
	caseId: string,
): UseMutationResult<string, Error, DraftRequestBody> {
	return useMutation<string, Error, DraftRequestBody>({
		mutationFn: async (body) => (await getDefaultClient().draftPortalRequest(caseId, body)).text ?? "",
	});
}

/** Append a request to a party's thread; refreshes the overview. */
export function useSendRequest(
	caseId: string,
): UseMutationResult<unknown, Error, SendRequestBody> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, SendRequestBody>({
		mutationFn: async (body) => getDefaultClient().sendPortalRequest(caseId, body),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Create a party for a case; refreshes overview + candidates. */
export function useAddParty(caseId: string): UseMutationResult<PartyCreated, Error, AddPartyBody> {
	const qc = useQueryClient();
	return useMutation<PartyCreated, Error, AddPartyBody>({
		mutationFn: async (body) => getDefaultClient().addParty(caseId, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: overviewKey(caseId) });
			qc.invalidateQueries({ queryKey: ["portal-candidates", caseId] });
		},
	});
}

/** Attach a party's role on a case document; refreshes overview. */
export function useAttachDocument(
	caseId: string,
): UseMutationResult<unknown, Error, { partyId: string; docId: string; role: string }> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, { partyId: string; docId: string; role: string }>({
		mutationFn: async ({ partyId, docId, role }) =>
			getDefaultClient().attachPartyDocument(caseId, partyId, { doc_id: docId, role }),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Real-time for the operator: refetch the overview when portal/document events
 * arrive on the case stream, and surface a borrower-typing indicator. */
export function usePortalRealtime(caseId: string): { borrowerTyping: boolean; sendTyping: () => void } {
	const qc = useQueryClient();
	const [borrowerTyping, setBorrowerTyping] = useState(false);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const unsub = getDefaultClient().streamCaseEvents(caseId, (e) => {
			const t = e.event_type || "";
			if (t === "portal.typing") {
				if ((e.event_data as { actor?: string } | undefined)?.actor === "borrower") {
					setBorrowerTyping(true);
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => setBorrowerTyping(false), 3000);
				}
			} else if (t.startsWith("portal.") || t.startsWith("document.")) {
				qc.invalidateQueries({ queryKey: overviewKey(caseId) });
			}
		});
		return () => {
			unsub();
			if (timer) clearTimeout(timer);
		};
	}, [caseId, qc]);

	const lastTyped = useRef(0);
	const sendTyping = useCallback(() => {
		const now = Date.now();
		if (now - lastTyped.current > 1500) {
			lastTyped.current = now;
			void getDefaultClient().sendOperatorTyping(caseId);
		}
	}, [caseId]);

	return { borrowerTyping, sendTyping };
}

/** Delete a party; refreshes overview. */
export function useDeleteParty(caseId: string): UseMutationResult<unknown, Error, string> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, string>({
		mutationFn: async (partyId) => getDefaultClient().deleteParty(caseId, partyId),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Link a party to a case identity; refreshes overview. */
export function useLinkParty(
	caseId: string,
): UseMutationResult<unknown, Error, { partyId: string; identityId: string }> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, { partyId: string; identityId: string }>({
		mutationFn: async ({ partyId, identityId }) =>
			getDefaultClient().linkParty(caseId, partyId, { identity_id: identityId }),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}
