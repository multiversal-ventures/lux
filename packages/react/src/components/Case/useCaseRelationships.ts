import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient, type RelationshipInfo } from "@multiversal-ventures/lux-core";

export const caseRelationshipsQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "relationships"] as const;

export function useCaseRelationships(caseId: string | null): UseQueryResult<RelationshipInfo[]> {
  return useQuery({
    queryKey: caseRelationshipsQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseRelationships(caseId as string),
    enabled: !!caseId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
