/**
 * Download as Excel modal – choose export type, scenario (for income), and optional includes.
 * Uses reports API: catalog + excel-url.
 */

import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";

// API types (match backend ReportCatalogResponse, ReportInfo, ScenarioOption, ReportExcelUrlResponse)
export interface ScenarioOption {
	scenario_id: string;
	name: string;
	version: number;
	is_latest: boolean;
	loan_products: string[];
	qualifying_income: number | null;
	refinement_id: string | null;
}

export interface ReportInfo {
	report_type: string;
	available: boolean;
	label: string;
	description: string;
	scenarios: ScenarioOption[] | null;
}

export interface ReportCatalogResponse {
	case_id: string;
	reports: ReportInfo[];
}

export interface ReportExcelUrlResponse {
	signed_url: string;
	filename: string;
	expires_in_seconds?: number;
	report_type: string;
	version: string;
}

type ExportType = "scenario" | "extraction";

interface DownloadAsExcelModalProps {
	isOpen: boolean;
	onClose: () => void;
	caseId: string;
}

export function DownloadAsExcelModal({ isOpen, onClose, caseId }: DownloadAsExcelModalProps) {
	const [exportType, setExportType] = useState<ExportType>("scenario");
	const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
	const [includeCredit, setIncludeCredit] = useState(false);
	const [includeDti, setIncludeDti] = useState(false);
	// Assets: "Soon" – disabled for now
	const [catalog, setCatalog] = useState<ReportCatalogResponse | null>(null);
	const [catalogLoading, setCatalogLoading] = useState(false);
	const [catalogError, setCatalogError] = useState<string | null>(null);
	const [generating, setGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);

	const scenarioReport = catalog?.reports.find((r) => r.report_type === "scenario");
	const extractionReport = catalog?.reports.find((r) => r.report_type === "extraction");
	const creditReport = catalog?.reports.find((r) => r.report_type === "credit");
	const scenarios = useMemo(() => scenarioReport?.scenarios ?? [], [scenarioReport]);
	const scenarioAvailable = scenarioReport?.available ?? false;
	const extractionAvailable = extractionReport?.available ?? false;
	const creditAvailable = creditReport?.available ?? false;

	const canGenerateScenario = exportType === "scenario" && selectedScenarioId && scenarioAvailable;
	const canGenerateExtraction = exportType === "extraction" && extractionAvailable;
	const canGenerate = generating
		? false
		: exportType === "scenario"
			? canGenerateScenario
			: canGenerateExtraction;

	const PAGE_SIZE = 3;
	const [scenarioPage, setScenarioPage] = useState(0);
	const totalPages = useMemo(() => Math.ceil(scenarios.length / PAGE_SIZE), [scenarios.length]);
	const visibleScenarios = useMemo(
		() => scenarios.slice(scenarioPage * PAGE_SIZE, (scenarioPage + 1) * PAGE_SIZE),
		[scenarios, scenarioPage],
	);

	// Fetch catalog when modal opens
	useEffect(() => {
		if (!isOpen || !caseId) return;
		let cancelled = false;
		setCatalogError(null);
		setCatalogLoading(true);
		apiRequest<ReportCatalogResponse>(`/api/v1/cases/${caseId}/reports`)
			.then((data) => {
				if (!cancelled) {
					setCatalog(data);
					if (
						exportType === "scenario" &&
						data.reports.find((r) => r.report_type === "scenario")?.scenarios?.length
					) {
						const latest = data.reports
							.find((r) => r.report_type === "scenario")
							?.scenarios?.find((s) => s.is_latest);
						setSelectedScenarioId(
							latest?.scenario_id ??
								data.reports.find((r) => r.report_type === "scenario")?.scenarios?.[0]
									?.scenario_id ??
								null,
						);
					} else {
						setSelectedScenarioId(null);
					}
				}
			})
			.catch((err) => {
				if (!cancelled) setCatalogError(err?.message ?? "Failed to load report options");
			})
			.finally(() => {
				if (!cancelled) setCatalogLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, caseId, exportType]);

	useEffect(() => {
		if (!creditAvailable) {
			setIncludeCredit(false);
		}
	}, [creditAvailable]);

	useEffect(() => {
		if (!isOpen) {
			setIncludeCredit(false);
			setIncludeDti(false);
		}
	}, [isOpen]);

	const handleGenerate = useCallback(async () => {
		if (!caseId || !canGenerate) return;
		setGenerateError(null);
		setGenerating(true);
		try {
			const reportType = exportType === "scenario" ? "scenario" : "extraction";
			const params = new URLSearchParams();
			if (reportType === "scenario" && selectedScenarioId) {
				params.set("scenario_id", selectedScenarioId);
			}
			const extras: string[] = [];
			if (includeCredit) extras.push("credit");
			if (includeDti) extras.push("dti");
			if (extras.length > 0) {
				params.set("include", extras.join(","));
			}
			const qs = params.toString();
			const url = `/api/v1/cases/${caseId}/reports/${reportType}/excel-url${qs ? `?${qs}` : ""}`;
			const res = await apiRequest<ReportExcelUrlResponse>(url);
			if (res.signed_url) {
				const a = document.createElement("a");
				a.href = res.signed_url;
				a.download = res.filename || "report.xlsx";
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				onClose();
			} else {
				setGenerateError("Failed to generate Excel: " + JSON.stringify(res));
			}
		} catch (err: unknown) {
			setGenerateError(err instanceof Error ? err.message : "Failed to generate Excel");
		} finally {
			setGenerating(false);
		}
	}, [caseId, exportType, selectedScenarioId, includeCredit, includeDti, canGenerate, onClose]);

	const formatQualifying = (q: number | null) =>
		q != null ? `$${q.toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo qualifying` : "";

	const PRODUCT_LABELS: Record<string, string> = {
		fannie_mae: "Fannie Mae",
		freddie_mac: "Freddie Mac",
		fha: "FHA",
		usda: "USDA",
		va: "VA",
		bank_statement: "Bank Statement",
		non_qm_bank_statement: "Bank Statement",
		irs_1099_income: "1099 Income",
		fnma_selling_guide: "Fannie Mae",
		fhlmc_selling_guide: "Freddie Mac",
		fha_handbook: "FHA",
		usda_handbook: "USDA",
		va_handbook: "VA",
	};
	const formatProducts = (ids: string[]) =>
		ids
			.map(
				(id) =>
					PRODUCT_LABELS[id] || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			)
			.join(" \u2022 ");

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-lg bg-white">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Download className="h-5 w-5 text-emerald-600" />
						<DialogTitle>Download as Excel</DialogTitle>
					</div>
					<DialogDescription>Choose what to export.</DialogDescription>
				</DialogHeader>

				{catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

				<div className="space-y-5">
					{/* What do you want to export? */}
					<div>
						<p className="text-sm font-medium text-slate-700 mb-2">What do you want to export?</p>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setExportType("scenario")}
								className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
									exportType === "scenario"
										? "border-amber-500 bg-amber-50/50"
										: "border-slate-200 hover:border-slate-300 bg-white"
								}`}
							>
								<span
									className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${
										exportType === "scenario" ? "border-amber-500 bg-amber-500" : "border-slate-300"
									}`}
								/>
								<div>
									<span className="text-sm font-medium text-slate-900">Income Scenario</span>
									<p className="text-xs text-slate-500 mt-0.5">
										Qualifying income summary by product
									</p>
								</div>
							</button>
							<button
								type="button"
								onClick={() => setExportType("extraction")}
								className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
									exportType === "extraction"
										? "border-amber-500 bg-amber-50/50"
										: "border-slate-200 hover:border-slate-300 bg-white"
								}`}
							>
								<span
									className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${
										exportType === "extraction"
											? "border-amber-500 bg-amber-500"
											: "border-slate-300"
									}`}
								/>
								<div>
									<span className="text-sm font-medium text-slate-900">Extracted Values</span>
									<p className="text-xs text-slate-500 mt-0.5">
										Raw facts pulled from all documents
									</p>
								</div>
							</button>
						</div>
					</div>

					{/* Extracted Values description */}
					{exportType === "extraction" && (
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-sm text-slate-600">
								Exports all field-level values extracted from your uploaded documents &mdash; wages,
								employer names, dates, form types, and more &mdash; as a structured spreadsheet.
							</p>
						</div>
					)}

					{/* Income Scenario * (when scenario selected) */}
					{exportType === "scenario" && (
						<div>
							<p className="text-sm font-medium text-slate-700 mb-2">
								Income Scenario <span className="text-red-500">*</span>
							</p>
							{catalogLoading ? (
								<p className="text-sm text-slate-500">Loading scenarios…</p>
							) : scenarios.length === 0 ? (
								<p className="text-sm text-slate-500">No income scenarios available.</p>
							) : (
								<div className="space-y-2">
									{visibleScenarios.map((s) => (
										<button
											key={s.scenario_id}
											type="button"
											onClick={() => setSelectedScenarioId(s.scenario_id)}
											className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
												selectedScenarioId === s.scenario_id
													? "border-amber-500 bg-amber-50/50"
													: "border-slate-200 hover:border-slate-300 bg-white"
											}`}
										>
											<span
												className={`shrink-0 w-4 h-4 rounded-full border-2 ${
													selectedScenarioId === s.scenario_id
														? "border-amber-500 bg-amber-500"
														: "border-slate-300"
												}`}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium text-slate-900">{s.name}</span>
													{s.is_latest && (
														<span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
															latest
														</span>
													)}
												</div>
												<p className="text-xs text-slate-500 mt-0.5">
													{formatProducts(s.loan_products)}
													{s.qualifying_income != null
														? ` \u00B7 ${formatQualifying(s.qualifying_income)}`
														: ""}
												</p>
											</div>
										</button>
									))}
									{totalPages > 1 && (
										<div className="flex items-center justify-between pt-1">
											<button
												type="button"
												disabled={scenarioPage === 0}
												onClick={() => setScenarioPage((p) => p - 1)}
												className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
											>
												<ChevronLeft className="w-3.5 h-3.5" />
												Previous
											</button>
											<span className="text-xs text-slate-400">
												{scenarioPage + 1} / {totalPages}
											</span>
											<button
												type="button"
												disabled={scenarioPage >= totalPages - 1}
												onClick={() => setScenarioPage((p) => p + 1)}
												className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
											>
												Next
												<ChevronRight className="w-3.5 h-3.5" />
											</button>
										</div>
									)}
								</div>
							)}
						</div>
					)}

					{/* ALSO INCLUDE (OPTIONAL) - only for Income Scenario */}
					{exportType === "scenario" && (
						<div>
							<p className="text-sm font-medium text-slate-700 mb-2">ALSO INCLUDE (OPTIONAL)</p>
							<div className="space-y-3">
								<label className="flex items-start gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={includeCredit}
										onChange={(e) => setIncludeCredit(e.target.checked)}
										disabled={!creditAvailable}
										className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
									<div>
										<span className="text-sm text-slate-900">Credit Data</span>
										<p className="text-xs text-slate-500">
											{creditAvailable
												? "Includes credit scores and trade lines when available."
												: "Unavailable: no credit snapshot found for this case."}
										</p>
									</div>
								</label>
								<label className="flex items-start gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={includeDti}
										onChange={(e) => setIncludeDti(e.target.checked)}
										disabled={!creditAvailable}
										className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
									<div>
										<span className="text-sm text-slate-900">DTI & Ratios</span>
										<p className="text-xs text-slate-500">
											{creditAvailable
												? "Uses credit snapshot data when available."
												: "Unavailable: no credit snapshot found for this case."}
										</p>
									</div>
								</label>
								<label className="flex items-start gap-3 cursor-pointer opacity-60">
									<input type="checkbox" disabled className="mt-1 rounded border-slate-300" />
									<div>
										<span className="text-sm text-slate-900">Assets</span>
										<span className="text-xs text-slate-400 ml-1">Soon</span>
									</div>
								</label>
							</div>
						</div>
					)}
				</div>

				{generateError && <p className="text-sm text-red-600">{generateError}</p>}

				<DialogFooter className="gap-2 sm:gap-0">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleGenerate}
						disabled={!canGenerate}
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md disabled:opacity-50 disabled:pointer-events-none"
					>
						{generating ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Generate Excel
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
