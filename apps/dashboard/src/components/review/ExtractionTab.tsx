import { DollarSign, FileStack, Landmark, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { isOngoing } from "../../lib/phases";
import type { CaseResult, CaseStatus, StreamEvent } from "../../types";
import { DocumentStatusCard } from "../extraction/DocumentStatusCard";
import { WorkflowsView } from "../sidebar/WorkflowsView";

const PHASE_CONFIG: Record<
	string,
	{ title: string; subtitle: string; icon: typeof Loader2; color: string }
> = {
	income_verification: {
		title: "Calculating Income",
		subtitle: "Income is being calculated from extracted documents.",
		icon: DollarSign,
		color: "text-violet-600",
	},
	unification: {
		title: "Analyzing Bank Statements",
		subtitle: "Bank statements are being analyzed and unified across accounts.",
		icon: Landmark,
		color: "text-blue-600",
	},
};

interface ExtractionTabProps {
	status: CaseStatus | null;
	caseId?: string;
	onRefetch?: () => void;
	result?: CaseResult | null;
	events?: StreamEvent[];
	scenarioAutoCreating?: boolean;
}

export function ExtractionTab({
	status,
	onRefetch,
	result,
	events = [],
	scenarioAutoCreating = false,
}: ExtractionTabProps) {
	const isExtracting = useMemo(() => {
		if (!status) return false;
		const code = status.status?.code;
		return code != null && isOngoing(code);
	}, [status]);

	const statusCode = status?.status?.code ?? "";
	const phaseInfo = PHASE_CONFIG[statusCode];

	const HeaderIcon = scenarioAutoCreating ? FileStack : (phaseInfo?.icon ?? Loader2);

	const headerColor = scenarioAutoCreating
		? "text-amber-600"
		: (phaseInfo?.color ?? "text-amber-600");

	const title = scenarioAutoCreating
		? "Creating Scenario"
		: (phaseInfo?.title ?? "Processing Documents");

	const subtitle = scenarioAutoCreating
		? "Your scenario is being created. You will be redirected shortly."
		: (phaseInfo?.subtitle ??
			"Document extraction is running. Results will be available once complete.");

	const humanMessage = (status as any)?.human_message as string | undefined;

	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-4xl mx-auto space-y-5">
				{/* Header card */}
				<div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
					<div className="flex items-start gap-4">
						<div className={`mt-0.5 p-2 rounded-lg bg-slate-50 ${headerColor}`}>
							<HeaderIcon className="w-5 h-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2.5">
								<h1 className="text-xl font-semibold text-slate-800">{title}</h1>
								{isExtracting && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
							</div>
							<p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
							{humanMessage && (
								<p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
									<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
									{humanMessage}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* Workflow stepper */}
				<WorkflowsView
					currentStatus={status}
					refetch={onRefetch}
					events={events}
					foundDocumentTypes={result?.extractions?.documents?.map((d) => d.document_type) ?? []}
				/>

				{/* Documents found */}
				{(result?.extractions?.documents || isExtracting) && (
					<DocumentStatusCard
						documents={result?.extractions?.documents || []}
						isExtracting={isExtracting}
						events={events}
					/>
				)}
			</div>
		</div>
	);
}
