import { useAuth } from "@fenero/lux-react";
import {
	Building2,
	ChartColumn,
	ChevronDown,
	ChevronUp,
	CreditCard,
	Download,
	FileText,
	Loader2,
	Plus,
	RefreshCw,
	ShieldCheck,
	Upload,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { startIncomeVerification } from "../../hooks/useApi";
import type { RefinementSummary, ScenarioSummary } from "../../hooks/useApi";
import {
	useBankStatementSummary,
	useCaseQueryInvalidation,
	useCaseResult,
	useCaseScenarios,
	useCreditReportExtraction,
	useIncomeVerification,
	useScenarioRefinements,
	useWorkflowStatus,
} from "../../hooks/useCaseQueries";
import { apiRequest } from "../../lib/api";
import { useAppDispatch, useAppSelector } from "../../store";
import { setSelectedLoanProduct, toggleDocumentsSidebar } from "../../store/appSlice";
import { ExcelViewer } from "../shared/ExcelViewer";

const ACTIVE_SCENARIO_STATUSES = new Set(["running"]);
const ACTIVE_REFINEMENT_POLL_MS = 3000;

interface CaseDetailSidebarProps {
	isExtractionInProgress: boolean;
	hasStatus?: boolean;
	hasError?: boolean;
	onUploadClick?: () => void;
}

export function CaseDetailSidebar({
	onUploadClick,
	isExtractionInProgress,
	hasStatus = true,
	hasError = false,
}: CaseDetailSidebarProps) {
	const { tenantId } = useAuth();
	const { caseId } = useParams<{ caseId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useAppDispatch();

	// Get selected refinement from URL path (e.g., /scenario/X/refinement/Y/summary)
	const selectedRefinementId = useMemo(() => {
		const match = location.pathname.match(/\/refinement\/([^/]+)/);
		return match ? match[1] : null;
	}, [location.pathname]);
	const collapsed = useAppSelector((state) => state.app.documentsSidebarCollapsed);

	const { data: caseResult } = useCaseResult(caseId ?? null);
	const { data: workflowStatus } = useWorkflowStatus(caseId ?? null);
	const { data: incomeData } = useIncomeVerification(caseId ?? null, undefined);
	const { data: scenariosData } = useCaseScenarios(caseId ?? null);
	const { data: bankStatementSummary } = useBankStatementSummary(caseId ?? null);
	const { data: creditReportSummary } = useCreditReportExtraction(caseId ?? null);
	const { invalidateAll } = useCaseQueryInvalidation();
	const scenarios = scenariosData?.scenarios ?? [];

	// Check if we're on the bank statements page
	const isBankStatementsPage = location.pathname.endsWith("/bank-statements");
	const bankStatementCount = bankStatementSummary?.statement_count ?? 0;

	// Check if we're on the credit report page
	const isCreditReportPage = location.pathname.endsWith("/credit-report");
	const isRatiosPage = location.pathname.endsWith("/ratios");
	const isComparePage = location.pathname.endsWith("/compare");
	const isCompliancePage = location.pathname.endsWith("/compliance");
	const creditReportCount = creditReportSummary?.credit_reports?.length ?? 0;
	const tradeAccountCount = creditReportSummary?.total_trade_accounts ?? 0;

	const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
	const expandedScenarioStatus =
		scenarios.find((scenario) => scenario.scenario_id === expandedScenario)?.status ?? null;
	const hasActiveExpandedScenarioRun =
		expandedScenarioStatus !== null && ACTIVE_SCENARIO_STATUSES.has(expandedScenarioStatus);

	// Fetch refinements for the expanded scenario
	const { data: refinementsData } = useScenarioRefinements(caseId ?? null, expandedScenario, {
		enabled: !!caseId && !!expandedScenario,
		refetchInterval: hasActiveExpandedScenarioRun ? ACTIVE_REFINEMENT_POLL_MS : false,
	});
	const [documentsExpanded, setDocumentsExpanded] = useState(false);
	const [extractionDownloading, setExtractionDownloading] = useState(false);
	const [reExtracting, setReExtracting] = useState(false);
	const [excelViewerData, setExcelViewerData] = useState<{
		signedUrl: string;
		filename: string;
		stage: string;
	} | null>(null);

	// Get document count from case result
	const fileCount = caseResult?.artifacts?.files?.length ?? 0;

	// Check if income workflow is running
	const incomeWorkflow = workflowStatus?.workflows?.find((w) => w.workflow_type === "income");
	const isIncomeWorkflowRunning = incomeWorkflow?.status === "running";

	const hasActiveScenarioRun = scenarios.some((scenario) =>
		ACTIVE_SCENARIO_STATUSES.has(scenario.status),
	);

	// Prefer scenario status (same source used by scenario cards) to avoid stale workflow-only states.
	const isIncomeRunning =
		hasActiveScenarioRun || (isIncomeWorkflowRunning && scenarios.length === 0);

	// Determine if New Scenario button should be disabled
	const isNewScenarioDisabled = !hasStatus || isExtractionInProgress || isIncomeRunning;

	// Get refinements for expanded scenario
	const refinements = refinementsData?.refinements ?? [];

	const getNewScenarioButtonContent = () => {
		if (hasError) {
			return (
				<>
					<Plus className="w-4 h-4" />
					New Scenario
				</>
			);
		}
		if (!hasStatus) {
			return (
				<>
					<Loader2 className="w-4 h-4 animate-spin" />
					Loading...
				</>
			);
		}
		if (isExtractionInProgress) {
			return (
				<>
					<Loader2 className="w-4 h-4 animate-spin" />
					Extracting...
				</>
			);
		}
		if (isIncomeRunning) {
			return (
				<>
					<Loader2 className="w-4 h-4 animate-spin" />
					Running...
				</>
			);
		}
		return (
			<>
				<Plus className="w-4 h-4" />
				New Scenario
			</>
		);
	};

	const handleNewScenario = () => {
		if (isNewScenarioDisabled || !caseId) return;
		navigate(`/case/${caseId}/new-scenario`);
	};

	const handleBankStatementsClick = async () => {
		if (!caseId) return;
		dispatch(setSelectedLoanProduct("non_qm_bank_statement"));
		navigate(`/case/${caseId}/bank-statements`);

		const hasRun = incomeData?.income_verifications?.["non_qm_bank_statement"];
		if (!hasRun && !isIncomeRunning) {
			try {
				await startIncomeVerification(caseId, "non_qm_bank_statement");
				invalidateAll(caseId);
			} catch (error) {
				console.error("Failed to auto-start non-qm income for bank statements", error);
			}
		}
	};

	const handleExtractionDownload = useCallback(async () => {
		if (!caseId) return;
		setExtractionDownloading(true);
		try {
			const response = await apiRequest<{ signed_url: string; filename: string }>(
				`/api/v1/cases/${caseId}/stages/extraction/excel-url`,
			);
			setExcelViewerData({
				signedUrl: response.signed_url,
				filename: response.filename,
				stage: "Extraction",
			});
		} catch (error) {
			console.error("Extraction Excel download failed:", error);
		} finally {
			setExtractionDownloading(false);
		}
	}, [caseId]);

	const handleReExtract = useCallback(async () => {
		if (!caseId || reExtracting || isExtractionInProgress) return;
		setReExtracting(true);
		try {
			await apiRequest(`/api/aue/cases/${caseId}/start`, {
				method: "POST",
				body: JSON.stringify({ tenant_id: tenantId ?? "default" }),
			});
			// Invalidate all queries to refresh UI
			invalidateAll(caseId);
		} catch (error) {
			console.error("Re-extraction failed:", error);
		} finally {
			setReExtracting(false);
		}
	}, [caseId, reExtracting, isExtractionInProgress, invalidateAll, tenantId]);

	const formatCurrency = (amount: number | null) => {
		if (amount === null || amount === undefined) return "-";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	if (collapsed) {
		return (
			<aside className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-4">
				<button
					type="button"
					onClick={() => dispatch(toggleDocumentsSidebar())}
					className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
					title="Expand sidebar"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
				</button>
			</aside>
		);
	}

	return (
		<aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto">
				{/* Case Documents Section */}
				<div className="px-4 py-4 border-b border-slate-100">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
							Case Documents
						</h3>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={onUploadClick}
								className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
							>
								<Upload className="w-3.5 h-3.5" />
								Upload
							</button>
							<button
								type="button"
								onClick={() => dispatch(toggleDocumentsSidebar())}
								className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
								title="Collapse sidebar"
							>
								<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
									/>
								</svg>
							</button>
						</div>
					</div>

					{/* All Documents - expandable */}
					<div
						className={`rounded-lg border transition-all ${documentsExpanded ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}
					>
						<button
							type="button"
							onClick={() => setDocumentsExpanded(!documentsExpanded)}
							className="w-full flex items-center justify-between px-3 py-2.5 text-left"
						>
							<div className="flex items-center gap-3">
								<FileText className="w-4 h-4 text-slate-400" />
								<div>
									<p className="text-sm font-medium text-slate-800">All Documents</p>
									<p className="text-xs text-slate-500">{fileCount} files uploaded</p>
								</div>
							</div>
							{documentsExpanded ? (
								<ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
							) : (
								<ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
							)}
						</button>

						{documentsExpanded && (
							<div className="px-3 pb-3 border-t border-slate-200 pt-3 space-y-2">
								<button
									type="button"
									onClick={() => navigate(`/case/${caseId}/view`)}
									className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-700 hover:bg-white transition-colors text-left"
								>
									<FileText className="w-4 h-4 text-slate-400" />
									View Documents
								</button>
								<button
									type="button"
									onClick={handleExtractionDownload}
									disabled={extractionDownloading}
									className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-700 hover:bg-white transition-colors text-left disabled:opacity-50"
								>
									{extractionDownloading ? (
										<Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
									) : (
										<Download className="w-4 h-4 text-slate-400" />
									)}
									{extractionDownloading ? "Downloading..." : "Download Excel"}
								</button>
								<button
									type="button"
									onClick={handleReExtract}
									disabled={reExtracting || isExtractionInProgress}
									className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-700 hover:bg-white transition-colors text-left disabled:opacity-50"
								>
									{reExtracting || (hasStatus && isExtractionInProgress) ? (
										<Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
									) : (
										<RefreshCw className="w-4 h-4 text-slate-400" />
									)}
									{reExtracting || (hasStatus && isExtractionInProgress)
										? "Extracting..."
										: "Re-extract"}
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Income Scenarios Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
						Income Scenarios
					</h3>

					{/* Scenarios list */}
					<div className="space-y-0.5">
						{scenarios.map((scenario: ScenarioSummary, idx: number) => {
							const isExpanded = expandedScenario === scenario.scenario_id;
							const isSelectedScenario = location.pathname.includes(
								`/scenario/${scenario.scenario_id}`,
							);

							return (
								<div key={scenario.scenario_id}>
									{/* Scenario Card */}
									<div
										className={`w-full px-4 py-2.5 text-left transition-colors rounded-lg mx-2 ${
											isSelectedScenario
												? "bg-slate-50 border border-slate-200"
												: "hover:bg-slate-50"
										}`}
										style={{ width: "calc(100% - 16px)" }}
									>
										<div className="flex items-center justify-between">
											<button
												type="button"
												onClick={() => {
													navigate(`/case/${caseId}/scenario/${scenario.scenario_id}/summary`);
												}}
												className="flex-1 text-left"
											>
												<div className="flex items-center gap-2">
													<span className="text-xs font-medium text-slate-800">
														{scenario.name}
													</span>
													{idx === 0 && (
														<span className="px-1.5 py-0.5 text-[10px] font-normal bg-slate-200 text-slate-500 rounded">
															latest
														</span>
													)}
												</div>
												<span
													className={`text-[10px] mt-0.5 block ${
														scenario.approach === "non_qualified_mortgage"
															? "text-amber-600"
															: "text-slate-400"
													}`}
												>
													{scenario.approach === "non_qualified_mortgage"
														? "Non-Qualified Mortgage"
														: "Qualified Mortgage"}
												</span>
											</button>
											<button
												type="button"
												onClick={() =>
													setExpandedScenario(isExpanded ? null : scenario.scenario_id)
												}
												className="p-1 hover:bg-slate-200 rounded transition-colors"
											>
												<ChevronDown
													className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
												/>
											</button>
										</div>
										<button
											type="button"
											onClick={() => {
												// Navigate to scenario summary page
												navigate(`/case/${caseId}/scenario/${scenario.scenario_id}/summary`);
											}}
											className="w-full text-left"
										>
											{scenario.status === "completed" ? (
												<p className="text-[11px] text-green-600 mt-0.5">✓ Completed</p>
											) : scenario.status === "running" ? (
												<p className="text-[11px] text-amber-600 mt-0.5">Running...</p>
											) : (
												<p className="text-[11px] text-slate-500 mt-0.5">{scenario.status}</p>
											)}
											{scenario.status === "completed" &&
												scenario.total_monthly_income !== null && (
													<p className="text-sm font-semibold font-mono text-slate-900 mt-0.5">
														{formatCurrency(scenario.total_monthly_income)}/mo
													</p>
												)}
										</button>
									</div>

									{/* Expanded: Refinements */}
									{isExpanded && (
										<div className="mx-2 mt-1 mb-2">
											<p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5">
												Refinements
											</p>
											{refinements.length === 0 ? (
												<p className="px-2 py-1.5 text-[11px] text-slate-400 italic">
													No refinements yet
												</p>
											) : (
												refinements.map((ref: RefinementSummary) => {
													const isSelected = selectedRefinementId === ref.refinement_id;
													return (
														<button
															key={ref.refinement_id}
															type="button"
															onClick={() =>
																navigate(
																	`/case/${caseId}/scenario/${scenario.scenario_id}/refinement/${ref.refinement_id}/summary`,
																)
															}
															className={`w-full px-2 py-1.5 text-left text-[11px] rounded transition-colors ${
																isSelected
																	? "bg-amber-100 border border-amber-300 text-amber-900"
																	: "text-slate-600 hover:bg-slate-50"
															}`}
														>
															<div className="flex items-center justify-between">
																<span className={isSelected ? "font-medium" : ""}>
																	{ref.name
																		? `#${ref.refinement_num} — ${ref.name}`
																		: `Run #${ref.refinement_num}`}
																</span>
																{ref.status === "completed" ? (
																	<span
																		className={isSelected ? "text-amber-700" : "text-green-600"}
																	>
																		✓
																	</span>
																) : ref.status === "running" ? (
																	<Loader2 className="w-3 h-3 animate-spin text-amber-500" />
																) : (
																	<span className="text-slate-400">{ref.status}</span>
																)}
															</div>
															{ref.status === "completed" && ref.total_monthly_income !== null && (
																<span
																	className={`text-[10px] font-mono ${isSelected ? "text-amber-800" : "text-slate-500"}`}
																>
																	{formatCurrency(ref.total_monthly_income)}/mo
																</span>
															)}
														</button>
													);
												})
											)}
										</div>
									)}
								</div>
							);
						})}

						{/* New Scenario Button */}
						<div className="px-2 pt-1">
							<button
								type="button"
								onClick={handleNewScenario}
								disabled={isNewScenarioDisabled}
								className={`w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
									isNewScenarioDisabled
										? "bg-slate-100 text-slate-400 cursor-not-allowed"
										: "bg-[#F9ED93] hover:bg-[#f5e97a] text-slate-800"
								}`}
							>
								{getNewScenarioButtonContent()}
							</button>
						</div>
					</div>
				</div>

				{/* Compare Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
						Compare
					</h3>
					<div className="px-2">
						<button
							type="button"
							onClick={() => navigate(`/case/${caseId}/compare`)}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
								isComparePage ? "bg-rose-50 border border-rose-200" : "hover:bg-slate-50"
							}`}
						>
							<ChartColumn
								className={`w-4 h-4 ${isComparePage ? "text-rose-600" : "text-slate-400"}`}
							/>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-medium ${isComparePage ? "text-rose-900" : "text-slate-800"}`}
								>
									Side-by-Side
								</p>
								<p className="text-xs text-slate-500">Compare scenario outcomes by product</p>
							</div>
						</button>
					</div>
				</div>

				{/* Bank Statements Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
						Bank Statements
					</h3>
					<div className="px-2">
						<button
							type="button"
							onClick={handleBankStatementsClick}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
								isBankStatementsPage
									? "bg-emerald-50 border border-emerald-200"
									: "hover:bg-slate-50"
							}`}
						>
							<Building2
								className={`w-4 h-4 ${isBankStatementsPage ? "text-emerald-600" : "text-slate-400"}`}
							/>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-medium ${isBankStatementsPage ? "text-emerald-900" : "text-slate-800"}`}
								>
									View Analysis
								</p>
								<p className="text-xs text-slate-500">
									{bankStatementCount > 0
										? `${bankStatementCount} statements`
										: "No statements yet"}
								</p>
							</div>
							{(bankStatementSummary?.validation_issues?.length ?? 0) > 0 && (
								<span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
									Review
								</span>
							)}
							{bankStatementCount > 0 && (
								<span
									className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
										isBankStatementsPage
											? "bg-emerald-100 text-emerald-700"
											: "bg-slate-100 text-slate-600"
									}`}
								>
									{bankStatementCount}
								</span>
							)}
						</button>
					</div>
				</div>

				{/* Credit Report Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
						Credit Report
					</h3>
					<div className="px-2">
						<button
							type="button"
							onClick={() => navigate(`/case/${caseId}/credit-report`)}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
								isCreditReportPage ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
							}`}
						>
							<CreditCard
								className={`w-4 h-4 ${isCreditReportPage ? "text-blue-600" : "text-slate-400"}`}
							/>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-medium ${isCreditReportPage ? "text-blue-900" : "text-slate-800"}`}
								>
									View Analysis
								</p>
								<p className="text-xs text-slate-500">
									{creditReportCount > 0 ? `${tradeAccountCount} tradelines` : "No reports yet"}
								</p>
							</div>
							{creditReportCount > 0 && (
								<span
									className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
										isCreditReportPage ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
									}`}
								>
									{creditReportCount}
								</span>
							)}
						</button>
					</div>
				</div>

				{/* Ratios Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
						Ratios
					</h3>
					<div className="px-2">
						<button
							type="button"
							onClick={() => navigate(`/case/${caseId}/ratios`)}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
								isRatiosPage ? "bg-orange-50 border border-orange-200" : "hover:bg-slate-50"
							}`}
						>
							<ChartColumn
								className={`w-4 h-4 ${isRatiosPage ? "text-orange-600" : "text-slate-400"}`}
							/>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-medium ${isRatiosPage ? "text-orange-900" : "text-slate-800"}`}
								>
									DTI & Ratios
								</p>
								<p className="text-xs text-slate-500">Debt-to-income and obligation breakdown</p>
							</div>
						</button>
					</div>
				</div>

				{/* Compliance Section */}
				<div className="py-3 border-b border-slate-100">
					<h3 className="px-4 text-[10px] font-semibold uppercase tracking-wider text-[hsl(215_16%_47%)] mb-2">
						Compliance
					</h3>
					<div className="px-2">
						<button
							type="button"
							onClick={() => navigate(`/case/${caseId}/compliance`)}
							className={`w-full rounded-md px-3 py-2 text-left transition-colors border ${
								isCompliancePage
									? "bg-[hsl(14_85%_53%_/_0.10)] border-[hsl(14_85%_53%_/_0.20)]"
									: "hover:bg-[hsl(210_17%_93%)] border-transparent"
							}`}
						>
							<div className="flex items-center gap-2">
								<ShieldCheck className="h-3.5 w-3.5 text-[hsl(215_16%_47%)]" />
								<span className="text-xs font-medium">Compliance Radar</span>
								<span className="relative flex h-2 w-2 ml-auto" aria-hidden>
									<span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(14_85%_53%)] opacity-75 [animation:ping_1s_cubic-bezier(0,0,0.2,1)_infinite]" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(14_85%_53%)]" />
								</span>
							</div>
							<div className="text-[10px] text-[hsl(215_16%_47%)] mt-0.5">
								One-click compliance proof
							</div>
						</button>
					</div>
				</div>
			</div>

			{/* Excel Viewer Modal */}
			{excelViewerData && (
				<ExcelViewer
					signedUrl={excelViewerData.signedUrl}
					filename={excelViewerData.filename}
					stage={excelViewerData.stage}
					onClose={() => setExcelViewerData(null)}
				/>
			)}
		</aside>
	);
}
