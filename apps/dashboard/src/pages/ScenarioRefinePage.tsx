import { ChevronLeft, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScenarioDraftEditor } from "../components/scenario";
import { useScenarioDraft } from "../hooks";
import type { ScenarioDetail } from "../hooks/useApi";
import {
	useCaseResult,
	useCreateRefinementMutation,
	useScenarioDetail,
} from "../hooks/useCaseQueries";
import {
	DEFAULT_SCENARIO_DRAFT,
	buildBorrowers,
	createDraftFromScenario,
	getAvailableYears,
} from "../utils/scenarioDraft";

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

	const saving = createRefinementMutation.isPending;

	// Fetch case data for documents and borrowers
	const { data: caseResult, refetch: refetchCaseResult } = useCaseResult(caseId ?? "");
	const scenarioQuery = useScenarioDetail(caseId ?? null, scenarioId ?? null, {
		enabled: !!caseId && !!scenarioId,
	});
	const scenario: ScenarioDetail | null = scenarioQuery.data ?? null;
	const loading = scenarioQuery.isLoading;
	const error = scenarioQuery.error ? "Failed to load scenario" : null;

	const scenarioDraft = useMemo(
		() => (scenario ? createDraftFromScenario(scenario) : DEFAULT_SCENARIO_DRAFT),
		[scenario],
	);
	const { draft, setDraft, periodVariant, yearValidationError, hasChanges } = useScenarioDraft({
		initialDraft: scenarioDraft,
		baselineDraft: scenarioDraft,
		resetKey: scenario?.scenario_id ?? "loading",
	});

	const {
		borrowerIds: selectedBorrowerIds,
		documentIds: selectedDocumentIds,
		y1Override,
		y2Override,
		statementPeriodMonths,
		extractionEditCount,
	} = draft;

	// Extract borrowers from case (same pattern as CreateScenarioPage)
	const borrowers = useMemo(() => buildBorrowers(caseResult), [caseResult]);

	// Extract available years from document effective dates
	const availableYears = useMemo(
		() => getAvailableYears(caseResult?.extractions?.documents ?? []),
		[caseResult],
	);

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

	// Warn when selected period exceeds available documents
	const periodWarning = useMemo(() => {
		if (!scenario) return null;
		if (periodVariant === "bank_statement") {
			const selected = statementPeriodMonths;
			if (!selected || availableYears.length < 1) return null;
			const sorted = [...availableYears].sort((a, b) => Number(a) - Number(b));
			const detected = (Number(sorted[sorted.length - 1]) - Number(sorted[0]) + 1) * 12;
			if (selected > detected) {
				return `Only ${detected} months of bank statements detected. ${selected} months selected may produce incomplete results.`;
			}
		}

		if (periodVariant === "1099") {
			const wantsTwo = !y1Override || !!y2Override;
			if (wantsTwo && availableYears.length < 2) {
				return `Only ${availableYears.length} year(s) of 1099 documents detected. 2-year calculation requires documents for both years.`;
			}
		}

		return null;
	}, [availableYears, periodVariant, scenario, statementPeriodMonths, y1Override, y2Override]);

	const footerStatus = useMemo(() => {
		if (hasChanges) {
			return extractionEditCount > 0
				? `${extractionEditCount} extraction edit(s) made`
				: "You have unsaved changes";
		}
		return "No changes made";
	}, [extractionEditCount, hasChanges]);

	const refinementNote = useMemo(() => {
		const baseNote = draft.note?.trim() || "";
		if (extractionEditCount > 0) {
			const extractionNote = `Refined with ${extractionEditCount} extraction edit(s)`;
			return baseNote ? `${baseNote}\n\n${extractionNote}` : extractionNote;
		}
		return baseNote || "Refinement";
	}, [draft.note, extractionEditCount]);

	// Handle save - creates new refinement under the same scenario
	const handleSave = async () => {
		if (!caseId || !scenarioId || !scenario || saving || yearValidationError) return;

		try {
			await createRefinementMutation.mutateAsync({
				caseId,
				scenarioId,
				request: {
					borrower_ids: selectedBorrowerIds,
					document_ids: selectedDocumentIds,
					loan_product_ids: scenario.loan_product_ids ?? [],
					y1_override: y1Override,
					y2_override: y2Override,
					statement_period_months: statementPeriodMonths,
					extraction_edit_count: extractionEditCount,
					note: refinementNote,
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

					<ScenarioDraftEditor
						allowExtraction
						periodsTabProps={{
							y1Override,
							y2Override,
							onY1Change: (v) => setDraft((prev) => ({ ...prev, y1Override: v })),
							onY2Change: (v) => setDraft((prev) => ({ ...prev, y2Override: v })),
							availableYears,
							yearSelectionReason,
							mode: "refine",
							approach: scenario.approach,
							loanProductIds: scenario.loan_product_ids ?? [],
							statementPeriodMonths,
							onStatementPeriodChange: (m) =>
								setDraft((prev) => ({ ...prev, statementPeriodMonths: m })),
						}}
						documentsTabProps={{
							caseId: caseId ?? "",
							documents: caseResult?.extractions?.documents ?? [],
							selectedIds: selectedDocumentIds,
							onSelectionChange: (ids) => setDraft((prev) => ({ ...prev, documentIds: ids })),
							files: caseResult?.artifacts?.files,
							onUploadComplete: () => refetchCaseResult(),
							reviewConfirmLabel: "Add to refinement",
						}}
						borrowersTabProps={{
							borrowers,
							selectedIds: selectedBorrowerIds,
							onSelectionChange: (ids) => setDraft((prev) => ({ ...prev, borrowerIds: ids })),
						}}
						noteLabel="Refinement Note"
						noteValue={draft.note}
						notePlaceholder="Describe what changed in this refinement..."
						onNoteChange={(value) => setDraft((prev) => ({ ...prev, note: value }))}
						noteDisabled={saving}
						extractionTabProps={{
							caseId: caseId ?? "",
							documents: caseResult?.extractions?.documents ?? [],
							selectedDocumentIds,
							onUpdate: refetchCaseResult,
							onEditCountChange: (count) =>
								setDraft((prev) => ({ ...prev, extractionEditCount: count })),
						}}
						extractionTabKey={scenario.scenario_id}
						extractionEditCount={extractionEditCount}
						footerWarning={periodWarning}
						footerStatus={footerStatus}
						onSave={handleSave}
						saveLabel="Save & Run"
						savingLabel="Creating..."
						isSaving={saving}
						saveDisabled={!hasChanges || saving || !!yearValidationError}
					/>
				</div>
			</div>
		</div>
	);
}

export default ScenarioRefinePage;
