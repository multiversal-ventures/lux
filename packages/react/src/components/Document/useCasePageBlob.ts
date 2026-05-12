import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryCacheNotifyEvent, UseQueryResult } from "@tanstack/react-query";
import { getDefaultClient } from "@fenero/lux-core";

/**
 * Cache-keyed query for a single page's PNG, returned as a blob URL
 * suitable for `<img src=…>`. Uses the singleton VeritasClient
 * (`getDefaultClient`) so hosts don't need `<OperatorProvider>`.
 *
 * Object URLs are revoked when the matching React Query cache entry is
 * evicted — the GC listener is installed once per QueryClient via a
 * tag flag so re-mounting the hook many times stays cheap.
 */

function revokeEvictedBlobUrl(event: QueryCacheNotifyEvent): void {
  if (event.type !== "removed") return;
  const data = event.query.state.data as unknown;
  const key = event.query.queryKey;
  if (
    Array.isArray(key) &&
    key[0] === "lux-case-page-blob" &&
    typeof data === "string" &&
    data.startsWith("blob:")
  ) {
    URL.revokeObjectURL(data);
  }
}

export type UseCasePageBlobResult = UseQueryResult<string, Error>;

export function useCasePageBlob(
  caseId: string | null,
  fileId: string | null,
  pageNumber: number | null,
): UseCasePageBlobResult {
  const qc = useQueryClient();

  useEffect(() => {
    const tagged = qc as unknown as { __luxCasePageBlobRevokeInstalled?: boolean };
    if (tagged.__luxCasePageBlobRevokeInstalled) return;
    tagged.__luxCasePageBlobRevokeInstalled = true;
    qc.getQueryCache().subscribe(revokeEvictedBlobUrl);
  }, [qc]);

  return useQuery<string, Error>({
    queryKey: ["lux-case-page-blob", caseId, fileId, pageNumber],
    enabled: !!caseId && !!fileId && pageNumber != null && pageNumber > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const client = getDefaultClient();
      const path = client.pagePngPath(caseId as string, fileId as string, pageNumber as number);
      const blob = await client.fetchBlob(path);
      return URL.createObjectURL(blob);
    },
  });
}
