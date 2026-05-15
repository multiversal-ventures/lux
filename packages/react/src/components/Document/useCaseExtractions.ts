import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type ExtractionResponse } from "@multiversal-ventures/lux-core";

/**
 * Fetch extractions for one or more documents in a case. When
 * `docIds` is empty the query stays disabled. Uses the singleton
 * VeritasClient so it works in both `OperatorProvider`- and
 * `setDefaultClient`-driven hosts.
 *
 * Returns a flat array — callers that want per-doc grouping can
 * key by `extraction.doc_id`.
 */
export function useCaseExtractions(
  caseId: string | null,
  docIds: string[],
): UseQueryResult<ExtractionResponse[], Error> {
  const sortedKey = [...docIds].sort().join(",");
  return useQuery<ExtractionResponse[], Error>({
    queryKey: ["lux-case-extractions", caseId, sortedKey],
    enabled: !!caseId && docIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const client = getDefaultClient();
      const results = await Promise.all(
        docIds.map((id) => client.getCaseExtractions(caseId as string, id)),
      );
      return results.flat();
    },
  });
}
