import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CaseResult, CaseStatus } from "../types";
import { caseKeys, useCaseProgress, useCaseStatus } from "./useCaseQueries";

interface UseCaseOptions {
	caseId: string | null;
	/** @deprecated - Polling is now handled by React Query with SSE invalidation */
	pollInterval?: number;
	/** @deprecated - Auto-refetch is now controlled by SSE events */
	autoRefetch?: boolean;
}

interface UseCaseResult {
	status: CaseStatus | null;
	progress: CaseResult | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

/**
 * Hook for managing case data.
 *
 * No longer uses polling - relies on SSE events triggering React Query cache invalidation.
 * This drastically reduces API calls while maintaining real-time updates.
 */
export function useCase({ caseId }: UseCaseOptions): UseCaseResult {
	const queryClient = useQueryClient();

	// Use React Query hooks - these share cache with other components
	const statusQuery = useCaseStatus(caseId);
	const progressQuery = useCaseProgress(caseId);

	// Manual refetch that invalidates cache
	const refetch = useCallback(async () => {
		if (!caseId) return;
		await queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
	}, [caseId, queryClient]);

	return {
		status: statusQuery.data ?? null,
		progress: progressQuery.data ?? null,
		loading: statusQuery.isLoading || progressQuery.isLoading,
		error: statusQuery.error?.message ?? progressQuery.error?.message ?? null,
		refetch,
	};
}
