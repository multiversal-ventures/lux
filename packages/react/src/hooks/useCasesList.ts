import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getDefaultClient, type CaseResponse } from "@multiversal-ventures/lux-core";

/**
 * Query key for the tenant case list. Keyed by limit so different page sizes
 * cache independently while still sharing the `["cases","list"]` prefix used
 * for invalidation.
 */
export function casesListQueryKey(limit: number) {
  return ["cases", "list", { limit }] as const;
}

/** Prefix matching every `casesListQueryKey(...)` variant. */
const casesListPrefix = ["cases", "list"] as const;

/**
 * Tenant case list backed by the default client (`GET /api/cases`).
 *
 * Owns the polling/staleness behaviour so consuming apps don't re-roll it.
 * Pairs with `useDeleteCase`, which optimistically removes from this cache.
 */
export function useCasesList(
  options?: { limit?: number; enabled?: boolean },
): UseQueryResult<CaseResponse[], Error> {
  const limit = options?.limit ?? 20;
  return useQuery<CaseResponse[], Error>({
    queryKey: casesListQueryKey(limit),
    queryFn: () => getDefaultClient().listTenantCases(limit),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 30_000,
  });
}

/**
 * Delete a case and keep the list cache in sync.
 *
 * The backend delete is eventually consistent — an immediate refetch can still
 * return the deleted case — so we optimistically drop the row on mutate and
 * invalidate on settle as a backstop.
 */
export function useDeleteCase(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();

  return useMutation<void, Error, string, { previous: [readonly unknown[], CaseResponse[] | undefined][] }>({
    mutationFn: (caseId: string) => getDefaultClient().deleteCase(caseId),
    onMutate: async (caseId) => {
      await qc.cancelQueries({ queryKey: casesListPrefix });
      const previous = qc.getQueriesData<CaseResponse[]>({ queryKey: casesListPrefix });
      qc.setQueriesData<CaseResponse[]>(
        { queryKey: casesListPrefix },
        (old) => (old ? old.filter((c) => c.case_id !== caseId) : old),
      );
      return { previous };
    },
    onError: (_err, _caseId, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: casesListPrefix });
    },
  });
}
