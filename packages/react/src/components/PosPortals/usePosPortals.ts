import {
	type CreatePosPortalRequest,
	type PosPortal,
	getDefaultClient,
} from "@multiversal-ventures/lux-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** Query key for this tenant's published intake links. */
export const posPortalsQueryKey = ["pos-portals"] as const;

/** What the modal actually collects: the generated create body minus
 * `expires_at`, which no operator surface offers yet. Derived from
 * {@link CreatePosPortalRequest} rather than restated, so a server-side rename
 * of either member is a type error here instead of a silent 422. */
export type CreatePosPortalInput = Pick<CreatePosPortalRequest, "product_id" | "label">;

export interface UsePosPortalsReturn {
	portals: PosPortal[];
	loading: boolean;
	/** The LIST query's error only. A failed `create` or `deactivate` does not
	 * land here — both are `mutateAsync` and reject, so the caller has to catch
	 * (the modal does, and renders the message). */
	error: Error | null;
	create: (input: CreatePosPortalInput) => Promise<PosPortal>;
	deactivate: (posPortalId: string) => Promise<PosPortal>;
	reload: () => Promise<void>;
}

/**
 * This tenant's published borrower intake links (`/api/pos-portals`), plus the
 * two writes an operator has: publish one, soft-disable one.
 *
 * Backed by react-query against the default client, like every other hook here
 * ({@link ../../hooks/useCasesList}). Both mutations invalidate the list rather
 * than patching it, because the server composes fields the client cannot
 * (the minted slug, and a `url` that depends on deployment configuration).
 *
 * The returned shape is deliberately plain — `{portals, loading, error, ...}` —
 * so a consumer can destructure `create` straight into
 * {@link NewBorrowerExperienceModal}'s `onCreate` without a react-query type
 * leaking into its props.
 */
export function usePosPortals(): UsePosPortalsReturn {
	const qc = useQueryClient();

	const query = useQuery<PosPortal[], Error>({
		queryKey: posPortalsQueryKey,
		queryFn: () => getDefaultClient().listPosPortals(),
	});

	const createMutation = useMutation<PosPortal, Error, CreatePosPortalInput>({
		mutationFn: (input) => getDefaultClient().createPosPortal(input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: posPortalsQueryKey });
		},
	});

	const deactivateMutation = useMutation<PosPortal, Error, string>({
		mutationFn: (posPortalId) => getDefaultClient().deactivatePosPortal(posPortalId),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: posPortalsQueryKey });
		},
	});

	const { refetch } = query;
	const reload = useCallback(async () => {
		await refetch();
	}, [refetch]);

	return {
		portals: query.data ?? [],
		loading: query.isPending,
		error: query.error ?? null,
		create: createMutation.mutateAsync,
		deactivate: deactivateMutation.mutateAsync,
		reload,
	};
}
