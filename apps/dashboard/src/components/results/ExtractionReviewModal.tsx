import { useEffect, useState } from "react";
import logoOrange from "../../assets/logo-orange.svg";
import type { CaseStatus, StreamEvent, Tier4Issue, Tier4ReviewState } from "../../types";

interface ExtractionReviewModalProps {
	isOpen: boolean;
	status: CaseStatus | null;
	events: StreamEvent[];
	onClose: () => void;
}

const initialReviewState: Tier4ReviewState = {
	phase: "idle",
	totalPages: 0,
	totalFacts: 0,
	documentTypes: [],
	rulesChecked: 0,
	issuesFound: 0,
	errors: 0,
	warnings: 0,
	llmReviewPerformed: false,
	partiesFound: 0,
	durationMs: 0,
	crossDocumentIssues: [],
	reExtractionRecommendations: [],
};

/**
 * ExtractionReviewModal - Shows tier 4 validation progress in real-time.
 *
 * Displays when the extraction workflow enters the 'tier4' phase and shows:
 * - Rule-based validation progress
 * - Cross-document consistency checks
 * - Issues found (errors/warnings)
 * - Fenero Agent holistic review status
 * - Party extraction progress
 */
export function ExtractionReviewModal({
	isOpen,
	status,
	events,
	onClose,
}: ExtractionReviewModalProps) {
	const [reviewState, setReviewState] = useState<Tier4ReviewState>(initialReviewState);
	const [recentMessages, setRecentMessages] = useState<string[]>([]);

	// Process SSE events to update review state
	useEffect(() => {
		// Filter for tier4-related events
		const tier4Events = events.filter(
			(e) => e.phase === "tier4" || e.data?.event_type?.toString().includes("summary_review"),
		);

		if (tier4Events.length === 0) return;

		// Process each event to build state
		const newState = { ...initialReviewState };
		const messages: string[] = [];

		for (const event of tier4Events) {
			const eventType = event.data?.event_type?.toString() || event.type;
			const data = event.data || {};

			// Track recent messages for activity display
			if (event.message && !messages.includes(event.message)) {
				messages.push(event.message);
			}

			switch (eventType) {
				case "summary_review_started":
					newState.phase = "started";
					newState.totalPages = (data.total_pages as number) || 0;
					newState.totalFacts = (data.total_facts as number) || 0;
					newState.documentTypes = (data.document_types_found as string[]) || [];
					break;

				case "summary_review": {
					newState.phase = "llm";
					// Parse cross-document issues
					const issues = (data.cross_document_issues as Array<Record<string, unknown>>) || [];
					newState.crossDocumentIssues = issues.map((issue) => ({
						ruleName: (issue.rule_name as string) || "",
						severity: (issue.severity as "error" | "warning" | "info") || "warning",
						message: (issue.message as string) || "",
						documentsInvolved: (issue.documents_involved as string[]) || [],
						pagesInvolved: (issue.pages_involved as string[]) || [],
						expectedValue: issue.expected_value as string | undefined,
						actualValue: issue.actual_value as string | undefined,
					}));
					newState.issuesFound = newState.crossDocumentIssues.length;
					newState.errors = newState.crossDocumentIssues.filter(
						(i) => i.severity === "error",
					).length;
					newState.warnings = newState.crossDocumentIssues.filter(
						(i) => i.severity === "warning",
					).length;
					break;
				}

				case "summary_review_complete":
					newState.phase = "complete";
					newState.durationMs = (data.duration_ms as number) || 0;
					newState.rulesChecked = (data.rules_checked as number) || 0;
					newState.issuesFound = (data.issues_found as number) || newState.issuesFound;
					newState.llmReviewPerformed = (data.llm_review_performed as boolean) || false;
					break;

				default:
					// Handle observation events during tier4 phase
					if (event.phase === "tier4" && event.type === "observation") {
						if (event.message.toLowerCase().includes("rule")) {
							newState.phase = "rules";
						} else if (
							event.message.toLowerCase().includes("llm") ||
							event.message.toLowerCase().includes("holistic")
						) {
							newState.phase = "llm";
						} else if (event.message.toLowerCase().includes("part")) {
							newState.phase = "parties";
						}
					}
					break;
			}
		}

		setReviewState(newState);
		setRecentMessages(messages.slice(-5)); // Keep last 5 messages
	}, [events]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setReviewState(initialReviewState);
			setRecentMessages([]);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	// Check multiple completion signals for robustness
	const isComplete =
		reviewState.phase === "complete" ||
		status?.status.code === "completed" ||
		status?.status.intent === "success";
	const hasIssues = reviewState.issuesFound > 0;

	// Determine current phase from both reviewState AND status API
	// This ensures we show progress even if SSE events haven't arrived yet
	const statusCode = status?.status?.code;
	const currentPhase =
		reviewState.phase !== "idle" ? reviewState.phase : statusCode === "tier4" ? "rules" : "idle";

	// Phase completion logic - a phase is complete if we're past it
	const phaseOrder = ["idle", "started", "rules", "llm", "parties", "complete"];
	const currentPhaseIndex = phaseOrder.indexOf(currentPhase);
	const isRulesComplete = currentPhaseIndex > phaseOrder.indexOf("rules") || isComplete;
	const isLlmComplete = currentPhaseIndex > phaseOrder.indexOf("llm") || isComplete;
	const isPartiesComplete = currentPhaseIndex >= phaseOrder.indexOf("complete") || isComplete;

	// DEBUG: Log what we're seeing
	console.log("[ExtractionReviewModal] Debug:", {
		isComplete,
		reviewStatePhase: reviewState.phase,
		currentPhase,
		statusCode: status?.status?.code,
		statusIntent: status?.status?.intent,
		statusObject: status,
		eventsCount: events.length,
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={isComplete ? onClose : undefined}
			/>

			{/* Modal */}
			<div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
				{/* Header */}
				<div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-orange-50 to-amber-50">
					<div className="flex items-center gap-3">
						{!isComplete ? (
							<div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
								<div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
							</div>
						) : hasIssues ? (
							<div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
								<svg
									className="w-5 h-5 text-amber-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
						) : (
							<div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
								<svg
									className="w-5 h-5 text-green-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
						)}
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-slate-800">
								{isComplete ? "Quick Check Complete" : "Fenero Quick Check"}
							</h3>
							<p className="text-sm text-slate-500">
								{isComplete
									? `Found ${reviewState.issuesFound} item${reviewState.issuesFound !== 1 ? "s" : ""} to verify`
									: "Cross-document validation in progress..."}
							</p>
						</div>
						{/* Close button */}
						<button
							onClick={onClose}
							className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
							aria-label="Close"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>

				{/* Progress Steps */}
				<div className="px-6 py-5 border-b border-slate-100">
					<div className="flex items-center justify-between">
						<ProgressStep
							label="Rules"
							isActive={currentPhase === "rules" || currentPhase === "started"}
							isComplete={isRulesComplete}
							count={reviewState.rulesChecked > 0 ? reviewState.rulesChecked : undefined}
						/>
						<ProgressConnector isActive={isRulesComplete} />
						<ProgressStep
							label="Fenero Agent"
							isActive={currentPhase === "llm"}
							isComplete={isLlmComplete}
							isSkipped={isComplete && !reviewState.llmReviewPerformed}
							icon={<img src={logoOrange} alt="Fenero" className="w-4 h-4" />}
						/>
						<ProgressConnector isActive={isLlmComplete} />
						<ProgressStep
							label="Parties"
							isActive={currentPhase === "parties" && !isComplete}
							isComplete={isPartiesComplete}
							count={reviewState.partiesFound > 0 ? reviewState.partiesFound : undefined}
						/>
					</div>
				</div>

				{/* Stats */}
				<div className="px-6 py-4 grid grid-cols-3 gap-4 bg-slate-50">
					<StatCard
						label="Documents"
						value={status?.progress?.documents_found ?? reviewState.documentTypes.length}
						subtitle={
							reviewState.documentTypes.length > 0
								? reviewState.documentTypes.slice(0, 2).join(", ") +
									(reviewState.documentTypes.length > 2 ? "..." : "")
								: undefined
						}
					/>
					<StatCard label="Pages" value={status?.progress?.pages_total ?? reviewState.totalPages} />
					<StatCard
						label="Facts"
						value={status?.progress?.facts_extracted ?? reviewState.totalFacts}
					/>
				</div>

				{/* Issues Found */}
				{(hasIssues || isComplete) && (
					<div className="px-6 py-4 border-t border-slate-100">
						<div className="flex items-center gap-4 mb-3">
							{reviewState.errors > 0 && (
								<div className="flex items-center gap-1.5">
									<div className="w-2 h-2 rounded-full bg-red-500" />
									<span className="text-sm font-medium text-red-700">
										{reviewState.errors} error{reviewState.errors !== 1 ? "s" : ""}
									</span>
								</div>
							)}
							{reviewState.warnings > 0 && (
								<div className="flex items-center gap-1.5">
									<div className="w-2 h-2 rounded-full bg-amber-500" />
									<span className="text-sm font-medium text-amber-700">
										{reviewState.warnings} warning{reviewState.warnings !== 1 ? "s" : ""}
									</span>
								</div>
							)}
							{reviewState.issuesFound === 0 && isComplete && (
								<div className="flex items-center gap-1.5">
									<div className="w-2 h-2 rounded-full bg-green-500" />
									<span className="text-sm font-medium text-green-700">No issues found</span>
								</div>
							)}
						</div>

						{/* Issue List */}
						{reviewState.crossDocumentIssues.length > 0 && (
							<div className="space-y-2 max-h-48 overflow-y-auto">
								{reviewState.crossDocumentIssues.slice(0, 5).map((issue, idx) => (
									<IssueCard key={idx} issue={issue} />
								))}
								{reviewState.crossDocumentIssues.length > 5 && (
									<p className="text-xs text-slate-500 text-center py-1">
										+{reviewState.crossDocumentIssues.length - 5} more issues
									</p>
								)}
							</div>
						)}
					</div>
				)}

				{/* Activity Feed */}
				{!isComplete && recentMessages.length > 0 && (
					<div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
						<div className="text-xs text-slate-500 space-y-1">
							{recentMessages.slice(-3).map((msg, idx) => (
								<div key={idx} className="flex items-center gap-2">
									<div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
									<span className="truncate">{msg}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="px-6 py-4 border-t border-slate-200 bg-white">
					{isComplete ? (
						<div className="flex items-center justify-between">
							<span className="text-sm text-slate-500">
								Completed in {(reviewState.durationMs / 1000).toFixed(1)}s
							</span>
							<button
								onClick={onClose}
								className="px-4 py-2 text-sm font-medium text-white bg-cta hover:bg-cta-hover rounded-lg transition-colors"
							>
								Continue to Results
							</button>
						</div>
					) : (
						<div className="flex flex-col items-center gap-2">
							<div className="flex items-center justify-center gap-2 text-sm text-slate-500">
								<div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
								Processing...
							</div>
							{/* DEBUG: Show status info */}
							<div className="text-[10px] text-slate-400 font-mono">
								status:{" "}
								{status ? `code=${status.status?.code}, intent=${status.status?.intent}` : "null"}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ProgressStepProps {
	label: string;
	isActive: boolean;
	isComplete: boolean;
	isSkipped?: boolean;
	count?: number;
	icon?: React.ReactNode;
}

function ProgressStep({ label, isActive, isComplete, isSkipped, count, icon }: ProgressStepProps) {
	return (
		<div className="flex flex-col items-center min-w-[80px]">
			<div
				className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all shadow-sm ${
					isComplete
						? "bg-green-500 text-white ring-2 ring-green-200"
						: isActive
							? "bg-orange-500 text-white ring-2 ring-orange-200"
							: isSkipped
								? "bg-slate-200 text-slate-400"
								: "bg-slate-100 text-slate-400 border border-slate-200"
				}`}
			>
				{isComplete ? (
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2.5}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : isActive ? (
					<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
				) : isSkipped ? (
					<span className="text-xs">—</span>
				) : icon ? (
					icon
				) : (
					<span className="text-xs">{count ?? "•"}</span>
				)}
			</div>
			<span
				className={`mt-2 text-xs font-medium ${
					isComplete
						? "text-green-700"
						: isActive
							? "text-orange-700"
							: isSkipped
								? "text-slate-400"
								: "text-slate-500"
				}`}
			>
				{label}
			</span>
		</div>
	);
}

function ProgressConnector({ isActive }: { isActive: boolean }) {
	return (
		<div className="flex-1 flex items-center px-2">
			<div
				className={`w-full h-1 rounded-full transition-colors ${isActive ? "bg-green-300" : "bg-slate-200"}`}
			/>
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: number;
	subtitle?: string;
}

function StatCard({ label, value, subtitle }: StatCardProps) {
	return (
		<div className="text-center">
			<div className="text-2xl font-semibold text-slate-800">{value}</div>
			<div className="text-xs text-slate-500">{label}</div>
			{subtitle && <div className="text-[10px] text-slate-400 truncate mt-0.5">{subtitle}</div>}
		</div>
	);
}

interface IssueCardProps {
	issue: Tier4Issue;
}

function IssueCard({ issue }: IssueCardProps) {
	const severityStyles = {
		error: "bg-red-50 border-red-200 text-red-800",
		warning: "bg-amber-50 border-amber-200 text-amber-800",
		info: "bg-blue-50 border-blue-200 text-blue-800",
	};

	const severityIcons = {
		error: "!",
		warning: "⚠",
		info: "i",
	};

	return (
		<div className={`p-2 rounded-lg border text-sm ${severityStyles[issue.severity]}`}>
			<div className="flex items-start gap-2">
				<span className="text-xs font-bold">{severityIcons[issue.severity]}</span>
				<div className="flex-1 min-w-0">
					<p className="font-medium truncate">{issue.message}</p>
					{issue.documentsInvolved.length > 0 && (
						<p className="text-xs opacity-75 mt-0.5">{issue.documentsInvolved.join(", ")}</p>
					)}
				</div>
			</div>
		</div>
	);
}
