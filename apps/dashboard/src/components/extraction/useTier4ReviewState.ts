/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { CaseStatus, StreamEvent, Tier4Issue, Tier4ReviewState } from "../../types";

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

export function useTier4ReviewState(events: StreamEvent[], status: CaseStatus | null) {
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
						(i: Tier4Issue) => i.severity === "error",
					).length;
					newState.warnings = newState.crossDocumentIssues.filter(
						(i: Tier4Issue) => i.severity === "warning",
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

	// Check multiple completion signals for robustness
	const isComplete =
		reviewState.phase === "complete" ||
		status?.status.code === "completed" ||
		status?.status.intent === "success";
	const hasIssues = reviewState.issuesFound > 0;

	// Determine current phase from both reviewState AND status API
	const statusCode = status?.status?.code;
	const currentPhase =
		reviewState.phase !== "idle" ? reviewState.phase : statusCode === "tier4" ? "rules" : "idle";

	// Phase completion logic - a phase is complete if we're past it
	const phaseOrder = ["idle", "started", "rules", "llm", "parties", "complete"];
	const currentPhaseIndex = phaseOrder.indexOf(currentPhase);
	const isRulesComplete = currentPhaseIndex > phaseOrder.indexOf("rules") || isComplete;
	const isLlmComplete = currentPhaseIndex > phaseOrder.indexOf("llm") || isComplete;
	const isPartiesComplete = currentPhaseIndex >= phaseOrder.indexOf("complete") || isComplete;

	// Check if extraction hasn't started yet
	const hasNotStarted = reviewState.phase === "idle" && statusCode !== "tier4" && !isComplete;

	return {
		reviewState,
		recentMessages,
		isComplete,
		hasIssues,
		currentPhase,
		isRulesComplete,
		isLlmComplete,
		isPartiesComplete,
		hasNotStarted,
	};
}
