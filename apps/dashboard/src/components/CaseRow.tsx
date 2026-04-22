import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { StoredCase } from "../hooks/useCaseHistory";
import {
	useIncomeVerification,
	useCreditVerification,
	useWorkflowStatus,
	useCaseResult,
	useCaseQueryInvalidation,
} from "../hooks/useCaseQueries";
import { Briefcase, FileSpreadsheet } from "lucide-react";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { useAuth } from "../hooks/useAuth";
import { ExcelViewer } from "./shared/ExcelViewer";
import { useAppDispatch } from "../store";
import { setSelectedLoanProduct } from "../store/appSlice";
import { startIncomeVerification } from "../hooks/useApi";
import { resolveApiUrl } from "../lib/api";

function NavItem({
	label,
	isCurrent,
	onClick,
	onExcelDownload,
	excelLoading,
}: {
	label: string;
	isCurrent: boolean;
	onClick: () => void;
	onExcelDownload?: () => void;
	excelLoading?: boolean;
}) {
	return (
		<div className="flex items-center group">
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					if (!isCurrent) onClick();
				}}
				className={`flex items-center gap-2 py-1.5 px-2 flex-1 text-left text-sm font-normal text-slate-700 rounded-r transition-colors ${
					isCurrent ? "bg-slate-50 text-slate-900" : "hover:bg-slate-50 hover:text-slate-900"
				}`}
			>
				<span className="flex-1">{label}</span>
			</button>
			{onExcelDownload && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onExcelDownload();
					}}
					disabled={excelLoading}
					className="p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-slate-100 rounded transition-all cursor-pointer disabled:cursor-wait"
					title={`Download ${label} Excel`}
				>
					{excelLoading ? (
						<svg
							className="w-3.5 h-3.5 animate-spin text-slate-400"
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
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
					) : (
						<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
					)}
				</button>
			)}
		</div>
	);
}

/** Humanize product id for display (e.g. fannie_mae -> "Fannie Mae") */
function humanizeProductId(productId: string): string {
	return productId
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/** Which section of the case is active (for "Current" pill on nav items) */
function getCurrentSection(
	pathname: string,
	caseId: string,
): "review" | "documents" | "scenario" | "income" | "credit" | "bank-statements" | null {
	const base = `/case/${caseId}`;
	if (pathname === `${base}/view`) return "documents";
	if (pathname === `${base}/new-scenario`) return "scenario";
	if (pathname === `${base}/income`) return "income";
	if (pathname === `${base}/credit`) return "credit";
	if (pathname === `${base}/bank-statements`) return "bank-statements";
	if (pathname === base || pathname === `${base}/`) return "review"; // case index = ReviewView
	if (pathname.startsWith(base)) return "review"; // fallback for other sub-routes
	return null;
}

interface CaseRowProps {
	caseData: StoredCase;
	onUpdateName: (caseId: string, name: string) => void;
	onRemove: (caseId: string) => Promise<void>;
	currentCaseId?: string;
	showTimeHistory?: boolean;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onCaseSectionClick?: () => void;
}

export function CaseRow({
	caseData,
	onUpdateName,
	onRemove,
	currentCaseId,
	showTimeHistory: showTimeHistoryProp = true,
	isExpanded,
	onToggleExpand,
	onCaseSectionClick,
}: CaseRowProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(caseData.name);
	const inputRef = useRef<HTMLInputElement>(null);
	const showTimeHistory = showTimeHistoryProp;

	const { data: incomeData } = useIncomeVerification(caseData.case_id, undefined, {
		enabled: isExpanded,
	});
	const { data: creditData } = useCreditVerification(caseData.case_id, { enabled: isExpanded });
	const { data: workflowStatus } = useWorkflowStatus(caseData.case_id, { enabled: isExpanded });
	const { data: caseResult } = useCaseResult(caseData.case_id, { enabled: isExpanded });

	const { invalidateWorkflows, invalidateIncome, invalidateCredit } = useCaseQueryInvalidation();
	const { user } = useAuth();
	const dispatch = useAppDispatch();

	const handleBankStatementsClick = async () => {
		onCaseSectionClick?.();
		navigate(`/case/${caseData.case_id}/bank-statements`);
		dispatch(setSelectedLoanProduct("non_qm_bank_statement"));

		const isIncomeRunning =
			workflowStatus?.workflows?.find((w) => w.workflow_type === "income")?.status === "running";
		const hasRun = incomeData?.income_verifications?.["non_qm_bank_statement"];
		if (!hasRun && !isIncomeRunning) {
			try {
				await startIncomeVerification(caseData.case_id, "non_qm_bank_statement");
				invalidateWorkflows(caseData.case_id);
			} catch (error) {
				console.error("Failed to auto-start non-qm income from CaseRow", error);
			}
		}
	};

	// Excel viewer state
	const [excelLoading, setExcelLoading] = useState<Record<string, boolean>>({});
	const [excelViewer, setExcelViewer] = useState<{
		signedUrl: string;
		filename: string;
		stage: string;
	} | null>(null);

	const handleExcelView = useCallback(
		async (stage: string, productId?: string) => {
			console.log(
				"[ExcelView] Opening viewer for stage:",
				stage,
				productId ? `product: ${productId}` : "",
			);
			if (!user) {
				console.warn("[ExcelView] No user, cannot fetch");
				return;
			}
			const loadingKey = productId ? `${stage}_${productId}` : stage;
			setExcelLoading((prev) => ({ ...prev, [loadingKey]: true }));
			try {
				const token = await user.getIdToken();
				// For income/credit stages, include product query param
				let url = `/api/v1/cases/${caseData.case_id}/stages/${stage}/excel-url`;
				if (productId && (stage === "income" || stage === "credit")) {
					url += `?product=${encodeURIComponent(productId)}`;
				}
				const response = await fetch(resolveApiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					throw new Error((err as { detail?: string }).detail || "Failed to get Excel URL");
				}
				const data = (await response.json()) as { signed_url: string; filename: string };
				console.log("[ExcelView] Got URL, opening viewer:", data.filename);
				setExcelViewer({ signedUrl: data.signed_url, filename: data.filename, stage });
			} catch (error) {
				console.error(`[ExcelView] Failed to load ${stage} Excel:`, error);
			} finally {
				setExcelLoading((prev) => ({ ...prev, [loadingKey]: false }));
			}
		},
		[caseData.case_id, user],
	);

	const hasDocuments = useMemo(() => {
		if (!caseResult) return false;
		const docs = caseResult.extractions?.documents ?? [];
		return Array.isArray(docs) && docs.length > 0;
	}, [caseResult]);

	const incomeWorkflow = workflowStatus?.workflows?.find((w) => w.workflow_type === "income");
	const creditWorkflow = workflowStatus?.workflows?.find((w) => w.workflow_type === "credit");
	const isIncomeRunning = incomeWorkflow?.status === "running";
	const isCreditRunning = creditWorkflow?.status === "running";

	const prevIncomeStatusRef = useRef<string | undefined>(incomeWorkflow?.status);
	const prevCreditStatusRef = useRef<string | undefined>(creditWorkflow?.status);

	const productIds = useMemo(() => {
		const incomeIds = incomeData?.income_verifications
			? Object.keys(incomeData.income_verifications)
			: [];
		const creditIds = creditData?.credit_verifications
			? Object.keys(creditData.credit_verifications)
			: [];
		return Array.from(new Set([...incomeIds, ...creditIds]));
	}, [incomeData?.income_verifications, creditData?.credit_verifications]);

	const hasParties = useMemo(() => {
		const p = caseResult?.extractions?.parties;
		if (Array.isArray(p)) return p.length > 0;
		const nested = (p as { parties?: unknown[] } | undefined)?.parties;
		return Array.isArray(nested) && nested.length > 0;
	}, [caseResult]);

	// Poll workflow status while income or credit verification is running (only when row is expanded)
	useEffect(() => {
		if ((!isIncomeRunning && !isCreditRunning) || !isExpanded) return;
		const interval = setInterval(() => invalidateWorkflows(caseData.case_id), 3000);
		return () => clearInterval(interval);
	}, [isIncomeRunning, isCreditRunning, isExpanded, caseData.case_id, invalidateWorkflows]);

	// Refetch income when income workflow stops (completed/failed/terminated/etc.)
	useEffect(() => {
		const prev = prevIncomeStatusRef.current;
		const curr = incomeWorkflow?.status;
		prevIncomeStatusRef.current = curr;

		if (prev === "running" && curr && curr !== "running") {
			invalidateIncome(caseData.case_id);
		}
	}, [incomeWorkflow?.status, caseData.case_id, invalidateIncome]);

	// Refetch credit when credit workflow stops (completed/failed/terminated/etc.)
	useEffect(() => {
		const prev = prevCreditStatusRef.current;
		const curr = creditWorkflow?.status;
		prevCreditStatusRef.current = curr;

		if (prev === "running" && curr && curr !== "running") {
			invalidateCredit(caseData.case_id);
		}
	}, [creditWorkflow?.status, caseData.case_id, invalidateCredit]);

	const currentSection =
		currentCaseId && caseData.case_id === currentCaseId
			? getCurrentSection(location.pathname, caseData.case_id)
			: null;

	const productParam =
		currentSection === "income" || currentSection === "credit"
			? new URLSearchParams(location.search).get("product")
			: null;

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleSave = () => {
		const trimmed = editValue.trim();
		onUpdateName(caseData.case_id, trimmed);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(caseData.name);
			setIsEditing(false);
		}
	};

	const handleRowClick = (e: React.MouseEvent) => {
		// Don't expand/navigate when clicking edit controls (e.g. inline name edit)
		if ((e.target as HTMLElement).closest(".edit-controls")) return;
		// Don't expand when clicking the delete button — only delete
		if ((e.target as HTMLElement).closest("[data-case-delete]")) return;
		// Don't expand when clicking product section (product name or Income link)
		if ((e.target as HTMLElement).closest("[data-case-row-ignore]")) return;
		onCaseSectionClick?.();
		onToggleExpand();
		if (!isCurrentCase) {
			navigate(`/case/${caseData.case_id}`);
		}
	};

	const displayName = caseData.name || "Untitled Case";
	const isCurrentCase = currentCaseId && caseData.case_id === currentCaseId;

	return (
		<div
			onClick={handleRowClick}
			className={`group flex flex-col gap-1 px-2 py-2.5 rounded-sm border transition-all cursor-pointer ${
				isCurrentCase
					? "bg-white border-slate-300 shadow-sm"
					: "bg-white border-slate-200 hover:border-slate-300"
			}`}
		>
			{/* Root row: chevron + case name (bold, larger) + file icon + delete */}
			<div className={`flex gap-2 ${isExpanded ? "items-start" : "items-center"}`}>
				{isEditing ? (
					<div className="flex items-center gap-2 flex-1 edit-controls">
						<input
							ref={inputRef}
							type="text"
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							onBlur={handleSave}
							onKeyDown={handleKeyDown}
							placeholder="Enter case name..."
							className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
						/>
					</div>
				) : (
					<>
						<div className="relative flex-1 min-w-0">
							<div className="flex items-center gap-2 w-full min-h-[28px]">
								<svg
									className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
								<Briefcase className="w-4 h-4 shrink-0 text-slate-500" strokeWidth={1.75} />
								<span className="truncate flex-1 text-left text-sm font-semibold text-slate-900">
									{displayName}
								</span>
							</div>

							{/* Nested nav: vertical line + Documents, Review, product sections */}
							{isExpanded && (
								<div className="mt-1.5 ml-2 pl-3 border-l border-slate-200 space-y-0.5">
									{showTimeHistory && (
										<p className="text-xs text-slate-400 mb-1.5 pl-0.5">
											Last opened {formatRelativeTime(caseData.lastOpenedAt)}
										</p>
									)}
									<div className="pl-0.5">
										{hasDocuments && (
											<NavItem
												label="Documents"
												isCurrent={currentSection === "documents"}
												onClick={() => {
													onCaseSectionClick?.();
													navigate(`/case/${caseData.case_id}/view`);
												}}
												onExcelDownload={() => handleExcelView("intake")}
												excelLoading={excelLoading["intake"]}
											/>
										)}
										<NavItem
											label="Extraction"
											isCurrent={currentSection === "review"}
											onClick={() => {
												onCaseSectionClick?.();
												navigate(`/case/${caseData.case_id}`);
											}}
											onExcelDownload={() => handleExcelView("extraction")}
											excelLoading={excelLoading["extraction"]}
										/>
										{hasParties && (
											<NavItem
												label="Scenario"
												isCurrent={currentSection === "scenario"}
												onClick={() => {
													onCaseSectionClick?.();
													navigate(`/case/${caseData.case_id}/new-scenario`);
												}}
											/>
										)}
										<NavItem
											label="Bank Statements"
											isCurrent={currentSection === "bank-statements"}
											onClick={handleBankStatementsClick}
										/>
									</div>
									{isIncomeRunning || isCreditRunning ? (
										<div className="mt-1 pl-0.5 flex items-center gap-2 py-1" data-case-row-ignore>
											<svg
												className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-500"
												fill="none"
												viewBox="0 0 24 24"
												aria-hidden
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
											<span className="text-xs text-slate-600">Verifying</span>
										</div>
									) : (
										productIds.length > 0 &&
										productIds.map((productId) => {
											return (
												<div key={productId} className="mt-1 pl-0.5" data-case-row-ignore>
													<div className="flex items-center gap-1.5 py-1 pr-2">
														<svg
															className="w-3.5 h-3.5 shrink-0 text-slate-500"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															strokeWidth={2}
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																d="M19 9l-7 7-7-7"
															/>
														</svg>
														<span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
															{humanizeProductId(productId)}
														</span>
													</div>
													<div className="ml-4 pl-2 border-l border-slate-100">
														<NavItem
															label={"Income"}
															isCurrent={currentSection === "income" && productParam === productId}
															onClick={() => {
																onCaseSectionClick?.();
																navigate(
																	`/case/${caseData.case_id}/income?product=${encodeURIComponent(productId)}`,
																);
															}}
															onExcelDownload={() => handleExcelView("income", productId)}
															excelLoading={excelLoading[`income_${productId}`]}
														/>
														{creditData?.credit_verifications?.[productId] && (
															<NavItem
																label={"Credit"}
																isCurrent={
																	currentSection === "credit" && productParam === productId
																}
																onClick={() => {
																	onCaseSectionClick?.();
																	navigate(
																		`/case/${caseData.case_id}/credit?product=${encodeURIComponent(productId)}`,
																	);
																}}
																onExcelDownload={() => handleExcelView("credit", productId)}
																excelLoading={excelLoading[`credit_${productId}`]}
															/>
														)}
													</div>
												</div>
											);
										})
									)}
								</div>
							)}
						</div>
					</>
				)}
				<button
					data-case-delete
					onClick={(e) => {
						e.stopPropagation();
						onRemove(caseData.case_id);
					}}
					className="shrink-0 ml-auto p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
					title="Remove from history"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3-3V4a2 2 0 012-2h4a2 2 0 012 2v2m-6 12h12"
						/>
					</svg>
				</button>
			</div>

			{/* Excel Viewer Modal */}
			{excelViewer && (
				<ExcelViewer
					signedUrl={excelViewer.signedUrl}
					filename={excelViewer.filename}
					stage={excelViewer.stage}
					onClose={() => setExcelViewer(null)}
				/>
			)}
		</div>
	);
}
