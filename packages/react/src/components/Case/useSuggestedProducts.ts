import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  getDefaultClient,
  type CaseEvent,
  type components,
} from "@fenero/lux-core";

import { useCaseEventsOptional } from "../../providers/CaseEventsProvider.js";

export type SuggestedProducts = components["schemas"]["SuggestedProductsResponse"];
export type ProductSuggestion = components["schemas"]["ProductSuggestionItem"];

export const suggestedProductsQueryKey = (caseId: string | null) =>
  ["lux", "case", caseId, "suggested_products"] as const;

export interface UseSuggestedProductsOptions {
  /** Override the React Query staleTime (ms). Default 60s. */
  staleTime?: number;
}

export interface UseSuggestedProductsResult {
  /** Top-ranked product ids (length 0 when stitch hasn't run yet). */
  suggestedProductIds: string[];
  /** Full ranked list with score breakdown. */
  ranked: ProductSuggestion[];
  /** Timestamp the suggestion was computed (null = not yet). */
  computedAt: string | null;
  hasSuggestion: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  query: UseQueryResult<SuggestedProducts, Error>;
}

/**
 * Read the post-stitch product suggestion for a case.
 *
 * The endpoint returns the persisted ``cases.suggested_product_ids`` (plus
 * the scoring breakdown). Stitch fires once per case-version after
 * classification finishes; until then the response is empty and the UI
 * should show the full picker instead.
 *
 * When ``<CaseEventsProvider>`` is mounted, this hook also subscribes to
 * ``case.products.suggested`` and invalidates the React Query cache so
 * the suggestion appears live as soon as it lands — no polling required.
 */
export function useSuggestedProducts(
  caseId: string | null,
  options?: UseSuggestedProductsOptions,
): UseSuggestedProductsResult {
  const staleTime = options?.staleTime ?? 60_000;
  const queryClient = useQueryClient();
  const events = useCaseEventsOptional();

  const query = useQuery({
    queryKey: suggestedProductsQueryKey(caseId),
    queryFn: () => getDefaultClient().getSuggestedProducts(caseId as string),
    enabled: !!caseId,
    staleTime,
  });

  useEffect(() => {
    if (!events || !caseId) return;
    return events.subscribe((event: CaseEvent) => {
      if (event.event_type !== "case.products.suggested") return;
      queryClient.invalidateQueries({
        queryKey: suggestedProductsQueryKey(caseId),
      });
    });
  }, [events, caseId, queryClient]);

  const data = query.data;
  const suggestedProductIds = data?.suggested_product_ids ?? [];
  const ranked = data?.ranked ?? [];
  const computedAt = data?.computed_at ?? null;

  return useMemo(
    () => ({
      suggestedProductIds,
      ranked,
      computedAt,
      hasSuggestion: suggestedProductIds.length > 0,
      isLoading: query.isLoading,
      isError: query.isError,
      error: (query.error as Error | null) ?? null,
      query,
    }),
    [
      suggestedProductIds,
      ranked,
      computedAt,
      query.isLoading,
      query.isError,
      query.error,
      query,
    ],
  );
}
