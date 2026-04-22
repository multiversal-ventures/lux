import { useMemo, useState, useCallback } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { User, FileText, Building2, CheckCircle, XCircle, Wand2, Loader2 } from "lucide-react";
import type { ScenarioDetail, LoanProduct, RefinementDetail } from "../hooks/useApi";
import type { CaseResult, ExtractedDocument, SourceRef } from "../types";
import { getDocClassInfo } from "../utils/docUtils";
import { IncomeAdvisorModal } from "../components/income/IncomeAdvisorModal";
import { useCreateRefinementMutation, useIncomeVerification } from "../hooks/useCaseQueries";
import { SpecResultCard, type TableComponent } from "../components/shared";

interface ScenarioContext {
	scenario: ScenarioDetail;
	caseResult: CaseResult | undefined;
	loanProducts: LoanProduct[];
	latestRefinement?: RefinementDetail | null;
	currentRefinement?: RefinementDetail | null; // Selected refinement from URL
	refetchScenario?: () => void;
}

/**
 * ScenarioSummaryPage - Full summary of scenario configuration.
 *
 * Shows 3 stacked full-width tables:
 * - Borrowers: selected vs excluded
 * - Documents: grouped by type, selected vs excluded
 * - Loan Products: selected products
 */
export function ScenarioSummaryPage() {
	const {
		scenario,
		caseResult,
		loanProducts,
		latestRefinement,
		currentRefinement,
		refetchScenario,
	} = useOutletContext<ScenarioContext>();

	// Use the currently selected refinement (from URL) or fall back to latest
	const activeRefinement = currentRefinement ?? latestRefinement;
	const { caseId, refinementId: selectedRefinementId } = useParams<{
		caseId: string;
		refinementId?: string;
	}>();
	const navigate = useNavigate();
	const createRefinementMutation = useCreateRefinementMutation();
	const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
	const [isEditingExpenseFactor, setIsEditingExpenseFactor] = useState(false);
	const [editExpenseFactorValue, setEditExpenseFactorValue] = useState<string>("");
	const isUpdatingExpenseFactor = createRefinementMutation.isPending;

	const isNonQmScenario = scenario.approach === "non_qualified_mortgage";

	const isBankStatementScenario = useMemo(() => {
		const ids = scenario.loan_product_ids ?? [];
		if (ids.some((id) => id.includes("1099"))) return false;
		return ids.some((id) => id.includes("bank_statement"));
	}, [scenario.loan_product_ids]);

	// Non-QM: fetch income results to render inline
	// Pass refinement ID to load refinement-specific results
	const { data: incomeResponse, isLoading: incomeLoading } = useIncomeVerification(
		isNonQmScenario ? (caseId ?? null) : null,
		selectedRefinementId,
		{ enabled: isNonQmScenario && scenario.status === "completed" },
	);

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

	// Get current qualifying factor from active refinement or default (as percentage 0-100)
	// Prefer expense_factor_used (actual value from spec execution) over user_inputs (requested value)
	// Default 0.90 = 90% qualifying factor = 90% of deposits qualify as income
	const currentExpenseFactorPercent = useMemo(() => {
		const factor =
			activeRefinement?.expense_factor_used ?? activeRefinement?.user_inputs?.expense_factor ?? 0.9;
		return Math.round(factor * 100);
	}, [activeRefinement]);

	// Start editing expense factor
	const handleStartEditExpenseFactor = useCallback(() => {
		setEditExpenseFactorValue(String(currentExpenseFactorPercent));
		setIsEditingExpenseFactor(true);
	}, [currentExpenseFactorPercent]);

	// Cancel editing
	const handleCancelEditExpenseFactor = useCallback(() => {
		setIsEditingExpenseFactor(false);
		setEditExpenseFactorValue("");
	}, []);

	// Save expense factor - creates a new refinement
	const handleSaveExpenseFactor = useCallback(async () => {
		const parsedValue = parseInt(editExpenseFactorValue, 10);

		// Validate: must be a number between 1 and 99
		if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 99) {
			return;
		}

		const newFactor = parsedValue / 100;

		if (!caseId || parsedValue === currentExpenseFactorPercent) {
			setIsEditingExpenseFactor(false);
			return;
		}

		try {
			await createRefinementMutation.mutateAsync({
				caseId,
				scenarioId: scenario.scenario_id,
				request: {
					borrower_ids: scenario.borrower_ids,
					document_ids: scenario.document_ids ?? [],
					loan_product_ids: scenario.loan_product_ids,
					y1_override: scenario.y1_override,
					y2_override: scenario.y2_override,
					user_inputs: { expense_factor: newFactor },
					note: `Expense factor changed to ${parsedValue}%`,
				},
			});

			// Refresh scenario data
			if (refetchScenario) {
				refetchScenario();
			}
		} catch (error) {
			console.error("Failed to update expense factor:", error);
		} finally {
			setIsEditingExpenseFactor(false);
		}
	}, [
		caseId,
		scenario,
		editExpenseFactorValue,
		currentExpenseFactorPercent,
		refetchScenario,
		createRefinementMutation,
	]);

	// All borrowers from case
	const allBorrowers = useMemo(() => {
		if (!caseResult?.extractions?.financial_entities) return [];
		return [
			...(caseResult.extractions.financial_entities.borrowers ?? []),
			...(caseResult.extractions.financial_entities.businesses ?? []),
		];
	}, [caseResult]);

	// All documents from case
	const allDocuments = useMemo(() => {
		return caseResult?.extractions?.documents ?? [];
	}, [caseResult]);

	// Selected IDs as sets - use activeRefinement if available, otherwise scenario
	// Each refinement can have different borrower/document selections
	const selectedBorrowerIds = useMemo(() => {
		const ids = activeRefinement?.borrower_ids ?? scenario.borrower_ids ?? [];
		return new Set(ids);
	}, [activeRefinement, scenario]);

	const selectedDocumentIds = useMemo(() => {
		const ids = activeRefinement?.document_ids ?? scenario.document_ids ?? [];
		return new Set(ids);
	}, [activeRefinement, scenario]);

	// Debug: log document_ids to help diagnose
	console.debug(
		"[ScenarioSummaryPage] activeRefinement:",
		activeRefinement?.refinement_id,
		"document_ids:",
		activeRefinement?.document_ids,
	);

	// Partition borrowers
	const selectedBorrowers = allBorrowers.filter((b) =>
		selectedBorrowerIds.has(b.ffi_id || b.display_name),
	);
	const excludedBorrowers = allBorrowers.filter(
		(b) => !selectedBorrowerIds.has(b.ffi_id || b.display_name),
	);

	// Group documents by type with selected/excluded
	// ONLY show documents that are explicitly in scenario.document_ids as "Included"
	const documentGroups = useMemo(() => {
		const groups: {
			type: string;
			displayName: string;
			selected: ExtractedDocument[];
			excluded: ExtractedDocument[];
		}[] = [];
		const typeMap: Record<
			string,
			{ selected: ExtractedDocument[]; excluded: ExtractedDocument[] }
		> = {};

		for (const doc of allDocuments) {
			const type = doc.document_type;
			if (!typeMap[type]) {
				typeMap[type] = { selected: [], excluded: [] };
			}

			// Only mark as selected if explicitly in document_ids
			if (selectedDocumentIds.has(doc.id)) {
				typeMap[type].selected.push(doc);
			} else {
				typeMap[type].excluded.push(doc);
			}
		}

		for (const [type, docs] of Object.entries(typeMap)) {
			const { displayName } = getDocClassInfo(type);
			groups.push({ type, displayName, ...docs });
		}

		return groups.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}, [allDocuments, selectedDocumentIds]);

	// Get product display name
	const getProductName = (productId: string) => {
		const product = loanProducts?.find((p) => p.id === productId);
		return (
			product?.display_name || productId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
		);
	};

	const toTableComponents = (
		components: Array<{
			name: string;
			source_line?: string;
			sign?: string;
			y1?: number;
			y2?: number;
			ytd?: number;
			column_values?: Record<string, number | string | null | (number | string | null)[]>;
			render_hint?: string;
			source_refs?: SourceRef[];
			data_type?: string;
			role?: string;
			emphasis?: string;
			aggregation?: string | { source: string; render_hint?: string };
		}>,
	): TableComponent[] =>
		components.map((comp) => ({
			name: comp.name,
			source_line: comp.source_line,
			sign: comp.sign,
			data_type: comp.data_type || "currency",
			column_values: comp.column_values,
			y1: comp.y1,
			y2: comp.y2,
			ytd: comp.ytd,
			render_hint: comp.render_hint,
			source_refs: comp.source_refs,
			role: comp.role,
			emphasis: comp.emphasis,
			aggregation: comp.aggregation,
		}));

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Check if the active refinement is currently running
	const isRefinementRunning =
		activeRefinement?.status === "running" || activeRefinement?.status === "pending";

	return (
		<div className="space-y-3">
			{/* Refinement Running Loader */}
			{isRefinementRunning && (
				<div className="border border-amber-200 bg-amber-50 rounded-md p-4">
					<div className="flex items-center gap-3">
						<div className="shrink-0">
							<Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-amber-800">Calculating Income</h3>
							<p className="text-xs text-amber-600 mt-0.5">
								{activeRefinement?.status === "pending"
									? "Queued — waiting for the income worker to start. If this lasts more than a minute, check that gunnr-aeu-worker-dev is running (docker compose logs)."
									: "Income rules are running. Bank statement and Non-QM flows can take several minutes; keep this tab open."}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Expense Factor - Bank Statement only, above Summary */}
			{isBankStatementScenario && scenario.status === "completed" && !isRefinementRunning && (
				<div className="border border-slate-200 rounded-md p-3 bg-white">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-slate-700">Qualifying Factor</h3>
							<p className="text-xs text-slate-500 mt-0.5">
								Percentage of deposits treated as qualifying income
							</p>
						</div>
						<div className="flex items-center gap-2">
							{isEditingExpenseFactor ? (
								<>
									<div className="flex items-center">
										<input
											type="number"
											min="1"
											max="99"
											value={editExpenseFactorValue}
											onChange={(e) => setEditExpenseFactorValue(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleSaveExpenseFactor();
												if (e.key === "Escape") handleCancelEditExpenseFactor();
											}}
											disabled={isUpdatingExpenseFactor}
											className="w-16 px-2 py-1 text-sm border border-orange-400 rounded-l-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-right"
											autoFocus
										/>
										<span className="px-2 py-1 text-sm bg-slate-100 border-y border-r border-slate-300 rounded-r-md text-slate-600">
											%
										</span>
									</div>
									<button
										onClick={handleSaveExpenseFactor}
										disabled={isUpdatingExpenseFactor}
										className="px-3 py-1 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md disabled:opacity-50 flex items-center gap-1"
									>
										{isUpdatingExpenseFactor ? (
											<Loader2 className="w-3.5 h-3.5 animate-spin" />
										) : (
											"Save"
										)}
									</button>
									<button
										onClick={handleCancelEditExpenseFactor}
										disabled={isUpdatingExpenseFactor}
										className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md disabled:opacity-50"
									>
										Cancel
									</button>
								</>
							) : (
								<>
									<span className="text-sm font-medium text-slate-700">
										{currentExpenseFactorPercent}%
									</span>
									<button
										onClick={handleStartEditExpenseFactor}
										className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
									>
										Change
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Summary */}
			{scenario.status === "completed" && (
				<div className="border border-slate-200 rounded-md p-3">
					<h3 className="text-sm font-semibold text-slate-700 mb-1.5">Summary</h3>
					{(activeRefinement?.note ?? scenario.note) ? (
						<div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
							{activeRefinement?.note ?? scenario.note}
						</div>
					) : (
						<p className="text-sm text-slate-500">
							Income calculated using{" "}
							{scenario.approach === "qualified_mortgage" ? "Qualified Mortgage" : "Non-QM"} rules.
							{selectedDocumentIds.size === 0 && " All available documents were included."}
						</p>
					)}
				</div>
			)}

			{/* Overall Result */}
			{scenario.status === "completed" &&
				(activeRefinement?.total_monthly_income ?? scenario.total_monthly_income) !== null && (
					<div className="bg-green-50 border border-green-200 rounded-md p-3">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-base font-semibold text-green-800">
									Qualifying Monthly Income
								</h2>
								<p className="text-xs text-green-600 mt-0.5">Combined total across all borrowers</p>
							</div>
							<div className="text-right">
								<p className="text-3xl font-bold text-green-700">
									{formatCurrency(
										(activeRefinement?.total_monthly_income ?? scenario.total_monthly_income)!,
									)}
								</p>
								<p className="text-xs text-green-600">per month</p>
							</div>
						</div>
					</div>
				)}

			{/* Non-QM: income results rendered inline (no separate product tabs) */}
			{isNonQmScenario && scenario.status === "completed" && (
				<div className="space-y-4">
					{incomeLoading ? (
						<div className="flex items-center justify-center gap-2 py-6 text-slate-500">
							<Loader2 className="w-4 h-4 animate-spin" />
							<span className="text-sm">Loading income results...</span>
						</div>
					) : (
						scenario.loan_product_ids?.map((productId) => {
							const canonicalProductId =
								productId === "bank_statement" ? "non_qm_bank_statement" : productId;
							const productResult =
								incomeResponse?.income_verifications?.[canonicalProductId] ??
								incomeResponse?.income_verifications?.[productId];
							if (!productResult) return null;

							return (
								<div key={productId} className="space-y-3">
									{/* Party sections */}
									{productResult.parties?.map((party) => (
										<div key={party.party_id} className="space-y-3">
											<h4 className="text-sm font-medium text-slate-600">{party.name}</h4>

											{party.sections
												.sort((a, b) => a.priority - b.priority)
												.map((section) => (
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
														caseId={caseId ?? ""}
														entities={section.entities?.map((entity) => ({
															id: entity.entity_id,
															name: entity.entity_name,
															type: entity.entity_type,
															components: toTableComponents((entity.components as any) || []),
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
												))}

											<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
												<span className="text-sm text-blue-700 font-medium">
													Total for {party.name}
												</span>
												<span className="text-lg font-bold text-blue-800">
													$
													{party.qualifying_monthly.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
													/mo
												</span>
											</div>
										</div>
									))}
								</div>
							);
						})
					)}
				</div>
			)}

			{/* Borrowers, Documents, Loan Products: QM only */}
			{!isNonQmScenario && (
				<>
					{/* Borrowers Table */}
					<div className="border border-slate-200 rounded-md overflow-hidden">
						<div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
							<User className="w-4 h-4 text-slate-500" />
							<h3 className="text-sm font-semibold text-slate-700">Borrowers</h3>
							<span className="ml-auto text-xs text-slate-500">
								{selectedBorrowers.length} included, {excludedBorrowers.length} excluded
							</span>
						</div>
						<table className="w-full text-sm">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Status
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Name
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Role
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Type
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{selectedBorrowers.map((b, i) => (
									<tr key={`sel-${i}`} className="bg-white">
										<td className="px-4 py-2">
											<span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
												<CheckCircle className="w-3.5 h-3.5" />
												Included
											</span>
										</td>
										<td className="px-4 py-2 text-slate-800 font-medium">
											{b.display_name || b.canonical_name}
										</td>
										<td className="px-4 py-2 text-slate-600">{b.borrower_role || "—"}</td>
										<td className="px-4 py-2 text-slate-600 capitalize">
											{b.entity_type || "individual"}
										</td>
									</tr>
								))}
								{excludedBorrowers.map((b, i) => (
									<tr key={`exc-${i}`} className="bg-slate-50/50">
										<td className="px-4 py-2">
											<span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
												<XCircle className="w-3.5 h-3.5" />
												Excluded
											</span>
										</td>
										<td className="px-4 py-2 text-slate-400">
											{b.display_name || b.canonical_name}
										</td>
										<td className="px-4 py-2 text-slate-400">{b.borrower_role || "—"}</td>
										<td className="px-4 py-2 text-slate-400 capitalize">
											{b.entity_type || "individual"}
										</td>
									</tr>
								))}
								{allBorrowers.length === 0 && (
									<tr>
										<td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">
											No borrowers found
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Documents Table */}
					<div className="border border-slate-200 rounded-md overflow-hidden">
						<div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
							<FileText className="w-4 h-4 text-slate-500" />
							<h3 className="text-sm font-semibold text-slate-700">Documents</h3>
							<span className="ml-auto text-xs text-slate-500">
								{documentGroups.reduce((sum, g) => sum + g.selected.length, 0)} included,{" "}
								{documentGroups.reduce((sum, g) => sum + g.excluded.length, 0)} excluded
							</span>
						</div>
						{/* Warning if no document_ids stored */}
						{selectedDocumentIds.size === 0 && allDocuments.length > 0 && (
							<div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
								No document selection stored in scenario. This may indicate a backend issue.
							</div>
						)}
						<table className="w-full text-sm">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Status
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Document
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Type
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Year
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{documentGroups.flatMap((group) => [
									...group.selected.map((doc, i) => {
										const year = doc.effective_period?.period_end?.slice(0, 4);
										return (
											<tr key={`sel-${doc.id}`} className="bg-white">
												<td className="px-4 py-2">
													<span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
														<CheckCircle className="w-3.5 h-3.5" />
														Included
													</span>
												</td>
												<td className="px-4 py-2 text-slate-800 font-medium">
													{doc.description || `${group.displayName} ${i + 1}`}
												</td>
												<td className="px-4 py-2 text-slate-600">{group.displayName}</td>
												<td className="px-4 py-2 text-slate-600">{year || "—"}</td>
											</tr>
										);
									}),
									...group.excluded.map((doc, i) => {
										const year = doc.effective_period?.period_end?.slice(0, 4);
										return (
											<tr key={`exc-${doc.id}`} className="bg-slate-50/50">
												<td className="px-4 py-2">
													<span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
														<XCircle className="w-3.5 h-3.5" />
														Excluded
													</span>
												</td>
												<td className="px-4 py-2 text-slate-400">
													{doc.description ||
														`${group.displayName} ${group.selected.length + i + 1}`}
												</td>
												<td className="px-4 py-2 text-slate-400">{group.displayName}</td>
												<td className="px-4 py-2 text-slate-400">{year || "—"}</td>
											</tr>
										);
									}),
								])}
								{allDocuments.length === 0 && (
									<tr>
										<td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">
											No documents found
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					{/* Loan Products Table */}
					<div className="border border-slate-200 rounded-md overflow-hidden">
						<div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
							<Building2 className="w-4 h-4 text-slate-500" />
							<h3 className="text-sm font-semibold text-slate-700">Loan Products</h3>
							<span className="ml-auto text-xs text-slate-500">
								{scenario.loan_product_ids?.length ?? 0} selected
							</span>
						</div>
						<table className="w-full text-sm">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Status
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										Product
									</th>
									<th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
										ID
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{scenario.loan_product_ids?.map((productId) => (
									<tr key={productId} className="bg-white">
										<td className="px-4 py-2">
											<span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
												<CheckCircle className="w-3.5 h-3.5" />
												Selected
											</span>
										</td>
										<td className="px-4 py-2 text-slate-800 font-medium">
											{getProductName(productId)}
										</td>
										<td className="px-4 py-2 text-slate-500 font-mono text-xs">{productId}</td>
									</tr>
								))}
								{(!scenario.loan_product_ids || scenario.loan_product_ids.length === 0) && (
									<tr>
										<td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">
											No products selected
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</>
			)}

			{/* Income Advisor - Easter egg button */}
			{scenario.status === "completed" && caseId && (
				<div className="flex justify-end">
					<button
						onClick={() => setIsAdvisorOpen(true)}
						className="group flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-xs"
						title="Income optimization advisor"
					>
						<Wand2 className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
						<span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">
							What if...
						</span>
					</button>
				</div>
			)}

			{/* Income Advisor Modal */}
			{caseId && (
				<IncomeAdvisorModal
					isOpen={isAdvisorOpen}
					onClose={() => setIsAdvisorOpen(false)}
					caseId={caseId}
					scenarioId={scenario.scenario_id}
					currentApproach={scenario.approach}
					currentIncome={scenario.total_monthly_income ?? undefined}
				/>
			)}
		</div>
	);
}

export default ScenarioSummaryPage;
