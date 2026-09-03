import { APIError, type PosPortalCase, getDefaultClient } from "@multiversal-ventures/lux-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** Query key for one link's applications. Keyed by portal id, so expanding a
 * second link neither refetches nor evicts the first. */
export const posPortalCasesQueryKey = (posPortalId: string) =>
	["pos-portals", posPortalId, "cases"] as const;

/**
 * How a resend attempt ended, in a shape the caller can render without
 * restating any of the server's wording.
 *
 * `message` is always the server's own sentence when there was one —
 * `requestJson` lifts a FastAPI `detail` into `APIError.message`, and the
 * server composes an operator-actionable remedy for every refusal ("This link
 * has expired. Send them a new link.", "…read it to them over the phone…").
 * Duplicating those sentences here would be a second copy of the same prose in
 * a second repository, which is exactly the drift the server's machine-string
 * `CodeSendOutcome.reason` was introduced to avoid.
 *
 * What this adds on top is `kind` — the four BEHAVIOURS the four status
 * families call for, which the sentence alone does not convey:
 *
 * | kind | status | what the operator should do |
 * |---|---|---|
 * | `sent` | 200 | nothing; the code is on its way |
 * | `gone` | 404 | the case was reaped — the list is stale, refresh it |
 * | `refused` | 409 | terminal for this action; follow the remedy in `message` |
 * | `throttled` | 429 | the borrower's inbox is over its bound; try later |
 * | `undelivered` | 502 | delivery itself failed; retrying now is reasonable |
 *
 * A status outside those families (a 500, a proxy's 503, a network error with
 * no status at all) falls through to `undelivered`, because "we do not know
 * whether it went" is operationally the same instruction as a send failure:
 * try again, and do not assume the borrower has it.
 */
export type ResendOutcome = {
	kind: "sent" | "gone" | "refused" | "throttled" | "undelivered";
	message: string;
	status: number | null;
};

/** Map a thrown error onto {@link ResendOutcome}. Exported for the tests that
 * pin each status family to its own kind. */
export function resendOutcomeFromError(error: unknown): ResendOutcome {
	const status = error instanceof APIError ? error.status : null;
	const message =
		error instanceof Error && error.message
			? error.message
			: "The access code could not be re-sent.";
	if (status === 404) return { kind: "gone", message, status };
	if (status === 409) return { kind: "refused", message, status };
	if (status === 429) return { kind: "throttled", message, status };
	return { kind: "undelivered", message, status };
}

export interface UsePosPortalCasesReturn {
	cases: PosPortalCase[];
	loading: boolean;
	/** The LIST query's error only. `resend` never rejects — it resolves to a
	 * {@link ResendOutcome} — so a failed resend is not here. */
	error: Error | null;
	/** Re-send one borrower's existing access code to the address on file.
	 *
	 * Takes no destination and returns no code: the route has no request body
	 * at all, deliberately, so an operator cannot redirect a second factor to
	 * themselves. Resolves rather than rejects, because every refusal is
	 * something the operator is meant to read and act on, not an exception. */
	resend: (caseId: string, partyId: string) => Promise<ResendOutcome>;
	reload: () => Promise<void>;
}

/**
 * The applications one published link produced, plus the resend action.
 *
 * **Gated on `posPortalId` being non-null**, which is how the "do not fetch
 * until the operator asks" constraint is met at this level: passing `null`
 * mounts the hook but issues no request, so a list surface can call it once and
 * let the expanded row decide. (The surface itself is mounted only while open,
 * for the same reason `usePosPortals` is — see `PosPortalDialog` in the host.)
 *
 * These cases are invisible to the operator queue: a POS case is born
 * `awaiting_verification`, which `GET /api/cases` excludes, so this
 * sub-resource is the only client-reachable path to the `case_id`/`party_id`
 * pair the resend route is addressed by. That exclusion is deliberate and was
 * left in place; the server added a separate read rather than widening the
 * queue.
 */
export function usePosPortalCases(posPortalId: string | null): UsePosPortalCasesReturn {
	const qc = useQueryClient();

	const query = useQuery<PosPortalCase[], Error>({
		// Non-null asserted only inside `queryFn`, which react-query does not run
		// while `enabled` is false. The key still needs a value, so an unfetched
		// hook parks on a key nothing writes.
		queryKey: posPortalCasesQueryKey(posPortalId ?? "__none__"),
		queryFn: () => getDefaultClient().listPosPortalCases(posPortalId as string),
		enabled: posPortalId !== null,
	});

	const resendMutation = useMutation<ResendOutcome, never, { caseId: string; partyId: string }>({
		mutationFn: async ({ caseId, partyId }) => {
			try {
				const res = await getDefaultClient().resendAccessCode(caseId, partyId);
				return {
					kind: "sent",
					// The server's own confirmation, for the same reason the refusals
					// use theirs. It names no address and carries no code.
					message: res.detail ?? "Access code re-sent to the address on file.",
					status: 200,
				};
			} catch (e) {
				const outcome = resendOutcomeFromError(e);
				// A 404 means the case was reaped out from under this list, so what is
				// on screen is stale. Refetching is the remedy the message tells the
				// operator to expect, so do it for them rather than asking.
				if (outcome.kind === "gone" && posPortalId !== null) {
					void qc.invalidateQueries({
						queryKey: posPortalCasesQueryKey(posPortalId),
					});
				}
				return outcome;
			}
		},
	});

	const { refetch } = query;
	const reload = useCallback(async () => {
		await refetch();
	}, [refetch]);

	const { mutateAsync } = resendMutation;
	const resend = useCallback(
		(caseId: string, partyId: string) => mutateAsync({ caseId, partyId }),
		[mutateAsync],
	);

	return {
		cases: query.data ?? [],
		loading: posPortalId !== null && query.isPending,
		error: query.error ?? null,
		resend,
		reload,
	};
}
