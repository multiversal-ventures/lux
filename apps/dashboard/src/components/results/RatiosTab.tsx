import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, ShieldCheck, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cancelWorkflows } from "../../hooks/useApi";
import {
	caseKeys,
	useCaseScenarios,
	useCaseStatus,
	useCreditPullStatus,
	useCreditVerification,
	useIncomeVerification,
	useWorkflowStatus,
} from "../../hooks/useCaseQueries";
import { api } from "../../lib/api";
import { InlineWorkflowProgressMulti, UploadModal } from "../shared";
import { PullCreditModal } from "./PullCreditModal";

/**
 * Upload state machine for tracking extraction progress.
 * - idle: No upload in progress
 * - extracting: Extraction workflow running
 */
type UploadPhase = "idle" | "extracting" | "error";

interface UploadState {
	phase: UploadPhase;
	fileNames: string[];
	errorMessage?: string;
}

interface RatiosTabProps {
	caseId: string;
}

const DEFAULT_MAX_ALLOWABLE_DTI = 45;

const LOAN_PRODUCT_CONFIG: Record<string, { label: string; maxAllowableDti: number | null }> = {
	// QM / Agency loans — have regulatory DTI caps
	fannie_mae: { label: "Fannie Mae", maxAllowableDti: 45 },
	freddie_mac: { label: "Freddie Mac", maxAllowableDti: 45 },
	fha: { label: "FHA", maxAllowableDti: 43 },
	usda: { label: "USDA", maxAllowableDti: 41 },
	va: { label: "VA", maxAllowableDti: 41 },
	// Non-QM loans — no regulatory DTI cap; lender sets their own guidelines
	non_qm_bank_statement: { label: "Non QM Bank Statement", maxAllowableDti: null },
	bank_statement: { label: "Bank Statement (Non-QM)", maxAllowableDti: null },
	irs_1099_income: { label: "IRS 1099 Income (Non-QM)", maxAllowableDti: null },
};

interface ProductDtiRow {
	id: string;
	loanTypeLabel: string;
	qualifyingIncome: number;
	maxAllowableDti: number | null;
	backEndDtiPercent: number | null;
	residualIncome: number;
}

interface NormalizedDtiPayload {
	mortgagePayment: number;
	propertyTaxes: number;
	homeownersInsurance: number;
	hoaDues: number;
	creditDebtsTotal: number;
	frontEndLimit: number | null;
	backEndLimit: number | null;
	totalUsableMonthlyIncome: number | null;
	frontEndDti: number | null;
	backEndDti: number | null;
	hasHousingBreakdown: boolean;
	hasDebtBreakdown: boolean;
}

type RecordValue = Record<string, unknown>;

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function toTitleCaseProductId(productId: string): string {
	return productId.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLoanProductMeta(productId: string): { label: string; maxAllowableDti: number | null } {
	const normalized = productId.trim().toLowerCase();
	const configured = LOAN_PRODUCT_CONFIG[normalized];
	if (configured) return configured;

	// Unknown product: apply the QM default only for agency-style IDs,
	// otherwise treat as no cap (Non-QM / custom lender products).
	const isAgency = ["fannie", "freddie", "fha", "usda", "va", "fnma", "fhlmc"].some((kw) =>
		normalized.includes(kw),
	);
	return {
		label: toTitleCaseProductId(productId),
		maxAllowableDti: isAgency ? DEFAULT_MAX_ALLOWABLE_DTI : null,
	};
}

function isRecord(value: unknown): value is RecordValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const cleaned = value.replace(/[$,%\s,]/g, "");
		if (!cleaned) return null;
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function resolveNestedDtiRecord(root: RecordValue | null | undefined): RecordValue | null {
	if (!root) return null;
	const direct = isRecord(root.dti_data) ? root.dti_data : isRecord(root.dti) ? root.dti : null;
	if (direct) return direct;
	const nested = isRecord(root.credit_verification) ? root.credit_verification : null;
	if (!nested) return null;
	return isRecord(nested.dti_data) ? nested.dti_data : isRecord(nested.dti) ? nested.dti : null;
}

function normalizeDtiPayload(root: RecordValue | null | undefined): NormalizedDtiPayload | null {
	const dti = resolveNestedDtiRecord(root);
	if (!dti) return null;

	const mortgagePayment = toNumber(dti.mortgage_payment) ?? 0;
	const propertyTaxes = toNumber(dti.property_taxes) ?? 0;
	const homeownersInsurance = toNumber(dti.homeowners_insurance) ?? 0;
	const hoaDues = toNumber(dti.hoa_dues) ?? 0;
	const creditDebtsTotal =
		toNumber(dti.credit_debts_total) ??
		toNumber(dti.total_credit_debts) ??
		toNumber(dti.total_monthly_debt) ??
		0;
	const frontEndLimit = toNumber(dti.front_end_limit);
	const backEndLimit = toNumber(dti.back_end_limit);
	const totalUsableMonthlyIncome = toNumber(dti.total_usable_monthly_income);
	const frontEndDti = toNumber(dti.front_end_dti);
	const backEndDti = toNumber(dti.back_end_dti);

	return {
		mortgagePayment,
		propertyTaxes,
		homeownersInsurance,
		hoaDues,
		creditDebtsTotal,
		frontEndLimit,
		backEndLimit,
		totalUsableMonthlyIncome,
		frontEndDti,
		backEndDti,
		hasHousingBreakdown: [mortgagePayment, propertyTaxes, homeownersInsurance, hoaDues].some(
			(value) => value > 0,
		),
		hasDebtBreakdown: creditDebtsTotal > 0,
	};
}

function getCreditRoots(
	response:
		| {
				credit_verification: unknown;
				credit_verifications?: Record<string, RecordValue>;
				primary_product_id?: string;
		  }
		| null
		| undefined,
): RecordValue[] {
	if (!response) return [];

	const roots: RecordValue[] = [];

	if (isRecord(response.credit_verification)) {
		roots.push(response.credit_verification);
	}

	if (response.primary_product_id && response.credit_verifications) {
		const primary = response.credit_verifications[response.primary_product_id];
		if (isRecord(primary)) roots.push(primary);
	}

	if (response.credit_verifications) {
		for (const payload of Object.values(response.credit_verifications)) {
			if (isRecord(payload)) roots.push(payload);
		}
	}

	return roots;
}

function getPrimaryDtiPayload(
	response:
		| {
				credit_verification: unknown;
				credit_verifications?: Record<string, RecordValue>;
				primary_product_id?: string;
		  }
		| null
		| undefined,
): NormalizedDtiPayload | null {
	for (const root of getCreditRoots(response)) {
		const payload = normalizeDtiPayload(root);
		if (payload) return payload;
	}
	return null;
}

function getProductDtiPayload(
	response:
		| {
				credit_verification: unknown;
				credit_verifications?: Record<string, RecordValue>;
				primary_product_id?: string;
		  }
		| null
		| undefined,
	productId: string,
): NormalizedDtiPayload | null {
	if (!response?.credit_verifications) {
		return response?.primary_product_id === productId ? getPrimaryDtiPayload(response) : null;
	}

	const productPayload = response.credit_verifications[productId];
	const normalized = normalizeDtiPayload(productPayload);
	if (normalized) return normalized;

	if (response.primary_product_id === productId) {
		return getPrimaryDtiPayload(response);
	}

	return null;
}

function getRealHousingTotal(payload: NormalizedDtiPayload | null, fallbackIncome = 0): number {
	if (!payload) return 0;

	const explicitHousing =
		payload.mortgagePayment + payload.propertyTaxes + payload.homeownersInsurance + payload.hoaDues;
	const usableIncome =
		payload.totalUsableMonthlyIncome ?? (fallbackIncome > 0 ? fallbackIncome : null);
	const derivedHousing =
		usableIncome && payload.frontEndDti != null && payload.frontEndDti > 0
			? payload.frontEndDti * usableIncome
			: 0;

	return Math.max(explicitHousing, derivedHousing);
}

function getRealMonthlyObligations(
	payload: NormalizedDtiPayload | null,
	fallbackIncome = 0,
): number {
	if (!payload) return 0;

	const housingTotal = getRealHousingTotal(payload, fallbackIncome);
	const explicitObligations = housingTotal + payload.creditDebtsTotal;
	const usableIncome =
		payload.totalUsableMonthlyIncome ?? (fallbackIncome > 0 ? fallbackIncome : null);
	const derivedObligations =
		usableIncome && payload.backEndDti != null && payload.backEndDti > 0
			? payload.backEndDti * usableIncome
			: 0;

	return Math.max(explicitObligations, derivedObligations);
}

function hasCreditPayloadData(payload: NormalizedDtiPayload | null): boolean {
	if (!payload) return false;
	return (
		payload.hasHousingBreakdown ||
		payload.hasDebtBreakdown ||
		payload.frontEndDti != null ||
		payload.backEndDti != null ||
		payload.totalUsableMonthlyIncome != null
	);
}

export function RatiosTab({ caseId }: RatiosTabProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: scenariosData, isLoading: scenariosLoading } = useCaseScenarios(caseId);
	const { data: creditResult, isLoading: creditLoading } = useCreditVerification(caseId);
	const { data: incomeResponse, isLoading: incomeLoading } = useIncomeVerification(caseId);
	const [showPullCreditModal, setShowPullCreditModal] = useState(false);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [creditPullWorkflowId, setCreditPullWorkflowId] = useState<string | null>(null);

	// Upload state machine
	const [uploadState, setUploadState] = useState<UploadState>({
		phase: "idle",
		fileNames: [],
	});

	const isExtracting = uploadState.phase === "extracting";
	const hasError = uploadState.phase === "error";
	const { data: creditPullStatus } = useCreditPullStatus(caseId, creditPullWorkflowId, {
		enabled: !!creditPullWorkflowId,
		refetchInterval: creditPullWorkflowId ? 2000 : false,
	});

	// Cancel credit pull workflow
	const handleCancelCreditPull = useCallback(async () => {
		if (!creditPullWorkflowId || !caseId || isCanceling) return;
		setIsCanceling(true);
		try {
			await api.post(`/api/v1/case/${caseId}/credit/pull/${creditPullWorkflowId}/cancel`, {});
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
		} catch (err) {
			console.error("Failed to cancel credit pull:", err);
		} finally {
			setIsCanceling(false);
		}
	}, [creditPullWorkflowId, caseId, isCanceling]);

	// Handle credit pull workflow status transitions.
	useEffect(() => {
		if (!creditPullWorkflowId || !creditPullStatus) return;
		const status = creditPullStatus.status;

		if (status === "completed") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			queryClient.invalidateQueries({ queryKey: caseKeys.creditReportExtraction(caseId) });
			queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
			return;
		}

		if (status === "canceled" || status === "terminated") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			return;
		}

		if (status === "failed" || status.includes("failed") || status.includes("timed_out")) {
			setCreditPullWorkflowId(null);
			setUploadState((prev) => ({
				phase: "error",
				fileNames: prev.fileNames,
				errorMessage: creditPullStatus.error_message || "Credit pull failed. Please try again.",
			}));
		}
	}, [creditPullWorkflowId, creditPullStatus, caseId, queryClient]);

	// Fetch case status for progress info (poll faster when extracting)
	const { data: caseStatus } = useCaseStatus(caseId, {
		refetchInterval: isExtracting ? 2000 : 30000,
	});

	// Check for running add-files workflows
	const { data: workflowStatus } = useWorkflowStatus(caseId, {
		enabled: true,
		refetchInterval: isExtracting ? 2000 : 10000,
	});

	const addFilesWorkflowRunning = useMemo(() => {
		if (!workflowStatus?.workflows) return false;
		return workflowStatus.workflows.some(
			(wf) => wf.workflow_type === "add_files" && wf.status === "running",
		);
	}, [workflowStatus]);

	// Track workflow completion
	const prevAddFilesRunningRef = useRef(false);

	useEffect(() => {
		const wasRunning = prevAddFilesRunningRef.current;
		const isRunning = addFilesWorkflowRunning;
		prevAddFilesRunningRef.current = isRunning;

		// Workflow just completed: extracting → idle, refetch data
		if (wasRunning && !isRunning && uploadState.phase === "extracting") {
			queryClient.invalidateQueries({ queryKey: caseKeys.creditReportExtraction(caseId) });
			queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
			setUploadState({ phase: "idle", fileNames: [] });
		}
	}, [addFilesWorkflowRunning, uploadState.phase, queryClient, caseId]);

	const handleUploadComplete = (fileNames: string[]) => {
		// Transition to extracting phase
		setUploadState({
			phase: "extracting",
			fileNames,
		});
		setShowUploadModal(false);
		// Start polling for updates
		queryClient.invalidateQueries({ queryKey: caseKeys.creditReportExtraction(caseId) });
		queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
	};

	const handleCancelExtraction = async () => {
		if (isCanceling) return;
		setIsCanceling(true);
		try {
			await cancelWorkflows(caseId, ["AUEAddFilesWorkflow"]);
			setUploadState({ phase: "idle", fileNames: [] });
			queryClient.invalidateQueries({ queryKey: caseKeys.status(caseId) });
		} catch (err) {
			console.error("Failed to cancel workflow:", err);
		} finally {
			setIsCanceling(false);
		}
	};

	const primaryDtiPayload = useMemo(() => getPrimaryDtiPayload(creditResult), [creditResult]);
	const defaultHousingTotal = useMemo(
		() => getRealHousingTotal(primaryDtiPayload),
		[primaryDtiPayload],
	);
	const creditMonthlyPayments = primaryDtiPayload?.creditDebtsTotal ?? 0;
	const totalMonthlyObligations = useMemo(
		() => getRealMonthlyObligations(primaryDtiPayload),
		[primaryDtiPayload],
	);
	const productRows = useMemo<ProductDtiRow[]>(() => {
		const verificationByProduct = incomeResponse?.income_verifications ?? {};
		const verificationRows = Object.entries(verificationByProduct)
			.map(([productId, verification]) => {
				const qualifyingIncome = verification?.combined_qualifying ?? 0;
				if (typeof qualifyingIncome !== "number" || !Number.isFinite(qualifyingIncome)) return null;

				const meta = getLoanProductMeta(productId);
				const productDtiPayload =
					getProductDtiPayload(creditResult, productId) ?? primaryDtiPayload;
				const obligations = getRealMonthlyObligations(productDtiPayload, qualifyingIncome);
				const backEndDtiPercent =
					qualifyingIncome > 0 ? (obligations / qualifyingIncome) * 100 : null;
				const payloadLimit = productDtiPayload?.backEndLimit;
				const maxAllowableDti =
					payloadLimit != null && payloadLimit > 0 ? payloadLimit * 100 : meta.maxAllowableDti;

				return {
					id: productId,
					loanTypeLabel: meta.label,
					qualifyingIncome,
					maxAllowableDti,
					backEndDtiPercent,
					residualIncome: qualifyingIncome - obligations,
				};
			})
			.filter((row): row is ProductDtiRow => row !== null);

		if (verificationRows.length > 0) {
			return verificationRows.sort((a, b) => a.loanTypeLabel.localeCompare(b.loanTypeLabel));
		}

		const scenarios = scenariosData?.scenarios ?? [];
		const completedScenarios = scenarios.filter(
			(scenario) =>
				scenario.status === "completed" && typeof scenario.total_monthly_income === "number",
		);

		return completedScenarios.map((scenario) => {
			const qualifyingIncome = scenario.total_monthly_income ?? 0;
			const obligations = getRealMonthlyObligations(primaryDtiPayload, qualifyingIncome);
			const maxAllowableDti =
				primaryDtiPayload?.backEndLimit != null && primaryDtiPayload.backEndLimit > 0
					? primaryDtiPayload.backEndLimit * 100
					: DEFAULT_MAX_ALLOWABLE_DTI;
			const backEndDtiPercent =
				qualifyingIncome > 0 ? (obligations / qualifyingIncome) * 100 : null;

			return {
				id: scenario.scenario_id,
				loanTypeLabel: scenario.name,
				qualifyingIncome,
				maxAllowableDti,
				backEndDtiPercent,
				residualIncome: qualifyingIncome - obligations,
			};
		});
	}, [creditResult, incomeResponse, primaryDtiPayload, scenariosData]);

	const representativeRow = useMemo(() => {
		const rowsWithDti = productRows.filter((row) => row.backEndDtiPercent != null);
		if (rowsWithDti.length > 0) {
			return [...rowsWithDti].sort(
				(a, b) =>
					(a.backEndDtiPercent ?? Number.POSITIVE_INFINITY) -
					(b.backEndDtiPercent ?? Number.POSITIVE_INFINITY),
			)[0];
		}
		return productRows[0] ?? null;
	}, [productRows]);

	const backEndDtiPercent = representativeRow?.backEndDtiPercent ?? 0;
	const residualIncome = representativeRow?.residualIncome ?? -totalMonthlyObligations;
	const frontEndDtiPercent = useMemo(() => {
		if (primaryDtiPayload?.frontEndDti != null) return primaryDtiPayload.frontEndDti * 100;
		const representativeIncome = representativeRow?.qualifyingIncome ?? 0;
		const housingTotal = getRealHousingTotal(primaryDtiPayload, representativeIncome);
		return representativeIncome > 0 ? (housingTotal / representativeIncome) * 100 : 0;
	}, [primaryDtiPayload, representativeRow?.qualifyingIncome]);
	const hasCreditData = hasCreditPayloadData(primaryDtiPayload);
	const hasHousingBreakdown = primaryDtiPayload?.hasHousingBreakdown ?? false;
	const hasDerivedHousing =
		!hasHousingBreakdown &&
		getRealHousingTotal(primaryDtiPayload, representativeRow?.qualifyingIncome ?? 0) > 0;

	// Check if there's a completed scenario with income data
	const hasCompletedScenario = useMemo(() => {
		const scenarios = scenariosData?.scenarios ?? [];
		return scenarios.some(
			(scenario) =>
				scenario.status === "completed" && typeof scenario.total_monthly_income === "number",
		);
	}, [scenariosData]);

	const handleCreditPullSuccess = (workflowId: string) => {
		// Store workflow ID to start polling
		setCreditPullWorkflowId(workflowId);
		// Transition to extracting state to show progress
		setUploadState({
			phase: "extracting",
			fileNames: [`Credit pull workflow: ${workflowId}`],
		});
	};

	if (scenariosLoading || creditLoading || incomeLoading) {
		return (
			<div className="p-6">
				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<div className="animate-pulse space-y-4">
						<div className="h-5 w-40 bg-slate-200 rounded" />
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="h-24 bg-slate-100 rounded" />
							<div className="h-24 bg-slate-100 rounded" />
							<div className="h-24 bg-slate-100 rounded" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!hasCreditData) {
		return (
			<>
				<div className="p-6 space-y-6 overflow-y-auto h-full">
					<div>
						<h1 className="text-2xl font-semibold text-slate-800">DTI & Ratios</h1>
						<p className="text-sm text-slate-500 mt-1">Debt-to-income and qualification ratios.</p>
					</div>

					{/* Extraction Progress View */}
					{isExtracting || hasError ? (
						<InlineWorkflowProgressMulti
							phase={uploadState.phase === "error" ? "error" : "extracting"}
							labels={uploadState.fileNames}
							progressMessage={
								creditPullWorkflowId
									? "Pulling credit report..."
									: caseStatus?.message || "Extracting credit data..."
							}
							progressPercent={caseStatus?.progress?.percent}
							errorMessage={uploadState.errorMessage}
							onCancel={creditPullWorkflowId ? handleCancelCreditPull : handleCancelExtraction}
							isCanceling={isCanceling}
							onRetry={() => {
								setUploadState({ phase: "idle", fileNames: [] });
								setShowPullCreditModal(true);
							}}
						/>
					) : (
						/* Empty State - No Credit Data */
						<div className="bg-white rounded-xl border border-slate-200 h-72 flex items-center justify-center">
							<div className="text-center max-w-sm px-4">
								<div className="w-9 h-9 mx-auto mb-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
									<ShieldCheck className="w-4 h-4 text-slate-500" />
								</div>
								<h2 className="text-sm font-semibold text-slate-700">Credit Data Required</h2>
								<p className="text-xs text-slate-500 mt-2">
									Credit data is required to calculate debt-to-income ratios. Upload a credit report
									or pull credit to enable this section.
								</p>
								<div className="mt-4 flex flex-col items-center gap-3">
									<div className="flex items-center gap-2">
										<button
											onClick={() => setShowUploadModal(true)}
											className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 bg-orange-600 text-white hover:bg-orange-700 transition-colors"
										>
											<Upload className="h-3 w-3" />
											Upload Credit Report
										</button>
										<button
											onClick={() => setShowPullCreditModal(true)}
											className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
										>
											<CreditCard className="h-3 w-3" />
											Pull Credit
										</button>
									</div>
									{!hasCompletedScenario && (
										<button
											onClick={() => navigate(`/case/${caseId}/new-scenario`)}
											className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
										>
											<Plus className="h-3 w-3" />
											Create Scenario
										</button>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
				<PullCreditModal
					caseId={caseId}
					open={showPullCreditModal}
					onClose={() => setShowPullCreditModal(false)}
					onSuccess={handleCreditPullSuccess}
				/>
				<UploadModal
					caseId={caseId}
					isOpen={showUploadModal}
					onClose={() => setShowUploadModal(false)}
					onUploadComplete={handleUploadComplete}
				/>
			</>
		);
	}

	return (
		<div className="p-6 space-y-6 overflow-y-auto h-full">
			<div>
				<h1 className="text-2xl font-semibold text-slate-800">DTI & Ratios</h1>
				<p className="text-sm text-slate-500 mt-1">
					Total monthly obligations: {formatCurrency(totalMonthlyObligations)}/mo
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-white rounded-xl border border-slate-200 p-5">
					<div className="text-xs text-slate-500 uppercase tracking-wide">Back-end DTI</div>
					<div className="mt-2 text-3xl font-bold text-slate-900">
						{formatPercent(backEndDtiPercent)}
					</div>
					<div className="mt-2 text-xs text-slate-500">
						Total Obligations / Qualifying Income (representative loan type)
					</div>
					<div className="mt-1 text-xs text-slate-400">
						Front-end DTI: {formatPercent(frontEndDtiPercent)}
					</div>
				</div>
				<div className="bg-white rounded-xl border border-slate-200 p-5">
					<div className="text-xs text-slate-500 uppercase tracking-wide">Residual Income</div>
					<div className="mt-2 text-3xl font-bold text-slate-900">
						{formatCurrency(residualIncome)}
					</div>
					<div className="mt-2 text-xs text-slate-500">
						/mo after all obligations (representative loan type)
					</div>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
					Total Combined Obligations
				</h2>
				<div className="space-y-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-slate-600">Total Housing (PITIA)</span>
						<span className="font-medium text-slate-900">
							{formatCurrency(defaultHousingTotal)}
						</span>
					</div>
					{hasHousingBreakdown && (
						<>
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-500">Mortgage Payment</span>
								<span className="text-slate-700">
									{formatCurrency(primaryDtiPayload?.mortgagePayment ?? 0)}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-500">Property Taxes</span>
								<span className="text-slate-700">
									{formatCurrency(primaryDtiPayload?.propertyTaxes ?? 0)}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-500">Homeowners Insurance</span>
								<span className="text-slate-700">
									{formatCurrency(primaryDtiPayload?.homeownersInsurance ?? 0)}
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-500">HOA Dues</span>
								<span className="text-slate-700">
									{formatCurrency(primaryDtiPayload?.hoaDues ?? 0)}
								</span>
							</div>
						</>
					)}
					{hasDerivedHousing && (
						<div className="text-xs text-slate-400">
							Housing total is derived from backend front-end DTI because no PITIA breakdown was
							provided.
						</div>
					)}
					<div className="flex items-center justify-between text-sm">
						<span className="text-slate-600">Credit Monthly Debts (total)</span>
						<span className="font-medium text-slate-900">
							{formatCurrency(creditMonthlyPayments)}
						</span>
					</div>
					<div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
						<span className="font-semibold text-slate-700">Total Monthly Obligations</span>
						<span className="font-semibold text-slate-900">
							{formatCurrency(totalMonthlyObligations)}
						</span>
					</div>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
				<div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
					<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
						Back-End DTI by Loan Type
					</h2>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-slate-50">
							<tr className="border-b border-slate-200">
								<th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Loan Type
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Qualifying Income
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Back-End DTI
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Max Allowable
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{productRows.map((row) => {
								const canEvaluate = row.backEndDtiPercent != null;
								const hasMaxDti = row.maxAllowableDti != null;
								const backEndDtiValue = row.backEndDtiPercent ?? 0;
								const isPassing =
									canEvaluate && hasMaxDti && backEndDtiValue <= row.maxAllowableDti!;
								return (
									<tr key={row.id} className="bg-white">
										<td className="px-4 py-3 text-slate-700">{row.loanTypeLabel}</td>
										<td className="px-4 py-3 text-right text-slate-700">
											{formatCurrency(row.qualifyingIncome)}/mo
										</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-800">
											{canEvaluate ? formatPercent(backEndDtiValue) : "—"}
										</td>
										<td className="px-4 py-3 text-right text-slate-600">
											{hasMaxDti ? formatPercent(row.maxAllowableDti!) : "—"}
										</td>
										<td className="px-4 py-3 text-right">
											{!canEvaluate || !hasMaxDti ? (
												<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
													N/A
												</span>
											) : isPassing ? (
												<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
													PASS
												</span>
											) : (
												<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
													FAIL
												</span>
											)}
										</td>
									</tr>
								);
							})}
							{productRows.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-6 text-center text-slate-500">
										No completed scenario or income results available yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="text-xs text-slate-500">
				Ratios use backend DTI payloads from credit verification. Per-product rows reuse the real
				monthly obligations against each product&apos;s qualifying income.
			</div>
		</div>
	);
}
