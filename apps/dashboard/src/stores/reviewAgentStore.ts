/**
 * Zustand store for the AI bank statement review agent.
 *
 * Owns:
 *   - Agent workflow status (idle → analyzing → complete/error)
 *   - Proposed page decisions from the LLM
 *   - User accept/reject toggles per decision
 *
 * Consumed by:
 *   - ExtractionIssuesPanel ("AI Handle Remaining" button state)
 *   - BSReviewAgentModal (decision list + confirm flow)
 *   - CaseDetailSidebar (badge count, if agent is running)
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type ReviewAgentStatus = "idle" | "analyzing" | "complete" | "error";

export interface PageDecision {
	file_id: string;
	page_number: number;
	action: "dismiss" | "re_extract";
	reason: string;
	confidence: number;
	accepted: boolean;
}

export interface ReviewMetadata {
	total_pages: number;
	ok_pages: number;
	problem_pages: number;
	already_dismissed: number;
	analyzed: number;
	skipped_targets: Array<{ file_id: string; page_number: number; status: string; reason: string }>;
}

interface ReviewAgentState {
	status: ReviewAgentStatus;
	workflowId: string | null;
	decisions: PageDecision[];
	summary: string | null;
	metadata: ReviewMetadata | null;
	error: string | null;
	modalOpen: boolean;

	start: (workflowId: string) => void;
	setDecisions: (decisions: PageDecision[]) => void;
	setMetadata: (metadata: ReviewMetadata) => void;
	toggleDecision: (fileId: string, pageNumber: number) => void;
	acceptAll: () => void;
	rejectAll: () => void;
	complete: (summary: string) => void;
	setError: (error: string) => void;
	openModal: () => void;
	closeModal: () => void;
	reset: () => void;
}

export const useReviewAgentStore = create<ReviewAgentState>()(
	subscribeWithSelector((set) => ({
		status: "idle",
		workflowId: null,
		decisions: [],
		summary: null,
		metadata: null,
		error: null,
		modalOpen: false,

		start: (workflowId) =>
			set({
				status: "analyzing",
				workflowId,
				decisions: [],
				summary: null,
				metadata: null,
				error: null,
			}),

		setDecisions: (raw) =>
			set({
				decisions: raw.map((d) => ({ ...d, accepted: true })),
			}),

		setMetadata: (metadata) => set({ metadata }),

		toggleDecision: (fileId, pageNumber) =>
			set((s) => ({
				decisions: s.decisions.map((d) =>
					d.file_id === fileId && d.page_number === pageNumber
						? { ...d, accepted: !d.accepted }
						: d,
				),
			})),

		acceptAll: () =>
			set((s) => ({
				decisions: s.decisions.map((d) => ({ ...d, accepted: true })),
			})),

		rejectAll: () =>
			set((s) => ({
				decisions: s.decisions.map((d) => ({ ...d, accepted: false })),
			})),

		complete: (summary) => set({ status: "complete", summary }),

		setError: (error) => set({ status: "error", error }),

		openModal: () => set({ modalOpen: true }),
		closeModal: () => set({ modalOpen: false }),

		reset: () =>
			set({
				status: "idle",
				workflowId: null,
				decisions: [],
				summary: null,
				metadata: null,
				error: null,
				modalOpen: false,
			}),
	})),
);
