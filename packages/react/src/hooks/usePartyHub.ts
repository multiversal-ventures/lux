import { type components, getDefaultClient } from "@multiversal-ventures/lux-core";
import {
	type UseMutationResult,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export type PortalOverview = components["schemas"]["PortalOverview"];
export type PartyView = components["schemas"]["PartyView"];
export type ThreadMessage = components["schemas"]["ThreadMessage"];
export type PartyCandidate = components["schemas"]["PartyCandidate"];
export type SendRequestBody = components["schemas"]["SendRequestBody"];
export type DraftRequestBody = components["schemas"]["DraftRequestBody"];
export type AddPartyBody = components["schemas"]["AddPartyBody"];
export type PartyCreated = components["schemas"]["PartyCreatedResponse"];
export type MyCaseLink = components["schemas"]["MyCaseLink"];
export type PortalRequestItem = components["schemas"]["PortalRequestItem"];
export type RegenerateSuggestionsBody = components["schemas"]["RegenerateSuggestionsBody"];
export type CaseDocument = components["schemas"]["CaseDocument"];
export type PartyDocument = components["schemas"]["PartyDocument"];
export type PartyProfile = components["schemas"]["PartyProfile"];

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

/** Operator "what we know about this party" profile — identity, masked
 * identifiers, contact facts, mentions, status. Enabled only while a party is
 * being viewed (caseId + partyId both set). */
export function usePartyProfile(
	caseId: string | null,
	partyId: string | null,
): UseQueryResult<PartyProfile, Error> {
	return useQuery<PartyProfile, Error>({
		queryKey: ["party-profile", caseId, partyId],
		enabled: !!caseId && !!partyId,
		queryFn: async () => getDefaultClient().getPartyProfile(caseId as string, partyId as string),
	});
}

/** Resolved case identities not yet engaged as a party ("add party"). */
export function usePortalCandidates(
	caseId: string | null,
): UseQueryResult<PartyCandidate[], Error> {
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
		mutationFn: async (body) =>
			(await getDefaultClient().draftPortalRequest(caseId, body)).text ?? "",
	});
}

/** On-demand 'generate more' suggestions — feeds the operator's typed note and
 * skips already-shown titles. Returns fresh items; no cache read/write. */
export function useRegenerateSuggestions(
	caseId: string,
): UseMutationResult<PortalRequestItem[], Error, RegenerateSuggestionsBody> {
	return useMutation<PortalRequestItem[], Error, RegenerateSuggestionsBody>({
		mutationFn: async (body) => getDefaultClient().regeneratePortalSuggestions(caseId, body),
	});
}

/** Append a request to a party's thread; refreshes the overview. */
export function useSendRequest(caseId: string): UseMutationResult<unknown, Error, SendRequestBody> {
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
export function usePortalRealtime(caseId: string): {
	borrowerTyping: boolean;
	sendTyping: () => void;
} {
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
			} else if (
				t.startsWith("portal.") ||
				t.startsWith("document.") ||
				t.startsWith("identity.borrower.") ||
				t.startsWith("identity.portal.") ||
				t.startsWith("consent.")
			) {
				// Borrower verify / account-email / consent + messages + uploads
				// all change party state — refetch the operator overview live.
				qc.invalidateQueries({ queryKey: overviewKey(caseId) });
				// Suggestions are a SEPARATE query from the overview. The live
				// re-curate (PartyHubWorkflow) emits portal.suggestions.refreshed
				// when the cached follow-up asks change — invalidate that query
				// too so the modal shows fresh suggestions without a reload.
				// Key must match usePortalSuggestions in useCreatePortalLink.ts.
				if (t === "portal.suggestions.refreshed") {
					qc.invalidateQueries({ queryKey: ["portal-suggestions", caseId] });
				}
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

/** Delete a party; optimistically drops it from the list, then refetches. */
export function useDeleteParty(
	caseId: string,
): UseMutationResult<unknown, Error, string, { prev?: PortalOverview }> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, string, { prev?: PortalOverview }>({
		mutationFn: async (partyId) => getDefaultClient().deleteParty(caseId, partyId),
		// Optimistic: remove the row immediately so the UI updates without waiting
		// on the refetch (a 204 + interval-refetch could otherwise look like nothing happened).
		onMutate: async (partyId) => {
			await qc.cancelQueries({ queryKey: overviewKey(caseId) });
			const prev = qc.getQueryData<PortalOverview>(overviewKey(caseId));
			if (prev) {
				qc.setQueryData<PortalOverview>(overviewKey(caseId), {
					...prev,
					parties: (prev.parties ?? []).filter((p) => p.party_id !== partyId),
				});
			}
			return { prev };
		},
		onError: (_e, _partyId, ctx) => {
			if (ctx?.prev) qc.setQueryData(overviewKey(caseId), ctx.prev);
		},
		onSettled: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Clear a party's conversation thread (keeps the party + link); refreshes overview. */
export function useClearThread(caseId: string): UseMutationResult<unknown, Error, string> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, string>({
		mutationFn: async (partyId) => getDefaultClient().clearPartyThread(caseId, partyId),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Soft-delete a single message from a party's thread (operator side); refreshes
 * overview. Own-only: the operator may delete only their own messages; upload
 * bubbles are not deletable (the server 404s). The row is kept so the thread
 * renders a deleted tombstone. */
export function useDeleteMessage(
	caseId: string,
): UseMutationResult<unknown, Error, { partyId: string; messageId: string }> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, { partyId: string; messageId: string }>({
		mutationFn: async ({ partyId, messageId }) =>
			getDefaultClient().deletePartyMessage(caseId, partyId, messageId),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Edit one of the operator's OWN messages on a party's thread; refreshes
 * overview. Own-only: the server 403s on a borrower message. The bubble gets an
 * "· edited" indicator. */
export function useEditMessage(
	caseId: string,
): UseMutationResult<unknown, Error, { partyId: string; messageId: string; body: string }> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, { partyId: string; messageId: string; body: string }>({
		mutationFn: async ({ partyId, messageId, body }) =>
			getDefaultClient().editPartyMessage(caseId, partyId, messageId, body),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Reissue a party's portal link (reset access code); refreshes overview. */
export function useReissueLink(caseId: string): UseMutationResult<unknown, Error, string> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, string>({
		mutationFn: async (partyId) => getDefaultClient().reissueLink(caseId, partyId),
		onSuccess: () => qc.invalidateQueries({ queryKey: overviewKey(caseId) }),
	});
}

/** Operator marks a party's borrower messages as read → flips the borrower's
 * receipt to ✓✓. Best-effort (client swallows errors); lightly refreshes the
 * overview so the operator's own view reflects the read state. */
export function useMarkThreadRead(caseId: string): UseMutationResult<unknown, Error, string> {
	const qc = useQueryClient();
	return useMutation<unknown, Error, string>({
		mutationFn: async (partyId) => getDefaultClient().markThreadRead(caseId, partyId),
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
