/**
 * Centralized React Query hooks for case data.
 *
 * These hooks provide automatic request deduplication, caching, and stale-while-revalidate.
 * Multiple components using the same query share a single cached result.
 *
 * SSE events trigger cache invalidation via queryClient.invalidateQueries(),
 * which causes React Query to refetch once (not per-component).
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { read } from "xlsx";
import { APIError } from "../lib/api";
import { useCaseEventStore } from "../stores/caseEventStore";
import * as api from "./useApi";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const caseKeys = {
	all: ["case"] as const,
	list: ["cases", "list"] as const, // Tenant cases list
	loanProducts: ["loan-products"] as const,
	detail: (caseId: string) => ["case", caseId] as const,
	status: (caseId: string) => ["case", caseId, "status"] as const,
	progress: (caseId: string) => ["case", caseId, "progress"] as const,
	workflows: (caseId: string) => ["case", caseId, "workflows"] as const,
	result: (caseId: string) => ["case", caseId, "result"] as const,
	income: (caseId: string, refinementId?: string) =>
		refinementId
			? (["case", caseId, "income", refinementId] as const)
			: (["case", caseId, "income"] as const),
	stageExcelUrl: (caseId: string, productId?: string, refinementId?: string) =>
		["case", caseId, "stage-excel-url", productId ?? "all", refinementId ?? "base"] as const,
	incomeExcel: (caseId: string, stageExcelUrl?: string) =>
		["case", caseId, "income-excel", stageExcelUrl ?? ""] as const,
	credit: (caseId: string) => ["case", caseId, "credit"] as const,
	scenarios: (caseId: string) => ["case", caseId, "scenarios"] as const,
	scenarioDetail: (caseId: string, scenarioId: string) =>
		["case", caseId, "scenario", scenarioId] as const,
	scenarioRefinements: (caseId: string, scenarioId: string) =>
		["case", caseId, "scenario", scenarioId, "refinements"] as const,
	refinementDetail: (caseId: string, scenarioId: string, refinementId: string) =>
		["case", caseId, "scenario", scenarioId, "refinement", refinementId] as const,
	bankStatements: (caseId: string) => ["case", caseId, "bankStatements"] as const,
	bankTransactions: (caseId: string, options?: api.BankTransactionsOptions) =>
		["case", caseId, "bankTransactions", options] as const,
	bankReview: (caseId: string) => ["case", caseId, "bankReview"] as const,
	bankPageStats: (caseId: string) => ["case", caseId, "bankPageStats"] as const,
	bankReviewDecisions: (caseId: string) => ["case", caseId, "bankReviewDecisions"] as const,
	creditReportExtraction: (caseId: string) => ["case", caseId, "creditReportExtraction"] as const,
	creditReportExtractionOverride: (caseId: string) =>
		["case", caseId, "creditReportExtractionOverride"] as const,
	graph: (caseId: string, filtersKey: string) => ["case", caseId, "graph", filtersKey] as const,
	incomeReadiness: (caseId: string, loanProduct: string) =>
		["case", caseId, "incomeReadiness", loanProduct] as const,
	creditPullStatus: (caseId: string, workflowId: string) =>
		["case", caseId, "creditPullStatus", workflowId] as const,
	appConfig: () => ["app", "config"] as const,
	incomeAdvisorStatus: (caseId: string) => ["case", caseId, "incomeAdvisorStatus"] as const,
};

// =============================================================================
// ADAPTIVE POLLING
// =============================================================================

/**
 * Determines the appropriate polling interval based on SSE connection state.
 *
 * When SSE is connected, returns `false` (no polling needed -- SSE events
 * drive invalidation via useEventInvalidation).
 * When SSE is disconnected and a workflow is active, polls fast (5s).
 * Otherwise falls back to 30s.
 *
 * Replaces the 6+ per-component refetchInterval overrides.
 */
export function useAdaptiveRefetchInterval(): number | false {
	const streamStatus = useCaseEventStore((s) => s.streamStatus);
	if (streamStatus === "connected") return false;
	if (streamStatus === "connecting") return false;
	// SSE not connected -- fall back to polling
	return 30_000;
}

// =============================================================================
// HOOKS
// =============================================================================

// Fallback polling interval when SSE might be disconnected (30 seconds)
// This is a safety net - SSE invalidation will keep data fresh normally
const FALLBACK_REFETCH_INTERVAL = 30000;

function stableSerialize(value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) {
		return `[${value.map(stableSerialize).join(",")}]`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([k, v]) => `${k}:${stableSerialize(v)}`).join(",")}}`;
	}
	return String(value);
}

/**
 * Fetch case status with automatic caching.
 *
 * Resilient to transient 404s: the backend status cache key can
 * briefly disappear between Redis TTL resets or under memory pressure.
 * We retry 404s with backoff and keep the previous successful data
 * visible so the UI never flickers to an error state.
 */
export function useCaseStatus(
	caseId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.status(caseId ?? ""),
		queryFn: () => api.getCaseStatus(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 2000,
		refetchInterval: options?.refetchInterval ?? FALLBACK_REFETCH_INTERVAL,
		retry: (failureCount, error) => {
			if (error instanceof APIError && error.status === 404) {
				return failureCount < 3;
			}
			return failureCount < 2;
		},
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
}

/**
 * Fetch case progress (during extraction) with automatic caching.
 * Same transient-404 resilience as useCaseStatus.
 */
export function useCaseProgress(
	caseId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.progress(caseId ?? ""),
		queryFn: () => api.getCaseProgress(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 2000,
		refetchInterval: options?.refetchInterval ?? FALLBACK_REFETCH_INTERVAL,
		retry: (failureCount, error) => {
			if (error instanceof APIError && error.status === 404) {
				return failureCount < 3;
			}
			return failureCount < 2;
		},
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
	});
}

/**
 * Fetch workflow status with automatic caching.
 *
 * @param caseId - The case ID to fetch workflows for
 * @param options - Additional options
 */
export function useWorkflowStatus(
	caseId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.workflows(caseId ?? ""),
		queryFn: () => api.getWorkflowStatus(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 3000, // Consider data fresh for 3s
		// Fallback polling in case SSE is disconnected
		refetchInterval: options?.refetchInterval ?? FALLBACK_REFETCH_INTERVAL,
		refetchOnWindowFocus: "always",
		structuralSharing: false,
	});
}

/**
 * Fetch case result with automatic caching.
 *
 * @param caseId - The case ID to fetch result for
 * @param options - Additional options
 */
export function useCaseResult(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.result(caseId ?? ""),
		queryFn: () => api.getCaseResult(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 5000,
		// Always refetch on mount to ensure fresh data after extraction completes
		refetchOnMount: "always",
	});
}

/**
 * Fetch income verification result for a case.
 * Shared by CaseRow (sidebar tree) and IncomeTab; enable only when needed (e.g. when row expanded).
 * @param caseId - The case ID
 * @param refinementId - Optional refinement ID to load specific refinement results
 * @param options - Query options
 */
export function useIncomeVerification(
	caseId: string | null,
	refinementId?: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.income(caseId ?? "", refinementId ?? undefined),
		queryFn: () => api.getIncomeVerification(caseId!, refinementId ?? undefined),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 15_000,
		refetchOnWindowFocus: "always",
	});
}

/**
 * Fetch signed URL for stage Excel file (income).
 * Invalidated when caseResult changes so a fresh URL is fetched after income completes.
 * When refinementId is provided, returns Excel scoped to that refinement's results.
 */
export function useStageExcelUrl(
	caseId: string | null,
	options?: { productId?: string | null; refinementId?: string | null; enabled?: boolean },
) {
	return useQuery({
		queryKey: caseKeys.stageExcelUrl(
			caseId ?? "",
			options?.productId ?? undefined,
			options?.refinementId ?? undefined,
		),
		queryFn: () =>
			api.getStageExcelUrl(caseId!, "income", {
				product: options?.productId ?? undefined,
				refinementId: options?.refinementId ?? undefined,
			}),
		enabled: (options?.enabled ?? true) && !!caseId,
		staleTime: 30_000,
	});
}

/**
 * Fetch income Excel workbook for a case (all product sheets).
 * Requires stageExcelUrl from useStageExcelUrl; fetches from URL and parses with SheetJS.
 * Cached per case+URL so switching product tabs reuses the same workbook.
 */
export function useIncomeExcel(
	caseId: string | null,
	stageExcelUrl: string | null | undefined,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: caseKeys.incomeExcel(caseId ?? "", stageExcelUrl ?? ""),
		queryFn: async () => {
			if (!stageExcelUrl) throw new Error("No stage Excel URL");
			const response = await fetch(stageExcelUrl);
			if (!response.ok) throw new Error(`Failed to fetch Excel: ${response.status}`);
			const arrayBuffer = await response.arrayBuffer();
			const workbook = read(arrayBuffer, { type: "array", cellStyles: true });
			return { workbook, signedUrl: stageExcelUrl };
		},
		enabled: (options?.enabled ?? true) && !!caseId && !!stageExcelUrl,
	});
}

/**
 * Fetch credit verification result for a case.
 * Treats 404 (no credit run yet) as an empty state so the UI can show "Run" instead of an error.
 */
export function useCreditVerification(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.credit(caseId ?? ""),
		queryFn: async () => {
			try {
				return await api.getCreditVerification(caseId!);
			} catch (error) {
				if (error instanceof APIError && error.status === 404) {
					return {
						case_id: caseId!,
						credit_verification: null,
						credit_verifications: {},
					};
				}
				throw error;
			}
		},
		enabled: options?.enabled ?? !!caseId,
		staleTime: 15_000, // 15 seconds
		retry: (_failureCount, error) => {
			if (error instanceof APIError && error.status === 404) return false;
			return true;
		},
	});
}

/**
 * Fetch case graph data with optional filters.
 */
export function useCaseGraph(
	caseId: string | null,
	filters?: api.CaseGraphFilters,
	options?: {
		enabled?: boolean;
	},
) {
	const filtersKey = stableSerialize(filters ?? {});
	return useQuery({
		queryKey: caseKeys.graph(caseId ?? "", filtersKey),
		queryFn: () => api.getCaseGraph(caseId!, filters),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 10_000,
		refetchOnWindowFocus: false,
	});
}

/**
 * Fetch income readiness warnings for scenario setup.
 */
export function useIncomeReadiness(
	caseId: string | null,
	loanProduct: string = "fannie_mae",
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.incomeReadiness(caseId ?? "", loanProduct),
		queryFn: () => api.checkIncomeReadiness(caseId!, loanProduct),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000,
	});
}

/**
 * Fetch credit pull workflow status while pull is active.
 */
export function useCreditPullStatus(
	caseId: string | null,
	workflowId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.creditPullStatus(caseId ?? "", workflowId ?? ""),
		queryFn: () => api.getCreditPullStatus(caseId!, workflowId!),
		enabled: options?.enabled ?? (!!caseId && !!workflowId),
		staleTime: 0,
		refetchInterval: options?.refetchInterval ?? false,
		refetchOnWindowFocus: false,
	});
}

/**
 * Fetch frontend runtime app config.
 */
export function useAppConfig(options?: {
	enabled?: boolean;
}) {
	return useQuery({
		queryKey: caseKeys.appConfig(),
		queryFn: () => api.getAppConfig(),
		enabled: options?.enabled ?? true,
		staleTime: 60_000,
	});
}

/**
 * Fetch advisor workflow status for hydration.
 */
export function useIncomeAdvisorStatus(
	caseId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.incomeAdvisorStatus(caseId ?? ""),
		queryFn: () => api.getIncomeAdvisorStatus(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 2_000,
		refetchInterval: options?.refetchInterval ?? false,
		refetchOnWindowFocus: false,
	});
}

// =============================================================================
// INVALIDATION HELPERS
// =============================================================================

/**
 * Hook to get cache invalidation functions.
 * Use these to invalidate queries when SSE events arrive.
 */
export function useCaseQueryInvalidation() {
	const queryClient = useQueryClient();

	return {
		/**
		 * Invalidate all queries for a case.
		 * Use when a major state change occurs (e.g., extraction complete).
		 */
		invalidateAll: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
		},

		/**
		 * Invalidate status query for a case.
		 * Use when status changes (e.g., phase transition).
		 */
		invalidateStatus: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.status(caseId) });
		},

		/**
		 * Invalidate progress query for a case.
		 * Use when extraction progress updates.
		 */
		invalidateProgress: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.progress(caseId) });
		},

		/**
		 * Invalidate workflows query for a case.
		 * Use when workflow status changes.
		 */
		invalidateWorkflows: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.workflows(caseId) });
		},

		/**
		 * Invalidate result query for a case.
		 * Use when extraction results update.
		 * Also invalidates stage Excel URL so it refetches when case data changes.
		 */
		invalidateResult: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.result(caseId) });
			queryClient.invalidateQueries({ queryKey: ["case", caseId, "stage-excel-url"] });
		},

		/**
		 * Invalidate stage Excel URL query for a case.
		 * Use when caseResult changes.
		 */
		invalidateStageExcelUrl: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: ["case", caseId, "stage-excel-url"] });
		},

		/**
		 * Invalidate income verification query for a case.
		 * Use when income workflow completes so CaseRow and IncomeTab refetch.
		 */
		invalidateIncome: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.income(caseId) });
		},

		/**
		 * Invalidate income Excel query for a case (all products).
		 */
		invalidateIncomeExcel: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: ["case", caseId, "income-excel"] });
		},

		/**
		 * Invalidate credit verification query for a case.
		 */
		invalidateCredit: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.credit(caseId) });
		},

		/**
		 * Invalidate scenarios query for a case.
		 */
		invalidateScenarios: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.scenarios(caseId) });
		},

		/**
		 * Clear client-side credit report extraction override for a case.
		 */
		clearCreditReportExtractionOverride: (caseId: string) => {
			queryClient.removeQueries({
				queryKey: caseKeys.creditReportExtractionOverride(caseId),
				exact: true,
			});
		},

		/**
		 * Invalidate bank statements query for a case.
		 * Use when bank statement unification completes.
		 */
		invalidateBankStatements: (caseId: string) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.bankStatements(caseId) });
			// Also invalidate transactions since they depend on the same data
			queryClient.invalidateQueries({
				queryKey: ["case", caseId, "bankTransactions"],
				exact: false,
			});
		},

		/**
		 * Invalidate tenant cases list.
		 * Use when a new case is created or a case is deleted.
		 */
		invalidateCasesList: () => {
			queryClient.invalidateQueries({ queryKey: caseKeys.list });
		},
	};
}

/**
 * Fetch scenarios for a case.
 */
export function useCaseScenarios(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.scenarios(caseId ?? ""),
		queryFn: () => api.getCaseScenarios(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000, // 30 seconds
		refetchOnWindowFocus: true,
	});
}

/**
 * Fetch scenario detail for a case.
 */
export function useScenarioDetail(
	caseId: string | null,
	scenarioId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.scenarioDetail(caseId ?? "", scenarioId ?? ""),
		queryFn: () => api.getScenario(caseId!, scenarioId!),
		enabled: options?.enabled ?? (!!caseId && !!scenarioId),
		staleTime: 5_000,
		refetchInterval: options?.refetchInterval ?? false,
		refetchOnWindowFocus: true,
	});
}

/**
 * Fetch available loan products.
 */
export function useLoanProducts(options?: {
	enabled?: boolean;
}) {
	return useQuery({
		queryKey: caseKeys.loanProducts,
		queryFn: () => api.getLoanProducts(),
		enabled: options?.enabled ?? true,
		staleTime: 5 * 60_000,
	});
}

/**
 * Fetch refinements for a specific scenario.
 */
export function useScenarioRefinements(
	caseId: string | null,
	scenarioId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.scenarioRefinements(caseId ?? "", scenarioId ?? ""),
		queryFn: () => api.listRefinements(caseId!, scenarioId!),
		enabled: options?.enabled ?? (!!caseId && !!scenarioId),
		staleTime: 10_000,
		refetchInterval: options?.refetchInterval ?? false,
		refetchOnWindowFocus: true,
	});
}

/**
 * Fetch detail for a specific refinement.
 */
export function useRefinementDetail(
	caseId: string | null,
	scenarioId: string | null,
	refinementId: string | null,
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: caseKeys.refinementDetail(caseId ?? "", scenarioId ?? "", refinementId ?? ""),
		queryFn: () => api.getRefinement(caseId!, scenarioId!, refinementId!),
		enabled: options?.enabled ?? (!!caseId && !!scenarioId && !!refinementId),
		staleTime: 10_000,
		refetchInterval: options?.refetchInterval ?? false,
		refetchOnWindowFocus: true,
	});
}

// =============================================================================
// BANK STATEMENTS
// =============================================================================

/**
 * Fetch bank statement summary for a case.
 * Returns accounts, gross deposits, qualifying income, and validation issues.
 */
export function useBankStatementSummary(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.bankStatements(caseId ?? ""),
		queryFn: () => api.getBankStatementSummary(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000, // 30 seconds
	});
}

/**
 * Fetch bank transactions with optional filtering.
 * Supports filtering by account, classification, and credit/debit type.
 */
export function useBankTransactions(
	caseId: string | null,
	filterOptions?: api.BankTransactionsOptions,
	queryOptions?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.bankTransactions(caseId ?? "", filterOptions),
		queryFn: () => api.getBankTransactions(caseId!, filterOptions),
		enabled: queryOptions?.enabled ?? !!caseId,
		staleTime: 30_000, // 30 seconds
	});
}

/**
 * Fetch transactions that need human review.
 */
export function useBankReviewTransactions(caseId: string | null, options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: caseKeys.bankReview(caseId ?? ""),
		queryFn: () => api.getReviewTransactions(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000,
	});
}

/**
 * Fetch per-page extraction stats for bank statement review.
 */
export function usePageExtractionStats(caseId: string | null, options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: caseKeys.bankPageStats(caseId ?? ""),
		queryFn: () => api.getPageExtractionStats(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000,
	});
}

/**
 * Fetch persisted review decisions (dismissals, acknowledgements).
 */
export function useReviewDecisions(caseId: string | null, options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: caseKeys.bankReviewDecisions(caseId ?? ""),
		queryFn: () => api.getReviewDecisions(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000,
	});
}

/**
 * Fetch credit report extraction summary for a case.
 * Returns extracted data from credit report PDFs processed by AEU.
 */
export function useCreditReportExtraction(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	return useQuery({
		queryKey: caseKeys.creditReportExtraction(caseId ?? ""),
		queryFn: () => api.getCreditReportSummary(caseId!),
		enabled: options?.enabled ?? !!caseId,
		staleTime: 30_000, // 30 seconds
	});
}

/**
 * Read client-side credit report override for a case.
 * This query is never fetched from the server; data is written via queryClient.setQueryData.
 */
export function useCreditReportExtractionOverride(caseId: string | null) {
	return useQuery({
		queryKey: caseKeys.creditReportExtractionOverride(caseId ?? ""),
		queryFn: async () => undefined as api.CreditReportSummary | undefined,
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	});
}

/**
 * Read effective credit report summary using override-first semantics.
 * If an override exists, it is returned; otherwise server data is used.
 */
export function useEffectiveCreditReportExtraction(
	caseId: string | null,
	options?: {
		enabled?: boolean;
	},
) {
	const queryClient = useQueryClient();
	const apiQuery = useCreditReportExtraction(caseId, options);
	const overrideQuery = useCreditReportExtractionOverride(caseId);
	const effectiveData = overrideQuery.data ?? apiQuery.data;

	// Auto-clear override once real server credit report data is available.
	useEffect(() => {
		if (!caseId) return;
		if (!apiQuery.data || (apiQuery.data.credit_reports?.length ?? 0) === 0) return;
		queryClient.removeQueries({
			queryKey: caseKeys.creditReportExtractionOverride(caseId),
			exact: true,
		});
	}, [apiQuery.data, caseId, queryClient]);

	return {
		...apiQuery,
		data: effectiveData,
		isLoading: effectiveData ? false : apiQuery.isLoading,
	};
}

// =============================================================================
// TENANT CASES LIST
// =============================================================================

/**
 * Fetch list of all cases for the current tenant.
 *
 * This is cached (30s staleTime) to balance freshness with performance.
 * The backend enriches Firestore case list with Redis data (live status, borrower).
 * Multiple components (sidebar, case history) share this single cached query.
 *
 * Call invalidateCasesList() when a new case is created or deleted.
 */
export function useTenantCases(options?: {
	limit?: number;
	offset?: number;
	enabled?: boolean;
}) {
	const limit = options?.limit ?? 20;
	const offset = options?.offset ?? 0;

	return useQuery({
		queryKey: [...caseKeys.list, { limit, offset }],
		queryFn: () => api.getTenantCases(limit, offset),
		enabled: options?.enabled ?? true,
		staleTime: 30_000, // 30 seconds - faster status updates
		gcTime: 5 * 60_000, // Keep in cache for 5 minutes
		refetchOnWindowFocus: false, // Don't refetch on tab switch
		refetchInterval: 30_000, // Poll every 30s to keep status fresh
	});
}

/**
 * Batch fetch status for multiple cases.
 * Used for polling non-final cases in the sidebar.
 */
export function useCasesStatusBatch(
	caseIds: string[],
	options?: {
		enabled?: boolean;
		refetchInterval?: number | false;
	},
) {
	return useQuery({
		queryKey: ["cases", "status-batch", caseIds.sort().join(",")],
		queryFn: () => api.getCasesStatusBatch(caseIds),
		enabled: (options?.enabled ?? true) && caseIds.length > 0,
		staleTime: 5_000, // 5 seconds
		refetchInterval: options?.refetchInterval ?? 10_000, // Poll every 10s
	});
}

// =============================================================================
// MUTATIONS
// =============================================================================

interface CreateScenarioMutationInput {
	caseId: string;
	request: api.CreateScenarioRequest;
}

/**
 * Create and start a new scenario.
 * Invalidates scenario-related queries so list/detail views refresh automatically.
 */
export function useCreateScenarioMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ caseId, request }: CreateScenarioMutationInput) => {
			const createResponse = await api.createScenario(caseId, request);
			const startResponse = await api.startScenario(caseId, createResponse.scenario_id);

			if (startResponse.status !== "started") {
				throw new Error(startResponse.message || "Failed to start scenario");
			}

			return {
				...createResponse,
				workflow_id: startResponse.workflow_id,
			};
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: caseKeys.scenarios(variables.caseId) });
			queryClient.invalidateQueries({
				queryKey: caseKeys.scenarioDetail(variables.caseId, data.scenario_id),
			});
			queryClient.invalidateQueries({
				queryKey: ["case", variables.caseId, "scenario"],
			});
		},
	});
}

interface CreateRefinementMutationInput {
	caseId: string;
	scenarioId: string;
	request: api.CreateRefinementRequest;
}

/**
 * Create and start a scenario refinement.
 * Invalidates refinement/scenario queries so refinement runs appear immediately.
 */
export function useCreateRefinementMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ caseId, scenarioId, request }: CreateRefinementMutationInput) => {
			const createResponse = await api.createRefinement(caseId, scenarioId, request);
			const startResponse = await api.startRefinement(
				caseId,
				scenarioId,
				createResponse.refinement_id,
			);

			if (startResponse.status !== "started") {
				throw new Error(startResponse.message || "Failed to start refinement");
			}

			return {
				...createResponse,
				workflow_id: startResponse.workflow_id,
			};
		},
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({
				queryKey: caseKeys.scenarioRefinements(variables.caseId, variables.scenarioId),
			});
			queryClient.invalidateQueries({
				queryKey: caseKeys.scenarioDetail(variables.caseId, variables.scenarioId),
			});
			queryClient.invalidateQueries({
				queryKey: caseKeys.refinementDetail(
					variables.caseId,
					variables.scenarioId,
					data.refinement_id,
				),
			});
			queryClient.invalidateQueries({
				queryKey: caseKeys.scenarios(variables.caseId),
			});
			queryClient.invalidateQueries({
				queryKey: ["case", variables.caseId, "scenario"],
			});
		},
	});
}
