import { useQuery, type UseQueryOptions, type UseQueryResult, type QueryKey } from "@tanstack/react-query";
import type { OperatorClient, Result } from "@fenero/lux-core";
import { useOperatorClient } from "../providers/OperatorProvider";

/**
 * Shared wrapper that turns a Result<T>-returning client method into a
 * React Query hook. Errors thrown from queryFn become Query.error.
 */
export function useOperatorQuery<T>(
	key: QueryKey,
	fetcher: (client: OperatorClient) => Promise<Result<T>>,
	opts?: Omit<UseQueryOptions<T, { status: number; message: string }>, "queryKey" | "queryFn">,
): UseQueryResult<T, { status: number; message: string }> {
	const client = useOperatorClient();
	return useQuery<T, { status: number; message: string }>({
		queryKey: key,
		queryFn: async () => {
			const res = await fetcher(client);
			if (res.error) throw res.error;
			return res.data as T;
		},
		...opts,
	});
}
