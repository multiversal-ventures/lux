import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBearerToken } from "../providers/OperatorProvider.js";

/**
 * Fetch a URL with bearer auth and return an object URL for use in <img>.
 *
 * The fetched Blob is converted to a URL via createObjectURL and cached
 * by React Query keyed on the URL string. When the query cache entry is
 * evicted (default gcTime), the corresponding object URL is revoked to
 * avoid memory leaks.
 *
 * Pass url=null to disable (no fetch, no data).
 */
export function useAuthedBlob(url: string | null) {
	const token = useBearerToken();
	const qc = useQueryClient();

	// Register a cache listener exactly once per QueryClient to revoke
	// object URLs on eviction. We tag queries we "own" with queryMeta.
	useEffect(() => {
		const tagged = (qc as unknown as { __luxRevokeInstalled?: boolean });
		if (tagged.__luxRevokeInstalled) return;
		tagged.__luxRevokeInstalled = true;

		qc.getQueryCache().subscribe((event) => {
			if (event.type !== "removed") return;
			const data = event.query.state.data;
			const key = event.query.queryKey;
			if (Array.isArray(key) && key[0] === "blob" && typeof data === "string" && data.startsWith("blob:")) {
				URL.revokeObjectURL(data);
			}
		});
	}, [qc]);

	return useQuery<string, { status: number; message: string }>({
		queryKey: ["blob", url],
		enabled: !!url,
		queryFn: async () => {
			const res = await fetch(url as string, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				throw { status: res.status, message: await res.text().catch(() => res.statusText) };
			}
			const blob = await res.blob();
			return URL.createObjectURL(blob);
		},
	});
}
