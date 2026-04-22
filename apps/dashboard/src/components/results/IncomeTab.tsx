import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
	type LoanProduct,
	getLoanProducts,
	getStageExcelUrl,
	startIncomeVerificationWithOptions,
} from "../../hooks/useApi";
import {
	caseKeys,
	useCaseQueryInvalidation,
	useIncomeVerification,
	useWorkflowStatus,
} from "../../hooks/useCaseQueries";
import { trackEvent, trackFunnelStep, trackIncomeVerificationCompleted } from "../../lib/analytics";
import type { SourceRef } from "../../types";
import { ExcelViewer, SpecResultCard, type TableComponent } from "../shared";
import { TaxYearConfidence } from "./TaxYearConfidence";

interface IncomeTabProps {
	caseId: string;
	/** Called when starting income verification - reconnects SSE stream */
	onStartVerification?: () => void;
	/** Product ID to filter results (overrides search param if provided) */
	productId?: string;
	/**
	 * Refinement ID to load results for a specific scenario run.
	 * When provided, income data is fetched via the refinement-specific
	 * endpoint instead of the generic "latest snapshot" endpoint.
	 * Pass the latest_refinement_id from the most-recently-completed
	 * scenario so the tab doesn't silently show a different scenario's results.
	 */
	refinementId?: string | null;
}

/** Ref to track manual verification start for optimistic loading state.
 * Exported so other tabs (PartiesTab, ExtractionTab) can set it before navigating here.
 */
export const verificationStartedRef = { current: false };

type IncomeRunIntent = {
	mode: "single" | "selected" | "all";
	requested_product_ids: string[];
	queued_count: number | null;
	timestamp: string;
	response_message?: string;
};

const incomeRunIntentKey = (caseId: string) => `income_run_intent:${caseId}`;
const RUN_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

function loadIncomeRunIntent(caseId: string): IncomeRunIntent | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.sessionStorage.getItem(incomeRunIntentKey(caseId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as IncomeRunIntent;
		if (!parsed || typeof parsed !== "object" || !parsed.timestamp) return null;
		const ageMs = Date.now() - Date.parse(parsed.timestamp);
		if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > RUN_INTENT_MAX_AGE_MS) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** Skeleton pulse animation component */
function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/** Skeleton for verification results (left column) */
function VerificationResultsSkeleton() {
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-6 w-40" />
				<div className="flex gap-2">
					<Skeleton className="h-6 w-24 rounded-full" />
					<Skeleton className="h-6 w-16 rounded" />
				</div>
			</div>

			{/* Summary card skeleton */}
			<div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-10 w-28" />
					</div>
					<div className="space-y-1.5 text-right">
						<Skeleton className="h-4 w-16 ml-auto" />
						<Skeleton className="h-4 w-16 ml-auto" />
					</div>
				</div>
				<Skeleton className="h-3 w-24 mt-3" />
			</div>

			{/* Party header */}
			<Skeleton className="h-5 w-32" />

			{/* Income section skeleton */}
			<div className="border border-slate-200 rounded-lg overflow-hidden">
				<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
					<div className="flex items-center justify-between">
						<div className="space-y-1.5">
							<Skeleton className="h-5 w-48" />
							<div className="flex gap-2">
								<Skeleton className="h-3 w-32" />
								<Skeleton className="h-5 w-20 rounded" />
							</div>
						</div>
						<div className="text-right space-y-1">
							<Skeleton className="h-4 w-20 ml-auto" />
							<Skeleton className="h-3 w-28 ml-auto" />
						</div>
					</div>
				</div>
				{/* Table skeleton */}
				<div className="p-4 space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-5 w-8 rounded" />
							<Skeleton className="h-4 w-20 ml-auto" />
							<Skeleton className="h-4 w-20" />
						</div>
					))}
				</div>
			</div>

			{/* Second income section skeleton */}
			<div className="border border-slate-200 rounded-lg overflow-hidden">
				<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
					<div className="flex items-center justify-between">
						<div className="space-y-1.5">
							<Skeleton className="h-5 w-56" />
							<div className="flex gap-2">
								<Skeleton className="h-3 w-36" />
								<Skeleton className="h-5 w-20 rounded" />
							</div>
						</div>
						<div className="text-right space-y-1">
							<Skeleton className="h-4 w-20 ml-auto" />
							<Skeleton className="h-3 w-28 ml-auto" />
						</div>
					</div>
				</div>
				<div className="p-4 space-y-3">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-5 w-8 rounded" />
							<Skeleton className="h-4 w-20 ml-auto" />
							<Skeleton className="h-4 w-20" />
						</div>
					))}
				</div>
			</div>

			{/* Party total skeleton */}
			<div className="p-4 bg-slate-100 border border-slate-200 rounded-lg">
				<div className="flex items-center justify-between">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-6 w-24" />
				</div>
			</div>
		</div>
	);
}

/**
 * Convert IncomeComponent to TableComponent format for SemanticTable.
 */
function toTableComponents(
	components: Array<{
		name: string;
		source_line?: string;
		sign?: string;
		y1?: number;
		y2?: number;
		ytd?: number;
		// Column values can include arrays for aggregation (e.g., "array": [0.35, 0.35])
		column_values?: Record<string, number | string | null | (number | string | null)[]>;
		render_hint?: string;
		source_refs?: SourceRef[];
		data_type?: string;
		role?: string;
		emphasis?: string;
		// Aggregation metadata for multi-entity summary
		aggregation?: string | { source: string; render_hint?: string };
	}>,
): TableComponent[] {
	return components.map((comp) => ({
		name: comp.name,
		source_line: comp.source_line,
		sign: comp.sign,
		data_type: comp.data_type || "currency",
		// Pass through column_values for v0.9.1+ column-keyed format (may include arrays)
		column_values: comp.column_values,
		// Legacy fields for backward compat
		y1: comp.y1,
		y2: comp.y2,
		ytd: comp.ytd,
		render_hint: comp.render_hint,
		source_refs: comp.source_refs,
		role: comp.role,
		emphasis: comp.emphasis,
		// Pass through aggregation metadata
		aggregation: comp.aggregation,
	}));
}

export function IncomeTab({
	caseId,
	onStartVerification,
	productId,
	refinementId,
}: IncomeTabProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [searchParams, setSearchParams] = useSearchParams();
	// Use prop if provided, otherwise fall back to search param
	const productParam = productId ?? searchParams.get("product");
	const { invalidateWorkflows, invalidateIncome, invalidateScenarios } = useCaseQueryInvalidation();

	const {
		data: incomeResponse,
		isLoading: verificationLoading,
		refetch: refetchIncome,
	} = useIncomeVerification(caseId, refinementId ?? undefined);

	// Track if auto-run was already triggered to prevent double-runs
	const autoRunTriggeredRef = useRef(false);
	// Refs for workflow effect to avoid deps that change every render (invalidateIncome/refetchIncome)
	const invalidateIncomeRef = useRef(invalidateIncome);
	const refetchIncomeRef = useRef(refetchIncome);
	const invalidateScenariosRef = useRef(invalidateScenarios);
	invalidateIncomeRef.current = invalidateIncome;
	refetchIncomeRef.current = refetchIncome;
	invalidateScenariosRef.current = invalidateScenarios;

	// Source click handler for navigating to document pages
	const handleSourceClick = useCallback(
		(ref: SourceRef) => {
			const dc = ref.document_class?.toLowerCase() ?? "";
			if (
				dc.includes("bankstatement") ||
				dc.includes("bank_statement") ||
				dc === "unifiedbankstatement"
			) {
				navigate(`/case/${caseId}/bank-statements`);
				return;
			}
			const params = new URLSearchParams({
				file: ref.file_id || "",
				page: String(ref.page_number || ""),
			});
			if (ref.fact_field_name) {
				params.set("fact", ref.fact_field_name);
			}
			navigate(`/case/${caseId}/view?${params.toString()}`);
		},
		[navigate, caseId],
	);

	const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
	const [productsSource, setProductsSource] = useState<"gcs" | "local">("local");

	// Derive verification state from React Query income result
	const verificationResult = incomeResponse?.income_verification ?? null;
	const verificationResultsByProduct = incomeResponse?.income_verifications ?? {};
	const productsRun = incomeResponse?.products_run ?? [];
	const primaryProductId = incomeResponse?.primary_product_id ?? null;

	const [runIntent, setRunIntent] = useState<IncomeRunIntent | null>(() =>
		loadIncomeRunIntent(caseId),
	);

	// Export teaser modal state
	const [showExportModal, setShowExportModal] = useState(false);
	const [excelDownloading, setExcelDownloading] = useState<string | null>(null);

	// Excel viewer modal state
	const [excelViewerData, setExcelViewerData] = useState<{
		signedUrl: string;
		filename: string;
		productId: string;
	} | null>(null);

	// Open Excel viewer modal
	const handleExcelDownload = useCallback(
		async (productId: string) => {
			setExcelDownloading(productId);
			try {
				const response = await queryClient.fetchQuery({
					queryKey: caseKeys.stageExcelUrl(caseId, productId),
					queryFn: () =>
						getStageExcelUrl(caseId, "income", {
							product: productId,
						}),
					staleTime: 30_000,
				});
				// Open Excel viewer modal instead of downloading directly
				setExcelViewerData({
					signedUrl: response.signed_url,
					filename: response.filename,
					productId,
				});
				trackEvent("excel_viewer_opened", {
					case_id: caseId,
					stage: "income",
					product_id: productId,
				});
			} catch (error) {
				console.error("Excel download failed:", error);
				// Fall back to showing the teaser modal if Excel not available
				setShowExportModal(true);
				trackEvent("excel_download_failed", {
					case_id: caseId,
					stage: "income",
					product_id: productId,
				});
			} finally {
				setExcelDownloading(null);
			}
		},
		[caseId, queryClient],
	);

	// Load loan products (for display names and StartIncomeVerification)
	useEffect(() => {
		getLoanProducts()
			.then((productsResponse) => {
				setLoanProducts(productsResponse.products);
				setProductsSource(productsResponse.source);
				setRunIntent(loadIncomeRunIntent(caseId));
			})
			.catch((err) => console.error("Failed to load loan products:", err));
	}, [caseId]);

	// Use React Query for workflow status (no polling - relies on SSE invalidation)
	const { data: workflowStatus, isLoading: workflowStatusLoading } = useWorkflowStatus(caseId);
	const incomeWorkflow = workflowStatus?.workflows.find((w) => w.workflow_type === "income");

	// Check if we were just redirected from scenario creation (URL param indicates workflow was just started)
	const justStartedScenario = searchParams.get("started") === "true";

	// Verification in-progress state - initialize based on workflow status or if just started
	const [isVerifying, setIsVerifying] = useState(
		() => incomeWorkflow?.status === "running" || justStartedScenario,
	);
	const [verifyError, setVerifyError] = useState<string | null>(null);

	// Clear the 'started' param after initial mount to prevent re-showing loader on refresh
	useEffect(() => {
		if (justStartedScenario) {
			const newParams = new URLSearchParams(searchParams);
			newParams.delete("started");
			setSearchParams(newParams, { replace: true });
			// Also set isVerifying true in case initial state didn't catch it
			setIsVerifying(true);
		}
	}, [justStartedScenario, searchParams, setSearchParams]);

	// Auto-run verification when navigated from other tabs with ?autoRun=true
	useEffect(() => {
		const shouldAutoRun = searchParams.get("autoRun") === "true";
		const selectedProductsParam = searchParams.get("selectedProducts");
		const runAllProductsParam = searchParams.get("runAllProducts");
		const loanProductIdParam = searchParams.get("loanProductId");
		const resultStorageModeParam = searchParams.get("resultStorageMode");

		if (shouldAutoRun && !autoRunTriggeredRef.current) {
			autoRunTriggeredRef.current = true;

			// Clear auto-run params from URL (prevents re-run on refresh)
			const newParams = new URLSearchParams(searchParams);
			newParams.delete("autoRun");
			newParams.delete("selectedProducts");
			newParams.delete("runAllProducts");
			newParams.delete("loanProductId");
			newParams.delete("resultStorageMode");
			setSearchParams(newParams, { replace: true });

			// Start verification (same as clicking Rerun)
			console.debug("[IncomeTab] Auto-run triggered from navigation");
			verificationStartedRef.current = true;
			setIsVerifying(true);
			setVerifyError(null);
			onStartVerification?.();

			const resultStorageMode = resultStorageModeParam === "separate" ? "separate" : "combined";
			const selectedProducts = selectedProductsParam
				? selectedProductsParam
						.split(",")
						.map((id) => id.trim())
						.filter(Boolean)
				: [];
			const shouldRunAll =
				runAllProductsParam === "true" || (!selectedProducts.length && !loanProductIdParam);

			// Auto-run payload priority: selected subset > explicit single > run all (default).
			const requestPayload =
				selectedProducts.length > 0
					? {
							selected_products: selectedProducts,
							loan_product_id: selectedProducts[0],
							result_storage_mode: resultStorageMode as "combined" | "separate",
						}
					: loanProductIdParam && !shouldRunAll
						? {
								loan_product_id: loanProductIdParam,
								result_storage_mode: resultStorageMode as "combined" | "separate",
							}
						: {
								run_all_products: true,
								result_storage_mode: resultStorageMode as "combined" | "separate",
							};
			startIncomeVerificationWithOptions(caseId, requestPayload)
				.then((response) => {
					if (response.status !== "started") {
						setVerifyError(response.message || "Failed to start verification");
						setIsVerifying(false);
						verificationStartedRef.current = false;
					} else {
						// Workflow started - invalidate to trigger status refetch
						invalidateWorkflows(caseId);
					}
				})
				.catch((err) => {
					console.error("Auto-run verification failed:", err);
					setVerifyError(err instanceof Error ? err.message : "Failed to start verification");
					setIsVerifying(false);
					verificationStartedRef.current = false;
				});
		}
	}, [searchParams, setSearchParams, caseId, onStartVerification, invalidateWorkflows]);

	// Poll workflow status while verification is in progress
	// This ensures we catch completion even if SSE isn't connected
	useEffect(() => {
		if (!isVerifying) return;

		const pollInterval = setInterval(() => {
			console.debug("[IncomeTab] Polling workflow status");
			invalidateWorkflows(caseId);
		}, 2000); // Poll every 2 seconds

		return () => clearInterval(pollInterval);
	}, [isVerifying, caseId, invalidateWorkflows]);

	// Track previous workflow status to detect transitions
	const prevStatusRef = useRef<string | undefined>(incomeWorkflow?.status);

	// React to workflow status changes (SSE triggers React Query invalidation)
	useEffect(() => {
		const prevStatus = prevStatusRef.current;
		const currentStatus = incomeWorkflow?.status;

		// Always update ref
		prevStatusRef.current = currentStatus;

		// Detect status transitions OR initial mount with running workflow
		const statusChanged = prevStatus !== currentStatus;
		const isInitialMount = prevStatus === undefined && currentStatus !== undefined;

		// Skip if no change and not initial mount
		if (!statusChanged && !isInitialMount) return;

		setRunIntent(loadIncomeRunIntent(caseId));

		const invalidateIncomeFn = invalidateIncomeRef.current;
		const refetchIncomeFn = refetchIncomeRef.current;
		const invalidateScenariosFn = invalidateScenariosRef.current;

		const handleWorkflowChange = async () => {
			if (currentStatus === "running") {
				// Workflow is running - show skeleton and clear any previous errors
				if (!isVerifying) {
					console.debug("[IncomeTab] Workflow running - showing loading state");
					setIsVerifying(true);
					setVerifyError(null);
				}
			} else if (currentStatus === "completed") {
				// Workflow completed - always refetch income so the page updates even when
				// verification was started elsewhere (another tab/user/session).
				verificationStartedRef.current = false;
				// Invalidate scenarios so sidebar shows updated status
				invalidateScenariosFn(caseId);
				refetchIncomeFn()
					.then((queryResult) => {
						const result = queryResult.data;
						if (result?.income_verification) {
							if (result.income_verification.status === "error") {
								setVerifyError("Income verification failed");
								trackIncomeVerificationCompleted({ case_id: caseId, success: false });
							} else {
								trackIncomeVerificationCompleted({
									case_id: caseId,
									success: true,
									total_income: result.income_verification.combined_qualifying,
								});
								trackFunnelStep({ case_id: caseId, step: "income_completed" });
							}
						}
					})
					.catch((err) => {
						console.debug("Could not fetch verification result:", err);
						setVerifyError("Failed to fetch verification results");
						trackIncomeVerificationCompleted({ case_id: caseId, success: false });
					})
					.finally(() => setIsVerifying(false));
			} else if (
				currentStatus === "failed" ||
				currentStatus === "terminated" ||
				currentStatus === "timed_out"
			) {
				// Workflow failed/terminated/timed out - refetch to get error details
				if (isVerifying || verificationStartedRef.current) {
					console.debug(`[IncomeTab] Workflow ${currentStatus} - showing error`);
					verificationStartedRef.current = false;
					refetchIncomeFn()
						.then((queryResult) => {
							const result = queryResult.data;
							if (result?.income_verification?.verification_flags?.length) {
								setVerifyError(result.income_verification.verification_flags.join("; "));
							} else {
								setVerifyError(`Income verification ${currentStatus.replace("_", " ")}`);
							}
						})
						.catch(() => setVerifyError(`Income verification ${currentStatus?.replace("_", " ")}`))
						.finally(() => setIsVerifying(false));
				}
			} else if (currentStatus === "cancelled") {
				// Workflow was cancelled - hide skeleton
				console.debug("[IncomeTab] Workflow cancelled");
				verificationStartedRef.current = false;
				setIsVerifying(false);
				setVerifyError(null);
			} else if (!incomeWorkflow) {
				// No income workflow running - hide skeleton; income query will serve existing results
				if (isVerifying || verificationStartedRef.current) {
					console.debug("[IncomeTab] No workflow found - clearing loading state");
					verificationStartedRef.current = false;
					invalidateIncomeFn(caseId);
					setIsVerifying(false);
				}
			}
		};

		handleWorkflowChange();
	}, [caseId, incomeWorkflow?.status, isVerifying]);

	// Synchronization effect: Ensure isVerifying matches workflow status
	// This handles race conditions when opening multiple tabs or fast workflow starts
	useEffect(() => {
		const currentStatus = incomeWorkflow?.status;

		// If workflow is running but isVerifying is false, sync it
		if (currentStatus === "running" && !isVerifying) {
			console.debug("[IncomeTab] Syncing loading state - workflow is running");
			setIsVerifying(true);
			setVerifyError(null);
		}

		// If workflow is not running but isVerifying is true, sync it
		// BUT skip if we just manually started verification (verificationStartedRef)
		if (
			currentStatus &&
			currentStatus !== "running" &&
			isVerifying &&
			!verificationStartedRef.current
		) {
			console.debug("[IncomeTab] Syncing loading state - workflow completed/failed");
			setIsVerifying(false);
		}
	}, [incomeWorkflow?.status, isVerifying]);

	useEffect(() => {
		if (verifyError) {
			console.error({ verifyError });
		}
	}, [verifyError]);

	const enabledProductCount = loanProducts.filter((p) => p.enabled).length;
	const expectedProductsCount = useMemo(() => {
		if (!runIntent) return null;
		if (runIntent.queued_count && runIntent.queued_count > 0) return runIntent.queued_count;
		if (runIntent.mode === "selected") return runIntent.requested_product_ids.length;
		if (runIntent.mode === "single") return 1;
		return enabledProductCount > 0 ? enabledProductCount : null;
	}, [runIntent, enabledProductCount]);

	const queuedProductCount = expectedProductsCount || enabledProductCount || 1;

	const productNameById = useMemo(() => {
		return new Map(loanProducts.map((product) => [product.id, product.display_name]));
	}, [loanProducts]);

	const detailedProductResults = useMemo(() => {
		const entries = Object.entries(verificationResultsByProduct).map(([productId, result]) => ({
			productId,
			productName: productNameById.get(productId) || productId,
			result,
		}));

		if (entries.length === 0 && verificationResult) {
			const fallbackProductId = primaryProductId || verificationResult.loan_type || "primary";
			return [
				{
					productId: fallbackProductId,
					productName: productNameById.get(fallbackProductId) || fallbackProductId,
					result: verificationResult,
				},
			];
		}

		const sortOrder =
			productsRun.length > 0 ? productsRun : entries.map((entry) => entry.productId);
		const orderIndex = new Map(sortOrder.map((productId, index) => [productId, index]));

		return entries.sort((a, b) => {
			return (
				(orderIndex.get(a.productId) ?? Number.MAX_SAFE_INTEGER) -
				(orderIndex.get(b.productId) ?? Number.MAX_SAFE_INTEGER)
			);
		});
	}, [
		verificationResultsByProduct,
		verificationResult,
		primaryProductId,
		productNameById,
		productsRun,
	]);

	// When ?product= is set, show only that product's card
	const displayedProductResults = useMemo(() => {
		if (!productParam) return detailedProductResults;
		return detailedProductResults.filter((entry) => entry.productId === productParam);
	}, [detailedProductResults, productParam]);

	const showZeroIncomeDebug =
		!!verificationResult &&
		detailedProductResults.length <= 1 &&
		verificationResult.combined_qualifying === 0 &&
		verificationResult.parties?.length === 0;

	const actualProductsCount = detailedProductResults.length;
	const showMultiProductExecutionWarning =
		!!verificationResult &&
		!!expectedProductsCount &&
		expectedProductsCount > 1 &&
		actualProductsCount === 1;

	return (
		<div className="h-full overflow-auto p-6 relative">
			{/* Full-screen Verification Loading Overlay - show when verifying, workflow status loading, or just started */}
			{(isVerifying || (workflowStatusLoading && !verificationResult)) && (
				<div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-sm flex items-center justify-center">
					<div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full mx-4 text-center">
						<div className="relative w-20 h-20 mx-auto mb-6">
							{/* Outer ring */}
							<div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
							{/* Spinning ring */}
							<div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
							{/* Inner icon */}
							<div className="absolute inset-0 flex items-center justify-center">
								<svg
									className="w-8 h-8 text-blue-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
									/>
								</svg>
							</div>
						</div>
						<h3 className="text-xl font-semibold text-slate-800 mb-2">Verifying Income</h3>
						<p className="text-sm text-slate-500 mb-4">
							Running income rules for selected loan products...
						</p>
						<div className="flex items-center justify-center gap-2 text-xs text-slate-400">
							<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
							<span>Products queued: {queuedProductCount || "loading..."}</span>
						</div>
					</div>
				</div>
			)}

			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-slate-800">
							Income Verification
							{displayedProductResults.length === 1 && (
								<span className="font-medium text-slate-600">
									{" "}
									— {displayedProductResults[0].productName}
								</span>
							)}
						</h1>
						<p className="text-sm text-slate-500 mt-1">
							Calculate qualifying income using agency-specific verifiable agents.
						</p>
					</div>
					<div className="flex items-center gap-3">
						{productsSource === "gcs" && (
							<span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
								GCS
							</span>
						)}
					</div>
				</div>

				{/* Two Column Layout */}
				<div className="flex gap-6">
					{/* LEFT COLUMN: Verification Results */}
					<div className="flex-1 min-w-0">
						{verificationLoading || isVerifying ? (
							<VerificationResultsSkeleton />
						) : showZeroIncomeDebug ? (
							// No real results - show debug info
							<div className="bg-white rounded-xl border border-slate-200 p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-medium text-slate-800">Verification Debug</h2>
									<span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
										No Income Calculated
									</span>
								</div>
								<div className="space-y-4">
									<div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
										<h4 className="text-sm font-medium text-amber-800 mb-2">
											Why is income $0.00?
										</h4>
										<p className="text-sm text-amber-700 mb-3">
											The income verification workflow ran but couldn't calculate income. This
											usually means:
										</p>
										<ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
											<li>Extracted facts don't match the agent specification</li>
											<li>Required data from files were missing</li>
											<li>No income documents were extracted</li>
											<li>The agent was unable to calculate income</li>
											<li>Review the documents / overview page to see what data was extracted</li>{" "}
											(Add a link to the documents / overview page)
											<li>
												Review the agent's output to see what data was used to calculate income
											</li>{" "}
											(Add a link to the agent's output)
											<li>
												Review the agent's output to see what data was used to calculate income
											</li>{" "}
											(Add a link to the agent's output)
										</ul>
									</div>

									<div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
										<h4 className="text-sm font-medium text-slate-700 mb-2">
											Verification Details
										</h4>
										<dl className="grid grid-cols-2 gap-2 text-sm">
											<dt className="text-slate-500">Loan Type:</dt>
											<dd className="text-slate-700">{verificationResult.loan_type}</dd>
											<dt className="text-slate-500">Rules Version:</dt>
											<dd className="text-slate-700">{verificationResult.rules_version}</dd>
											<dt className="text-slate-500">Status:</dt>
											<dd className="text-slate-700">{verificationResult.status}</dd>
											<dt className="text-slate-500">Method:</dt>
											<dd className="text-slate-700">
												{verificationResult.method || "None determined"}
											</dd>
										</dl>
									</div>

									{verificationResult.verification_flags &&
										verificationResult.verification_flags.length > 0 && (
											<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
												<h4 className="text-sm font-medium text-red-800 mb-2">Errors/Warnings</h4>
												<ul className="space-y-1">
													{verificationResult.verification_flags.map((flag, idx) => (
														<li key={idx} className="text-sm text-red-700">
															{flag}
														</li>
													))}
												</ul>
											</div>
										)}
								</div>
							</div>
						) : verificationResult ? (
							<div className="space-y-6">
								{showMultiProductExecutionWarning && (
									<div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
										<h4 className="text-sm font-semibold text-amber-800">
											Single-product execution detected
										</h4>
										<p className="text-sm text-amber-700 mt-1">
											Requested {expectedProductsCount} product runs, but this workflow returned 1
											product result. This usually means the running API/worker services are still
											on older single-product code.
										</p>
									</div>
								)}
								{displayedProductResults.map(
									({ productId, productName, result: productResult }) => (
										<div
											key={`${productId}-${productResult.rules_version}`}
											className="bg-white rounded-xl border border-slate-200 p-6"
										>
											<div className="flex items-center justify-between mb-4">
												<div>
													<h2 className="text-lg font-medium text-slate-800">
														Verification Results
													</h2>
													{displayedProductResults.length > 1 && (
														<div className="mt-1 text-xs text-slate-500">
															Product:{" "}
															<span className="font-medium text-slate-700">{productName}</span>
															{primaryProductId === productId && (
																<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700">
																	Primary
																</span>
															)}
														</div>
													)}
												</div>
												<div className="flex items-center gap-2">
													{productResult.trend && (
														<span
															className={`px-2 py-1 text-xs font-medium rounded ${
																productResult.trend === "increasing"
																	? "bg-green-100 text-green-700"
																	: productResult.trend === "stable"
																		? "bg-blue-100 text-blue-700"
																		: "bg-amber-100 text-amber-700"
															}`}
														>
															{productResult.trend.charAt(0).toUpperCase() +
																productResult.trend.slice(1)}{" "}
															Trend
														</span>
													)}
													<span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
														v{productResult.rules_version}
													</span>
													<button
														onClick={() => handleExcelDownload(productId)}
														disabled={excelDownloading === productId}
														className="px-3 py-1.5 ml-2 rounded font-medium text-xs text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
														title="Download Excel config for this product"
													>
														{excelDownloading === productId ? (
															<svg
																className="w-3.5 h-3.5 animate-spin"
																fill="none"
																viewBox="0 0 24 24"
															>
																<circle
																	className="opacity-25"
																	cx="12"
																	cy="12"
																	r="10"
																	stroke="currentColor"
																	strokeWidth="4"
																/>
																<path
																	className="opacity-75"
																	fill="currentColor"
																	d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																/>
															</svg>
														) : (
															<svg
																className="w-3.5 h-3.5"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
																/>
															</svg>
														)}
														{excelDownloading === productId ? "..." : "Excel"}
													</button>
												</div>
											</div>

											{productResult.status === "completed" ? (
												<div className="space-y-6">
													{/* Summary Card */}
													<div className="p-4 bg-green-50 border border-green-200 rounded-lg">
														<div className="flex items-center justify-between">
															<div>
																<div className="text-sm text-green-700 font-medium">
																	Monthly Qualifying Income
																</div>
																<div className="text-3xl font-bold text-green-800">
																	$
																	{productResult.combined_qualifying.toLocaleString("en-US", {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	})}
																</div>
															</div>
															<div className="text-right">
																<div className="text-sm text-green-700">
																	{/* Ascending year order: prior year first, then current */}
																	<div>
																		{productResult.year_2 || "Y2"}: $
																		{productResult.combined_total_y2?.toLocaleString("en-US") ||
																			"0"}
																	</div>
																	<div>
																		{productResult.year_1 || "Y1"}: $
																		{productResult.combined_total_y1?.toLocaleString("en-US") ||
																			"0"}
																	</div>
																</div>
																<div className="mt-1">
																	<TaxYearConfidence caseId={caseId} />
																</div>
															</div>
														</div>
														{productResult.method && (
															<div className="mt-2 text-xs text-green-600">
																Method:{" "}
																{productResult.method.replace(/_/g, " ").replace("method ", "")}
															</div>
														)}
													</div>

													{/* Party Income Sections */}
													{productResult.parties?.map((party) => (
														<div key={party.party_id} className="space-y-4">
															<h3 className="font-medium text-slate-800">{party.name}</h3>

															{/* Income Sections (ordered by priority) */}
															{party.sections
																.sort((a, b) => a.priority - b.priority)
																.map((section) => {
																	// Both multi-entity and single-entity use SpecResultCard
																	// SpecResultCard handles multi-entity via entities prop
																	return (
																		<SpecResultCard
																			key={section.spec_file}
																			tableName={section.table_name}
																			specFile={section.spec_file}
																			specVersion={section.spec_version}
																			ruleRef={section.rule_ref}
																			ruleUrl={section.rule_url}
																			isAggregator={section.is_aggregator}
																			skipped={section.skipped}
																			skipReason={section.skip_reason}
																			outcome={section.outcome}
																			guidance={section.guidance}
																			components={toTableComponents(section.components || [])}
																			columns={section.table_config?.columns}
																			groups={section.table_config?.groups || undefined}
																			y1Year={section.y1_year || productResult.year_1 || "Y1"}
																			y2Year={section.y2_year || productResult.year_2 || "Y2"}
																			subtotalY1={section.subtotal_y1}
																			subtotalY2={section.subtotal_y2}
																			subtotalMonthly={section.subtotal_monthly}
																			calculationSteps={section.calculation_steps}
																			proofTrace={section.proof_trace}
																			evidenceRaw={section.evidence_raw}
																			matchingRules={section.matching_rules}
																			dedupExcluded={section.dedup_excluded}
																			onSourceClick={handleSourceClick}
																			caseId={caseId}
																			// Multi-entity props (v0.10.0)
																			entities={section.entities?.map((entity) => ({
																				id: entity.entity_id,
																				name: entity.entity_name,
																				type: entity.entity_type,
																				components: toTableComponents(
																					(entity.components as any) || [],
																				),
																				derivations: entity.derivations || {},
																			}))}
																			aggregate={
																				section.aggregate
																					? {
																							values: section.aggregate.values,
																							components: toTableComponents(
																								(section.aggregate.components as any) || [],
																							),
																						}
																					: undefined
																			}
																			entityType={section.entity_config?.type}
																		/>
																	);
																})}

															{/* Party Total */}
															<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
																<div className="flex items-center justify-between">
																	<div className="text-sm text-blue-700 font-medium">
																		Total for {party.name}
																	</div>
																	<div className="text-xl font-bold text-blue-800">
																		$
																		{party.qualifying_monthly.toLocaleString("en-US", {
																			minimumFractionDigits: 2,
																			maximumFractionDigits: 2,
																		})}
																		/mo
																	</div>
																</div>
															</div>
														</div>
													))}

													{/* Verification Flags */}
													{productResult.verification_flags &&
														productResult.verification_flags.length > 0 && (
															<div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
																<h4 className="text-sm font-medium text-amber-800 mb-2">
																	Verification Flags
																</h4>
																<ul className="space-y-1">
																	{productResult.verification_flags.map((flag, idx) => (
																		<li
																			key={idx}
																			className="text-sm text-amber-700 flex items-center gap-2"
																		>
																			<svg
																				className="w-4 h-4"
																				fill="none"
																				viewBox="0 0 24 24"
																				stroke="currentColor"
																			>
																				<path
																					strokeLinecap="round"
																					strokeLinejoin="round"
																					strokeWidth={2}
																					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
																				/>
																			</svg>
																			{flag}
																		</li>
																	))}
																</ul>
															</div>
														)}
												</div>
											) : productResult.status === "error" ? (
												<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
													<div className="text-red-700 font-medium mb-2">Verification Failed</div>
													{productResult.verification_flags?.map((err, idx) => (
														<div key={idx} className="text-sm text-red-600">
															{err}
														</div>
													))}
												</div>
											) : (
												<div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
													Verification in progress...
												</div>
											)}
										</div>
									),
								)}
								{productParam &&
									displayedProductResults.length === 0 &&
									detailedProductResults.length > 0 && (
										<div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-600">
											Product not found: <span className="font-medium">{productParam}</span>
										</div>
									)}
							</div>
						) : (
							/* No verification results yet - show placeholder */
							<div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
								<div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
									<svg
										className="w-8 h-8 text-slate-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={1.5}
											d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
										/>
									</svg>
								</div>
								<h3 className="text-lg font-medium text-slate-700 mb-2">No Verification Results</h3>
								<p className="text-sm text-slate-500 max-w-sm">
									Run verification to calculate qualifying income across all enabled loan products
									based on extracted documents.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Excel Viewer Modal */}
			{excelViewerData && (
				<ExcelViewer
					signedUrl={excelViewerData.signedUrl}
					filename={excelViewerData.filename}
					stage="income"
					onClose={() => setExcelViewerData(null)}
				/>
			)}

			{/* Export Teaser Modal */}
			{showExportModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
						{/* Close button */}
						<button
							onClick={() => setShowExportModal(false)}
							className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>

						{/* Icon */}
						<div className="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
							<svg
								className="w-7 h-7 text-orange-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>

						{/* Content */}
						<h3 className="text-xl font-semibold text-slate-800 text-center mb-2">
							Export Reports Coming Soon
						</h3>
						<p className="text-slate-600 text-center mb-6">
							We're working on detailed income reports in PDF and Excel formats. Want early access?
						</p>

						{/* CTA */}
						<div className="space-y-3">
							<button
								type="button"
								className="block w-full px-4 py-3 bg-cta text-white font-semibold rounded-lg text-center hover:bg-cta-hover transition-colors"
								onClick={() => {
									trackEvent("export_contact_clicked", { case_id: caseId });
									window.location.href =
										"mailto:support@fenero.ai?subject=Export%20Reports%20-%20Early%20Access&body=Hi%2C%20I'd%20like%20early%20access%20to%20income%20export%20reports.";
								}}
							>
								Contact Us for Early Access
							</button>
							<button
								onClick={() => setShowExportModal(false)}
								className="block w-full px-4 py-2 text-slate-600 font-medium text-center hover:text-slate-800"
							>
								Maybe Later
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
