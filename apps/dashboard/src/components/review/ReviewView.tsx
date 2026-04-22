import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	useCaseStatus,
	useWorkflowStatus,
	useCaseResult,
	useCaseQueryInvalidation,
} from "../../hooks/useCaseQueries";
import { checkIncomeReadiness } from "../../hooks/useApi";
import type { IncomeReadinessResponse } from "../../hooks/useApi";
import type { CaseResult, StreamEvent, Party } from "../../types";
import { ExtractionTab } from "./ExtractionTab";
import { extractStringValue } from "./PartiesView/partiesViewUtils";
import { PartiesSummary } from "./PartiesSummary";
import { Warnings } from "./Warnings";
import { LoanProductSelector } from "../shared/LoanProductSelector";
import { StartIncomeVerification } from "../shared/StartIncomeVerification";

import { isOngoing } from "../../lib/phases";

function normalizeParties(result: CaseResult | null | undefined): (Party & { _id: string })[] {
	if (!result) return [];
	const extractionsParties = result.extractions?.parties;
	const rawParties = Array.isArray(extractionsParties)
		? extractionsParties
		: ((extractionsParties as { parties?: unknown[] } | undefined)?.parties ??
			(result as { parties?: unknown[] }).parties ??
			[]);
	const arr = Array.isArray(rawParties) ? rawParties : [];
	return arr.map((p, i) => {
		if (typeof p === "string") {
			return { name: p, role: "unknown", _id: `party-${i}` } as Party & { _id: string };
		}
		const obj = p as {
			id?: string;
			_id?: string;
			name?: unknown;
			role?: string;
			party_type?: string;
			identifiers?: Record<string, string>;
			name_aliases?: string[];
		};
		const existingId = obj.id ?? obj._id;
		const name = extractStringValue(obj.name);
		return { ...obj, name, _id: existingId ?? `party-${i}` } as Party & { _id: string };
	});
}

interface ReviewViewProps {
	caseId: string;
	/** SSE events for ExtractionTab (e.g. from useGunnrCase when rendered under CasePage) */
	events?: StreamEvent[];
	/** Optional refetch callback (e.g. from useGunnrCase) to trigger after extraction/parties updates */
	onRefetch?: () => void;
}

/**
 * ReviewView - Case index view. Fetches workflows, result, income, credit via React Query.
 * Shows loader until all are fetched, then:
 * - Extraction ongoing → ExtractionTab
 * - Else → LoanProductSelector, StartIncomeVerification, Warnings, PartiesSummary
 *
 * Party management is handled via /new-scenario route (CreateScenarioPage).
 */
export function ReviewView({ caseId, events = [], onRefetch }: ReviewViewProps) {
	const navigate = useNavigate();
	const [readiness, setReadiness] = useState<IncomeReadinessResponse | null>(null);
	const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
	const [blinkTrigger, setBlinkTrigger] = useState(0);

	const statusQuery = useCaseStatus(caseId);
	const workflowsQuery = useWorkflowStatus(caseId);
	const resultQuery = useCaseResult(caseId);

	const status = statusQuery.data ?? null;
	const extractionOngoing = useMemo(() => {
		const code = status?.status?.code;
		return code != null && isOngoing(code);
	}, [status]);

	const { invalidateResult, invalidateStatus } = useCaseQueryInvalidation();

	const result = resultQuery.data ?? null;
	const workflowStatus = workflowsQuery.data;
	const incomeWorkflow = workflowStatus?.workflows?.find((w) => w.workflow_type === "income");
	const creditWorkflow = workflowStatus?.workflows?.find((w) => w.workflow_type === "credit");
	const isIncomeRunning = incomeWorkflow?.status === "running";
	const isCreditRunning = creditWorkflow?.status === "running";

	const isLoading =
		statusQuery.isLoading ||
		statusQuery.isPending ||
		workflowsQuery.isLoading ||
		workflowsQuery.isPending ||
		resultQuery.isLoading ||
		resultQuery.isPending;

	const parties = useMemo(() => normalizeParties(result), [result]);

	useEffect(() => {
		let cancelled = false;
		const loanProduct = selectedProductIds.length > 0 ? selectedProductIds[0] : "fannie_mae";
		checkIncomeReadiness(caseId, loanProduct)
			.then((res) => {
				if (!cancelled) setReadiness(res);
			})
			.catch(() => {
				if (!cancelled) setReadiness(null);
			});
		return () => {
			cancelled = true;
		};
	}, [caseId, selectedProductIds]);

	const handleRefetch = () => {
		invalidateResult(caseId);
		invalidateStatus(caseId);
		onRefetch?.();
	};

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center bg-slate-100">
				<div className="flex flex-col items-center gap-4">
					<div className="w-10 h-10 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
					<p className="text-sm text-slate-600">Loading case...</p>
				</div>
			</div>
		);
	}

	if (extractionOngoing) {
		return (
			<ExtractionTab
				status={status}
				caseId={caseId}
				onRefetch={handleRefetch}
				result={result}
				events={events}
			/>
		);
	}

	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
					<div className="flex items-center justify-between">
						<h1 className="text-xl font-semibold text-slate-800">Review</h1>
						<StartIncomeVerification
							caseId={caseId}
							buttonText="Start"
							runAllProducts={false}
							selectedProductIds={selectedProductIds}
							navigateAfterStart={false}
							workflowRunning={isIncomeRunning || isCreditRunning}
							onNoProductSelected={() => setBlinkTrigger((prev) => prev + 1)}
							onStartVerification={onRefetch}
						/>
					</div>

					<LoanProductSelector
						isMultiSelection
						value={selectedProductIds}
						onChange={setSelectedProductIds}
						caseId={caseId}
						label=""
						blinkTrigger={blinkTrigger}
					/>

					<Warnings blockingIssues={readiness?.blocking_issues} warnings={readiness?.warnings} />

					<PartiesSummary
						parties={parties}
						caseId={caseId}
						financialEntities={result?.extractions?.financial_entities}
						onOpenParties={() => navigate(`/case/${caseId}/new-scenario`)}
					/>
				</div>
			</div>
		</div>
	);
}
