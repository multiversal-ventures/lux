import { useEffect, useState } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIncomeVerification } from "../hooks/useCaseQueries";
import { InlineExcelSheet } from "../components/shared";
import { ScenarioLogsTab, ScenarioRefsTab } from "../components/scenario";
import type { ScenarioDetail, LoanProduct, RefinementDetail } from "../hooks/useApi";
import type { CaseResult } from "../types";
import type { WorkBook } from "xlsx";

interface ScenarioContext {
	scenario: ScenarioDetail;
	caseResult: CaseResult | undefined;
	loanProducts: LoanProduct[];
	excelWorkbook: WorkBook | undefined;
	excelLoading: boolean;
	currentRefinement?: RefinementDetail | null;
	latestRefinement?: RefinementDetail | null;
}

/** Map product ID to Excel sheet name (Fannie Mae, Freddie Mac, FHA, USDA) */
const PRODUCT_TO_SHEET: Record<string, string> = {
	fannie_mae: "Fannie Mae",
	freddie_mac: "Freddie Mac",
	fha: "FHA",
	usda: "USDA",
	fnma_selling_guide: "Fannie Mae",
	fhlmc_selling_guide: "Freddie Mac",
	fha_handbook: "FHA",
	usda_handbook: "USDA",
};

/**
 * Loading skeleton for income verification results.
 * Mirrors the Excel-style layout with bottom sheet tabs.
 */
function IncomeResultsSkeleton({ message }: { message: string }) {
	return (
		<div className="flex pt-4 flex-col overflow-hidden max-h-[calc(100vh-300px)]">
			<div className="flex-1 border border-slate-300 bg-white">
				<div className="flex items-center justify-center gap-2 py-12 text-slate-400">
					<Loader2 className="w-5 h-5 animate-spin" />
					<span className="text-sm">{message}</span>
				</div>
			</div>
			<div className="flex items-start gap-px shrink-0 pl-1 bg-[#e0e0e0] border-x border-b border-slate-300">
				{["Income", "Calculation logs", "References"].map((label, i) => (
					<div
						key={label}
						className={`px-4 py-1 text-[10px] font-medium tracking-wide uppercase ${
							i === 0
								? "bg-white text-slate-400 border-x border-b border-slate-300"
								: "bg-[#ebebeb] text-slate-300 border-x border-b border-transparent"
						}`}
					>
						{label}
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * ScenarioIncomeTab - Compact income results view for scenario page.
 * Renders Excel sheet inline with sheet tabs (Fannie Mae, Freddie Mac, FHA, USDA).
 */
type TabId = "income" | "logs" | "refs";

export function ScenarioIncomeTab() {
	const { caseId, productId } = useParams<{ caseId: string; productId: string }>();
	const {
		scenario,
		caseResult,
		loanProducts,
		excelWorkbook,
		excelLoading,
		currentRefinement,
		latestRefinement,
	} = useOutletContext<ScenarioContext>();

	const [activeTab, setActiveTab] = useState<TabId>("income");

	// Use current refinement if URL contains one, else fall back to latest refinement for the scenario.
	// Without this fallback, navigating via the non-refinement URL (/scenario/:id/:productId) passes
	// a null currentRefinement and ScenarioIncomeTab falls back to the generic /income endpoint,
	// which always returns the most-recently-written case snapshot — overwriting results for older scenarios.
	const effectiveRefinement = currentRefinement ?? latestRefinement;
	const refinementId = effectiveRefinement?.refinement_id;
	const {
		data: incomeResponse,
		isLoading,
		isFetching,
		isFetched,
		refetch: refetchIncome,
	} = useIncomeVerification(caseId ?? "", refinementId);

	const isWorkflowRunning = scenario?.status === "running" || scenario?.status === "pending";

	const verificationResultsByProduct = incomeResponse?.income_verifications ?? {};
	const canonicalProductId = productId === "bank_statement" ? "non_qm_bank_statement" : productId;
	const productResult = canonicalProductId
		? (verificationResultsByProduct[canonicalProductId] ??
			verificationResultsByProduct[productId ?? ""])
		: null;

	const product = loanProducts?.find((p) => p.id === productId);
	const productName = product?.display_name || productId;

	// Resolve worksheet from workbook for current product
	const sheetName = productId ? PRODUCT_TO_SHEET[productId] : undefined;
	const worksheet =
		excelWorkbook && sheetName
			? (excelWorkbook.Sheets[sheetName] ?? excelWorkbook.Sheets[excelWorkbook.SheetNames[0]])
			: excelWorkbook?.Sheets[excelWorkbook.SheetNames[0]];

	useEffect(() => {
		refetchIncome();
	}, [refetchIncome, scenario]);

	// Show workflow state first, then generic fetch/loading state.
	if (isWorkflowRunning) {
		return <IncomeResultsSkeleton message="Calculating income..." />;
	}

	if (isLoading || isFetching) {
		return <IncomeResultsSkeleton message="Loading product results..." />;
	}

	if (isFetched && !productResult) {
		return (
			<div className="text-center py-8 text-slate-500">No results available for {productName}</div>
		);
	}

	const tabs: { id: TabId; label: string }[] = [
		{ id: "income", label: "Income" },
		{ id: "logs", label: "Calculation logs" },
		{ id: "refs", label: "References" },
	];

	return (
		<div className="flex pt-4 flex-col h-[calc(100vh-300px)]">
			{/* Content panel — sharp edges, no rounding */}
			<div className="flex-1 min-h-0 flex flex-col border border-b-0 border-slate-300 bg-white overflow-hidden">
				<div
					className={`flex-1 min-h-0 ${activeTab === "refs" ? "flex flex-col" : activeTab === "income" ? "flex flex-col" : "overflow-auto p-4"}`}
				>
					{activeTab === "income" && (
						<>
							{worksheet ? (
								<InlineExcelSheet worksheet={worksheet} borderless />
							) : excelLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="w-6 h-6 animate-spin text-slate-400" />
								</div>
							) : null}
						</>
					)}
					{activeTab === "logs" && (
						<ScenarioLogsTab caseId={caseId ?? ""} productResult={productResult} />
					)}
					{activeTab === "refs" && (
						<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
							<ScenarioRefsTab
								caseId={caseId ?? ""}
								productResult={productResult}
								caseResult={caseResult}
							/>
						</div>
					)}
				</div>
			</div>

			{/* Bottom sheet tabs — Excel-style, no rounding */}
			<div className="flex items-start shrink-0 bg-[#e8e8e8] border-x border-b border-slate-300 overflow-hidden">
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`relative px-4 py-[5px] text-[11px] font-medium transition-colors border-r border-[#d4d4d4] ${
								isActive
									? "bg-white text-slate-800 border-t-2 border-t-[#217346]"
									: "bg-[#e8e8e8] text-slate-500 border-t-2 border-t-transparent hover:bg-[#f0f0f0] hover:text-slate-700"
							}`}
						>
							{tab.label}
						</button>
					);
				})}
				<div className="flex-1" />
			</div>
		</div>
	);
}

export default ScenarioIncomeTab;
