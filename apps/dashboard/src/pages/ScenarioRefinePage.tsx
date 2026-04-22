import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Loader2,
	ChevronLeft,
	Calendar,
	FileText,
	Users,
	Pencil,
	Save,
	AlertCircle,
} from "lucide-react";
import type { ScenarioDetail } from "../hooks/useApi";
import {
	useCaseResult,
	useCreateRefinementMutation,
	useScenarioDetail,
} from "../hooks/useCaseQueries";
import { PeriodsTab, DocumentsTab, BorrowersTab, ExtractionTab } from "../components/scenario";
import type { Borrower } from "../components/shared";

type TabId = "periods" | "documents" | "borrowers" | "extraction";

interface RefinementState {
	selectedBorrowerIds: string[];
	selectedDocumentIds: string[];
	y1Override: string | null;
	y2Override: string | null;
	statementPeriodMonths: number | null;
}

interface ScenarioRefinePageProps {
	onStartRefinement?: () => void;
}

/**
 * ScenarioRefinePage - Allows users to refine a completed scenario.
 *
 * Creates a new ScenarioRefinement under the same Scenario with modified:
 * - Tax year overrides
 * - Document selection
 * - Borrower selection
 * - Extraction corrections
 *
 * Each refinement creates a new calculation run without creating new scenario versions.
 * The scenario summary page displays the latest refinement's results.
 */
export function ScenarioRefinePage({ onStartRefinement }: ScenarioRefinePageProps) {
	const { caseId, scenarioId } = useParams<{ caseId: string; scenarioId: string }>();
	const navigate = useNavigate();
	const createRefinementMutation = useCreateRefinementMutation();

	const [activeTab, setActiveTab] = useState<TabId>("periods");
	const [extractionEditCount, setExtractionEditCount] = useState(0);
	const initializedScenarioIdRef = useRef<string | null>(null);
	const saving = createRefinementMutation.isPending;

	// Fetch case data for documents and borrowers
	const { data: caseResult, refetch: refetchCaseResult } = useCaseResult(caseId ?? "");
	const scenarioQuery = useScenarioDetail(caseId ?? null, scenarioId ?? null, {
		enabled: !!caseId && !!scenarioId,
	});
	const scenario: ScenarioDetail | null = scenarioQuery.data ?? null;
	const loading = scenarioQuery.isLoading;
	const error = scenarioQuery.error ? "Failed to load scenario" : null;

	// Refinement state - initialized from scenario
	const [refinement, setRefinement] = useState<RefinementState>({
		selectedBorrowerIds: [],
		selectedDocumentIds: [],
		y1Override: null,
		y2Override: null,
		statementPeriodMonths: null,
	});

	// Extract borrowers from case (same pattern as CreateScenarioPage)
	const borrowers = useMemo<Borrower[]>(() => {
		if (!caseResult?.extractions?.financial_entities) return [];

		const entities = caseResult.extractions.financial_entities;
		const result: Borrower[] = [];

		// Individual borrowers
		for (const borrower of entities.borrowers ?? []) {
			result.push({
				id: borrower.ffi_id || borrower.display_name,
				name: borrower.display_name || borrower.canonical_name || "Unknown Borrower",
				role: borrower.borrower_role || "borrower",
				type: borrower.entity_type || "person",
			});
		}

		// Business entities
		for (const business of entities.businesses ?? []) {
			const entityType = business.entity_type || "business";
			result.push({
				id: business.ffi_id || business.display_name,
				name: business.display_name || business.canonical_name || "Unknown Business",
				role: entityType,
				type: entityType,
			});
		}

		return result;
	}, [caseResult]);

	// Extract available years from document effective dates
	const availableYears = useMemo(() => {
		if (!caseResult?.extractions?.documents) return [];

		const years = new Set<string>();
		for (const doc of caseResult.extractions.documents) {
			if (doc.effective_period?.period_end) {
				const year = new Date(doc.effective_period.period_end).getFullYear();
				years.add(String(year));
			}
		}

		return Array.from(years).sort((a, b) => Number(b) - Number(a));
	}, [caseResult]);

	// Build year-selection explanation from actual primary documents
	const yearSelectionReason = useMemo(() => {
		if (!caseResult?.extractions?.documents) return null;

		const PRIMARY_TYPES = new Set([
			"IRS1040",
			"IRS1099NEC",
			"IRS1099MISC",
			"IRS1099INT",
			"IRS1099DIV",
			"IRS1099R",
			"BankStatement",
			"UnifiedBankStatement",
		]);

		const primaryDocYears = new Map<string, Set<string>>();
		for (const doc of caseResult.extractions.documents) {
			const docType = doc.document_type || "";
			if (!PRIMARY_TYPES.has(docType)) continue;
			const periodEnd = doc.effective_period?.period_end;
			if (!periodEnd) continue;
			const year = String(new Date(periodEnd).getFullYear());
			if (!primaryDocYears.has(docType)) primaryDocYears.set(docType, new Set());
			primaryDocYears.get(docType)!.add(year);
		}

		if (primaryDocYears.size === 0) return null;

		const allYears = new Set<string>();
		for (const years of primaryDocYears.values()) {
			for (const y of years) allYears.add(y);
		}
		const sorted = Array.from(allYears).sort((a, b) => Number(b) - Number(a));
		const selected = sorted.slice(0, 2);

		const docLabels: string[] = [];
		for (const dt of primaryDocYears.keys()) {
			const label = dt.replace(/^IRS/, "IRS ").replace(/([a-z])([A-Z])/g, "$1 $2");
			if (!docLabels.includes(label)) docLabels.push(label);
		}

		return `Auto-selected ${selected.join(" and ")} from ${docLabels.join(", ")} documents.`;
	}, [caseResult]);

	// Initialize refinement state when scenario detail is first loaded for this scenario ID.
	useEffect(() => {
		if (!scenario) return;
		if (initializedScenarioIdRef.current === scenario.scenario_id) return;

		setRefinement({
			selectedBorrowerIds: scenario.borrower_ids ?? [],
			selectedDocumentIds: scenario.document_ids ?? [],
			y1Override: scenario.y1_override ?? null,
			y2Override: scenario.y2_override ?? null,
			statementPeriodMonths: null,
		});
		// Reset per-scenario extraction edit state so hasChanges doesn't leak
		// when switching routes without unmounting this page component.
		setExtractionEditCount(0);
		initializedScenarioIdRef.current = scenario.scenario_id;
	}, [scenario]);

	// Track if user has made changes (including extraction edits)
	const hasChanges = useMemo(() => {
		if (!scenario) return false;
		const sorted = (values: string[]) => [...values].sort();

		// Check for extraction edits
		if (extractionEditCount > 0) return true;

		return (
			JSON.stringify(sorted(refinement.selectedBorrowerIds)) !==
				JSON.stringify(sorted(scenario.borrower_ids ?? [])) ||
			JSON.stringify(sorted(refinement.selectedDocumentIds)) !==
				JSON.stringify(sorted(scenario.document_ids ?? [])) ||
			refinement.y1Override !== (scenario.y1_override ?? null) ||
			refinement.y2Override !== (scenario.y2_override ?? null) ||
			refinement.statementPeriodMonths !== null
		);
	}, [scenario, refinement, extractionEditCount]);

	// Validate year selection
	const yearValidationError = useMemo(() => {
		if (!refinement.y1Override || !refinement.y2Override) return null;

		const y1 = Number(refinement.y1Override);
		const y2 = Number(refinement.y2Override);

		if (y1 === y2) return "Year 1 and Year 2 cannot be the same";
		if (y1 < y2) return "Year 1 must be more recent than Year 2";
		return null;
	}, [refinement.y1Override, refinement.y2Override]);

	// Warn when selected period exceeds available documents
	const periodWarning = useMemo(() => {
		if (!scenario) return null;
		const primary = (scenario.loan_product_ids ?? [])[0] ?? "";

		if (primary.includes("bank_statement")) {
			const selected = refinement.statementPeriodMonths;
			if (!selected || availableYears.length < 1) return null;
			const sorted = [...availableYears].sort((a, b) => Number(a) - Number(b));
			const detected = (Number(sorted[sorted.length - 1]) - Number(sorted[0]) + 1) * 12;
			if (selected > detected) {
				return `Only ${detected} months of bank statements detected. ${selected} months selected may produce incomplete results.`;
			}
		}

		if (primary.includes("1099")) {
			const wantsTwo = !refinement.y1Override || !!refinement.y2Override;
			if (wantsTwo && availableYears.length < 2) {
				return `Only ${availableYears.length} year(s) of 1099 documents detected. 2-year calculation requires documents for both years.`;
			}
		}

		return null;
	}, [scenario, refinement, availableYears]);

	// Handle extraction edit count change
	const handleExtractionEditCountChange = useCallback((count: number) => {
		setExtractionEditCount(count);
	}, []);

	// Handle save - creates new refinement under the same scenario
	const handleSave = async () => {
		if (!caseId || !scenarioId || !scenario || saving || yearValidationError) return;

		// DEBUG: Log document selection before sending
		const allDocIds = (caseResult?.extractions?.documents ?? []).map((d: any) => d.id);
		console.log("[ScenarioRefinePage] ===== SAVING REFINEMENT =====");
		console.log("[ScenarioRefinePage] All available doc IDs:", allDocIds);
		console.log(
			"[ScenarioRefinePage] Selected doc IDs (will be INCLUDED):",
			refinement.selectedDocumentIds,
		);
		console.log(
			"[ScenarioRefinePage] Excluded doc IDs:",
			allDocIds.filter((id: string) => !refinement.selectedDocumentIds.includes(id)),
		);

		try {
			await createRefinementMutation.mutateAsync({
				caseId,
				scenarioId,
				request: {
					borrower_ids: refinement.selectedBorrowerIds,
					document_ids: refinement.selectedDocumentIds,
					loan_product_ids: scenario.loan_product_ids ?? [],
					y1_override: refinement.y1Override,
					y2_override: refinement.y2Override,
					statement_period_months: refinement.statementPeriodMonths,
					extraction_edit_count: extractionEditCount,
					note:
						extractionEditCount > 0
							? `Refined with ${extractionEditCount} extraction edit(s)`
							: "Refinement",
				},
			});

			// Reconnect SSE stream so refinement events flow immediately.
			onStartRefinement?.();

			// Navigate back to scenario summary (which will show latest refinement results)
			navigate(`/case/${caseId}/scenario/${scenarioId}/summary?started=true`);
		} catch (err) {
			console.error("Failed to create refinement:", err);
			alert("Failed to create refinement");
		}
	};

	const tabs: { id: TabId; label: string; icon: typeof Calendar; badge?: number }[] = [
		{ id: "periods", label: "Periods", icon: Calendar },
		{ id: "documents", label: "Documents", icon: FileText },
		{ id: "borrowers", label: "Borrowers", icon: Users },
		{
			id: "extraction",
			label: "Extraction",
			icon: Pencil,
			badge: extractionEditCount > 0 ? extractionEditCount : undefined,
		},
	];

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-slate-50">
				<Loader2 className="w-8 h-8 animate-spin text-slate-400" />
			</div>
		);
	}

	if (error || !scenario) {
		return (
			<div className="flex-1 flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<h2 className="text-lg font-medium text-slate-800 mb-2">Error</h2>
					<p className="text-sm text-slate-500 mb-4">{error || "Could not load scenario"}</p>
					<button
						onClick={() => navigate(`/case/${caseId}/scenario/${scenarioId}/summary`)}
						className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
					>
						Back to Scenario
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 overflow-auto bg-slate-50">
			<div className="max-w-6xl mx-auto py-4 px-4">
				{/* Back button */}
				<button
					onClick={() => navigate(`/case/${caseId}/scenario/${scenarioId}/summary`)}
					className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
				>
					<ChevronLeft className="w-4 h-4" />
					Back to Scenario
				</button>

				{/* Main card */}
				<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
					{/* Header */}
					<div className="px-6 py-4 border-b border-slate-200">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-xl font-semibold text-slate-800">Refine Scenario</h1>
								<p className="text-sm text-slate-500 mt-1">
									Modify parameters and create a new version of "{scenario.name}"
								</p>
							</div>
							<div className="flex items-center gap-3">
								{scenario.version && (
									<span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
										v{scenario.version}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Tabs */}
					<div className="flex items-center gap-0 px-6 bg-slate-50 border-b border-slate-200">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
										activeTab === tab.id
											? "text-slate-800 border-slate-800"
											: "text-slate-500 border-transparent hover:text-slate-700"
									}`}
								>
									<Icon className="w-4 h-4" />
									{tab.label}
									{tab.badge && (
										<span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
											{tab.badge}
										</span>
									)}
								</button>
							);
						})}
					</div>

					{/* Tab Content */}
					<div className="p-6 min-h-[400px]">
						{activeTab === "periods" && (
							<PeriodsTab
								y1Override={refinement.y1Override}
								y2Override={refinement.y2Override}
								onY1Change={(v) => setRefinement((prev) => ({ ...prev, y1Override: v }))}
								onY2Change={(v) => setRefinement((prev) => ({ ...prev, y2Override: v }))}
								availableYears={availableYears}
								yearSelectionReason={yearSelectionReason}
								approach={scenario.approach}
								loanProductIds={scenario.loan_product_ids ?? []}
								statementPeriodMonths={refinement.statementPeriodMonths}
								onStatementPeriodChange={(m) =>
									setRefinement((prev) => ({ ...prev, statementPeriodMonths: m }))
								}
							/>
						)}

						{activeTab === "documents" && (
							<DocumentsTab
								caseId={caseId ?? ""}
								documents={caseResult?.extractions?.documents ?? []}
								selectedIds={refinement.selectedDocumentIds}
								onSelectionChange={(ids) =>
									setRefinement((prev) => ({ ...prev, selectedDocumentIds: ids }))
								}
								files={caseResult?.artifacts?.files}
								onUploadComplete={() => refetchCaseResult()}
							/>
						)}

						{activeTab === "borrowers" && (
							<BorrowersTab
								borrowers={borrowers}
								selectedIds={refinement.selectedBorrowerIds}
								onSelectionChange={(ids) =>
									setRefinement((prev) => ({ ...prev, selectedBorrowerIds: ids }))
								}
							/>
						)}

						{activeTab === "extraction" && (
							<ExtractionTab
								key={scenario.scenario_id}
								caseId={caseId ?? ""}
								documents={caseResult?.extractions?.documents ?? []}
								selectedDocumentIds={refinement.selectedDocumentIds}
								onUpdate={refetchCaseResult}
								onEditCountChange={handleExtractionEditCountChange}
							/>
						)}
					</div>

					{/* Footer */}
					<div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
						{periodWarning && (
							<div className="flex items-center gap-2 text-sm text-red-600 mb-3">
								<AlertCircle className="w-4 h-4 shrink-0" />
								{periodWarning}
							</div>
						)}
						<div className="flex items-center justify-between">
							<p className="text-sm text-slate-500">
								{hasChanges
									? extractionEditCount > 0
										? `${extractionEditCount} extraction edit(s) made`
										: "You have unsaved changes"
									: "No changes made"}
							</p>
							<button
								onClick={handleSave}
								disabled={!hasChanges || saving || !!yearValidationError}
								className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
									hasChanges && !saving && !yearValidationError
										? "bg-amber-600 text-white hover:bg-amber-700"
										: "bg-slate-200 text-slate-400 cursor-not-allowed"
								}`}
							>
								{saving ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										Creating...
									</>
								) : (
									<>
										<Save className="w-4 h-4" />
										Save & Run
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ScenarioRefinePage;
