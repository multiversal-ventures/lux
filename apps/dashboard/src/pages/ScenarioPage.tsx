import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
	Loader2,
	FileText,
	Users,
	Package,
	CheckCircle,
	Clock,
	AlertCircle,
	RefreshCw,
} from "lucide-react";
import {
	caseKeys,
	useCaseResult,
	useIncomeExcel,
	useLoanProducts,
	useRefinementDetail,
	useScenarioDetail,
	useScenarioRefinements,
	useStageExcelUrl,
} from "../hooks/useCaseQueries";
import { useQueryClient } from "@tanstack/react-query";

const ACTIVE_RUN_STATUSES = new Set(["pending", "running"]);
const ACTIVE_SCENARIO_REFETCH_INTERVAL_MS = 3000;
const POST_COMPLETION_POLLING_GRACE_MS = 12000;

/**
 * ScenarioPage - Layout component for scenario routes.
 *
 * Routes:
 * - /case/:caseId/scenario/:scenarioId/summary - Full scenario summary
 * - /case/:caseId/scenario/:scenarioId/:productId - Income results for product
 * - /case/:caseId/scenario/:scenarioId/refinement/:refinementId/summary - Refinement summary
 * - /case/:caseId/scenario/:scenarioId/refinement/:refinementId/:productId - Refinement income
 */
export function ScenarioPage() {
	const { caseId, scenarioId, refinementId } = useParams<{
		caseId: string;
		scenarioId: string;
		refinementId?: string;
		productId?: string;
	}>();
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();

	// Poll scenario/refinement queries only while a run is active.
	const cachedScenarioStatus = queryClient.getQueryData<{ status?: string }>(
		caseKeys.scenarioDetail(caseId ?? "", scenarioId ?? ""),
	)?.status;
	const cachedRefinements = queryClient.getQueryData<{
		refinements?: Array<{ refinement_id: string }>;
	}>(caseKeys.scenarioRefinements(caseId ?? "", scenarioId ?? ""));
	const cachedLatestRefinementId = cachedRefinements?.refinements?.[0]?.refinement_id ?? null;
	const cachedCurrentRefinementStatus = refinementId
		? queryClient.getQueryData<{ status?: string }>(
				caseKeys.refinementDetail(caseId ?? "", scenarioId ?? "", refinementId),
			)?.status
		: null;
	const cachedLatestRefinementStatus = cachedLatestRefinementId
		? queryClient.getQueryData<{ status?: string }>(
				caseKeys.refinementDetail(caseId ?? "", scenarioId ?? "", cachedLatestRefinementId),
			)?.status
		: null;
	const isScenarioActive =
		ACTIVE_RUN_STATUSES.has(cachedScenarioStatus ?? "") ||
		ACTIVE_RUN_STATUSES.has(cachedCurrentRefinementStatus ?? "") ||
		ACTIVE_RUN_STATUSES.has(cachedLatestRefinementStatus ?? "");
	const wasScenarioActiveRef = useRef(false);
	const [postCompletionPolling, setPostCompletionPolling] = useState(false);

	useEffect(() => {
		if (isScenarioActive) {
			wasScenarioActiveRef.current = true;
			setPostCompletionPolling(false);
			return;
		}

		if (!wasScenarioActiveRef.current) return;
		wasScenarioActiveRef.current = false;
		setPostCompletionPolling(true);

		const timer = setTimeout(() => {
			setPostCompletionPolling(false);
		}, POST_COMPLETION_POLLING_GRACE_MS);

		return () => clearTimeout(timer);
	}, [isScenarioActive]);

	const scenarioRefetchInterval =
		isScenarioActive || postCompletionPolling ? ACTIVE_SCENARIO_REFETCH_INTERVAL_MS : false;

	// Determine current tab from URL
	const currentTab = useMemo(() => {
		const path = location.pathname;
		if (path.endsWith("/summary")) return "summary";
		const segments = path.split("/");
		return segments[segments.length - 1];
	}, [location.pathname]);

	// Fetch case data for document/borrower counts
	const { data: caseResult } = useCaseResult(caseId ?? "");
	const scenarioQuery = useScenarioDetail(caseId ?? null, scenarioId ?? null, {
		refetchInterval: scenarioRefetchInterval,
	});
	const loanProductsQuery = useLoanProducts();
	const refinementsQuery = useScenarioRefinements(caseId ?? null, scenarioId ?? null, {
		refetchInterval: scenarioRefetchInterval,
	});

	const latestRefinementId = refinementsQuery.data?.refinements?.[0]?.refinement_id ?? null;

	const effectiveRefinementId = refinementId ?? latestRefinementId;
	const { data: urlData } = useStageExcelUrl(caseId ?? null, {
		refinementId: effectiveRefinementId,
	});
	const { data: excelData, isLoading: excelLoading } = useIncomeExcel(
		caseId ?? null,
		urlData?.signed_url ?? null,
		{ enabled: !!caseId },
	);
	const currentRefinementQuery = useRefinementDetail(
		caseId ?? null,
		scenarioId ?? null,
		refinementId ?? null,
		{ refetchInterval: scenarioRefetchInterval },
	);
	const latestRefinementQuery = useRefinementDetail(
		caseId ?? null,
		scenarioId ?? null,
		latestRefinementId,
		{ refetchInterval: scenarioRefetchInterval },
	);

	// Refetch scenario + refinements (called after expense factor save, etc.)
	const refetchScenario = useCallback(() => {
		if (!caseId || !scenarioId) return;
		queryClient.invalidateQueries({ queryKey: caseKeys.scenarioDetail(caseId, scenarioId) });
		queryClient.invalidateQueries({ queryKey: caseKeys.scenarioRefinements(caseId, scenarioId) });
		if (refinementId) {
			queryClient.invalidateQueries({
				queryKey: caseKeys.refinementDetail(caseId, scenarioId, refinementId),
			});
		}
		if (latestRefinementId) {
			queryClient.invalidateQueries({
				queryKey: caseKeys.refinementDetail(caseId, scenarioId, latestRefinementId),
			});
		}
	}, [caseId, scenarioId, refinementId, latestRefinementId, queryClient]);

	const scenario = scenarioQuery.data ?? null;
	const loanProducts = loanProductsQuery.data?.products ?? [];
	const currentRefinement = currentRefinementQuery.data ?? null;
	const latestRefinement = latestRefinementQuery.data ?? null;
	const refinementCount = refinementsQuery.data?.refinements?.length ?? 0;

	const loading =
		scenarioQuery.isLoading || loanProductsQuery.isLoading || refinementsQuery.isLoading;
	const hasError = !!scenarioQuery.error || !!loanProductsQuery.error || !!refinementsQuery.error;

	// Get product display name
	const getProductName = (productId: string) => {
		const product = loanProducts.find((p) => p.id === productId);
		return (
			product?.display_name || productId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
		);
	};

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-slate-400" />
			</div>
		);
	}

	if (hasError || !scenario) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
					<h2 className="text-lg font-medium text-slate-800 mb-2">Scenario Not Found</h2>
					<p className="text-sm text-slate-500 mb-4">Could not load scenario details</p>
				</div>
			</div>
		);
	}

	// Status badge
	const StatusBadge = () => {
		if (scenario.status === "completed") {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
					<CheckCircle className="w-3.5 h-3.5" />
					Completed
				</span>
			);
		}
		if (scenario.status === "running") {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
					<Clock className="w-3.5 h-3.5 animate-pulse" />
					Running
				</span>
			);
		}
		return (
			<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
				{scenario.status}
			</span>
		);
	};

	const isNonQm = scenario.approach === "non_qualified_mortgage";

	// Quick stats
	const borrowerCount = scenario.borrower_ids?.length ?? 0;
	const documentCount = scenario.document_ids?.length ?? 0;
	const productCount = scenario.loan_product_ids?.length ?? 0;

	return (
		<div className="flex-1 min-h-0 overflow-auto bg-slate-50">
			<div className="max-w-6xl mx-auto py-8 px-4">
				{/* Header + Tabs + Content as connected card */}
				<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
					{/* Header */}
					<div className="px-4 py-3 border-b border-slate-100">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-4">
								<div>
									<div className="flex items-center gap-3">
										<h1 className="text-xl font-semibold text-slate-800">{scenario.name}</h1>
										<StatusBadge />
										{scenario.status === "completed" && (
											<button
												onClick={() => navigate(`/case/${caseId}/scenario/${scenarioId}/refine`)}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200"
											>
												<RefreshCw className="w-3.5 h-3.5" />
												Refine
											</button>
										)}
									</div>
									{/* Refinement info */}
									{refinementCount > 0 && (
										<p className="text-xs text-slate-500 mt-0.5">
											{currentRefinement ? (
												<>
													<span className="font-medium">
														Run #{currentRefinement.refinement_num}
													</span>
													{currentRefinement.name && <span> — {currentRefinement.name}</span>}
												</>
											) : (
												<span>
													{refinementCount} run{refinementCount !== 1 ? "s" : ""} total
												</span>
											)}
										</p>
									)}
									{scenario.status === "completed" &&
										(currentRefinement?.total_monthly_income ?? scenario.total_monthly_income) !==
											null && (
											<p className="text-2xl font-bold text-green-700 mt-1">
												$
												{(currentRefinement?.total_monthly_income ??
													scenario.total_monthly_income)!.toLocaleString("en-US", {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})}
												/mo
											</p>
										)}
								</div>
							</div>

							{/* Quick stats */}
							<div className="flex items-center gap-4 text-xs text-slate-500">
								<div className="flex items-center gap-1.5">
									<Users className="w-3.5 h-3.5" />
									<span>{borrowerCount}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<FileText className="w-3.5 h-3.5" />
									<span>{documentCount}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<Package className="w-3.5 h-3.5" />
									<span>{productCount}</span>
								</div>
							</div>
						</div>
					</div>

					{/* Tabs - Non-QM gets no product tabs (results shown inline on summary) */}
					<div className="flex items-center gap-0 px-4 bg-slate-50 border-b border-slate-200">
						<button
							onClick={() =>
								navigate(
									refinementId
										? `/case/${caseId}/scenario/${scenarioId}/refinement/${refinementId}/summary`
										: `/case/${caseId}/scenario/${scenarioId}/summary`,
								)
							}
							className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
								currentTab === "summary"
									? "text-slate-800 border-slate-800"
									: "text-slate-500 border-transparent hover:text-slate-700"
							}`}
						>
							Summary
						</button>
						{!isNonQm &&
							scenario.loan_product_ids?.map((productId) => (
								<button
									key={productId}
									onClick={() =>
										navigate(
											refinementId
												? `/case/${caseId}/scenario/${scenarioId}/refinement/${refinementId}/${productId}`
												: `/case/${caseId}/scenario/${scenarioId}/${productId}`,
										)
									}
									className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
										currentTab === productId
											? "text-slate-800 border-slate-800"
											: "text-slate-500 border-transparent hover:text-slate-700"
									}`}
								>
									{getProductName(productId)}
								</button>
							))}
					</div>

					{/* Content - rendered by nested routes */}
					<div className={currentTab === "summary" ? "p-3" : "p-0"}>
						<Outlet
							context={{
								scenario,
								caseResult,
								loanProducts,
								latestRefinement,
								currentRefinement,
								refetchScenario,
								excelWorkbook: excelData?.workbook,
								excelLoading,
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ScenarioPage;
