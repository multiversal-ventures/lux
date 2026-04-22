/**
 * Shared types for Income Advisor components.
 */

import type { IncomeStrategy } from "../../../hooks/useApi";

export interface SourceReference {
	type: "spec" | "document" | "fact";
	name: string;
	detail: string;
}

export interface PendingQuestion {
	question: string;
	type: string;
	options: string[];
}

export interface ProposedScenario {
	name: string;
	approach: string;
	document_types: string[];
	borrower_names: string[];
	year_selection: string;
	estimated_monthly_income?: number;
	explanation: string;
	action_url: string;
}

export interface AdvisorEvent {
	type: string;
	data: Record<string, unknown>;
	timestamp: Date;
}

export interface AdvisorResult {
	case_summary: string;
	primary_strategy?: IncomeStrategy & { sources?: SourceReference[] };
	alternative_strategies: IncomeStrategy[];
	data_gaps: string[];
	observations: string[];
	tools_used: string[];
	tools_called: number;
}

export interface StreamState {
	status: "idle" | "connecting" | "running" | "complete" | "error" | "waiting";
	events: AdvisorEvent[];
	result?: AdvisorResult;
	error?: string;
	threadId?: string;
	contextTokens?: number;
	pendingQuestion?: PendingQuestion;
	proposedScenario?: ProposedScenario;
}

export type StreamStatus = StreamState["status"];
