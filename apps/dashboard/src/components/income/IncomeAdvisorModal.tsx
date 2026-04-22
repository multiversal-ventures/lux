/**
 * Income Advisor Modal - Main container component.
 *
 * Modularized into sub-components in ./advisor/
 *
 * Uses Temporal workflow with Redis status for:
 * - Hydration on page refresh (reconnect to running workflows)
 * - Persistent conversation memory
 * - Interactive Q&A with workflow signals
 */

import { AlertTriangle, Loader2, MessageCircle, Send, Trash2, Wand2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api";

// Sub-components
import {
	AdvisorContextBar,
	AdvisorIdleState,
	AdvisorPendingQuestion,
	AdvisorProposedScenario,
	AdvisorStream,
	type StreamState,
} from "./advisor";

interface IncomeAdvisorModalProps {
	isOpen: boolean;
	onClose: () => void;
	caseId: string;
	scenarioId?: string;
	currentApproach?: string;
	currentIncome?: number;
}

// Extended state to track workflow
interface ExtendedStreamState extends StreamState {
	workflowId?: string;
}

export function IncomeAdvisorModal({
	isOpen,
	onClose,
	caseId,
	scenarioId,
	currentApproach,
	currentIncome,
}: IncomeAdvisorModalProps) {
	const { user } = useAuth();
	const [state, setState] = useState<ExtendedStreamState>({
		status: "idle",
		events: [],
		threadId: caseId, // Thread is keyed by case_id
	});
	const [question, setQuestion] = useState("");
	const eventSourceRef = useRef<EventSource | null>(null);
	const eventsEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const statusCheckedRef = useRef(false);

	// Auto-scroll to bottom of events
	useEffect(() => {
		eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [state.events]);

	// Hydrate from Redis status when modal opens (supports page refresh)
	useEffect(() => {
		const hydrateFromStatus = async () => {
			if (!isOpen || statusCheckedRef.current) return;

			statusCheckedRef.current = true;

			try {
				const token = user ? await user.getIdToken() : "";

				// Check Redis status for running/waiting/complete workflows
				const response = await fetch(resolveApiUrl(`/api/case/${caseId}/income/advisor/status`), {
					headers: { Authorization: `Bearer ${token}` },
				});

				if (response.ok) {
					const status = await response.json();
					console.log("[ADVISOR] Hydrating from status:", status);

					// Map status events to UI events
					const events = (status.events || []).map(
						(e: { type: string; data: Record<string, unknown>; ts: string }) => ({
							type: e.type,
							data: e.data,
							timestamp: new Date(e.ts),
						}),
					);

					if (status.status === "running") {
						// Workflow is running - reconnect to poll stream
						setState((prev) => ({
							...prev,
							status: "running",
							events,
							workflowId: status.workflow_id,
							contextTokens: status.context_tokens || 0,
						}));
						// Reconnect to poll stream
						connectToPollStream(token);
					} else if (status.status === "waiting") {
						// Workflow waiting for user response
						setState((prev) => ({
							...prev,
							status: "waiting",
							events,
							workflowId: status.workflow_id,
							pendingQuestion: status.pending_question
								? {
										question: status.pending_question.question,
										type: status.pending_question.type || "clarification",
										options: status.pending_question.options || [],
									}
								: undefined,
							contextTokens: status.context_tokens || 0,
						}));
					} else if (status.status === "complete" && status.result) {
						// Workflow completed - show result
						setState((prev) => ({
							...prev,
							status: "complete",
							events,
							result: status.result,
							workflowId: status.workflow_id,
							contextTokens: status.context_tokens || 0,
						}));
					} else if (status.status === "error") {
						setState((prev) => ({
							...prev,
							status: "error",
							events,
							error: status.error || "Unknown error",
						}));
					}
					// If status is 'idle', keep default idle state
				}
			} catch (error) {
				console.log("[ADVISOR] Could not hydrate from status:", error);
			}
		};

		hydrateFromStatus();
	}, [isOpen, caseId, user]);

	// Connect to poll-based SSE stream for real-time updates
	const connectToPollStream = useCallback(
		async (token?: string) => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			const authToken = token || (user ? await user.getIdToken() : "");
			const url = `${resolveApiUrl(`/api/case/${caseId}/income/advisor/stream/poll`)}?token=${encodeURIComponent(authToken)}`;

			console.log("[ADVISOR] Connecting to poll stream");
			const eventSource = new EventSource(url);
			eventSourceRef.current = eventSource;

			// Handle events (same as original stream)
			const eventTypes = [
				"start",
				"context",
				"thinking",
				"tool_call",
				"tool_result",
				"complete",
				"error",
				"ask_user",
				"propose_scenario",
			];

			eventTypes.forEach((eventType) => {
				eventSource.addEventListener(eventType, (e: MessageEvent) => {
					let data: Record<string, unknown> = {};
					try {
						if (e.data != null && e.data !== "" && String(e.data).trim() !== "undefined") {
							data = JSON.parse(e.data as string);
						}
					} catch (err) {
						console.warn(`[ADVISOR] Poll event ${eventType} invalid JSON:`, e.data, err);
						return;
					}
					console.log(`[ADVISOR] Poll event: ${eventType}`, data);

					setState((prev) => {
						const newEvent = { type: eventType, data, timestamp: new Date() };

						if (eventType === "ask_user") {
							// Deduplicate: skip if we already have this same question pending
							const lastAskUser = prev.events.filter((e) => e.type === "ask_user").pop();
							if (
								lastAskUser &&
								(lastAskUser.data as Record<string, unknown>)?.question === data.question
							) {
								console.log("[ADVISOR] Skipping duplicate ask_user event");
								return prev;
							}
							return {
								...prev,
								status: "waiting",
								events: [...prev.events, newEvent],
								pendingQuestion: {
									question: data.question as string,
									type: (data.type as string) || "clarification",
									options: (data.options as string[]) || [],
								},
								contextTokens:
									typeof data.context_tokens === "number"
										? data.context_tokens
										: prev.contextTokens,
								workflowId:
									typeof data.workflow_id === "string" ? data.workflow_id : prev.workflowId,
							};
						}

						if (eventType === "complete") {
							eventSource.close();
							return {
								...prev,
								status: "complete",
								events: [...prev.events, newEvent],
								result: (data.result ?? data) as ExtendedStreamState["result"],
								contextTokens:
									typeof data.context_tokens === "number"
										? data.context_tokens
										: prev.contextTokens,
								workflowId:
									typeof data.workflow_id === "string" ? data.workflow_id : prev.workflowId,
							};
						}

						if (eventType === "error") {
							// Ignore empty error events (native EventSource connection close, not server error)
							// Also ignore if we already completed successfully
							if (!data.message || prev.status === "complete") {
								console.log("[ADVISOR] Ignoring empty/post-complete error event");
								return prev;
							}
							eventSource.close();
							return {
								...prev,
								status: "error",
								events: [...prev.events, newEvent],
								error: typeof data.message === "string" ? data.message : String(data.message),
							};
						}

						return {
							...prev,
							events: [...prev.events, newEvent],
						};
					});
				});
			});

			eventSource.onerror = () => {
				if (eventSource.readyState === EventSource.CLOSED) {
					console.log("[ADVISOR] Poll stream closed");
				}
			};
		},
		[caseId, user],
	);

	// Start analysis via Temporal workflow
	const startAnalysis = useCallback(
		async (userQuestion?: string) => {
			console.log("[ADVISOR] Starting workflow, question:", userQuestion);

			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			setState((prev) => ({ ...prev, status: "connecting", events: [] }));

			try {
				const token = user ? await user.getIdToken() : "";

				// If we have a pending question, send response via signal
				if (state.status === "waiting" && state.workflowId && userQuestion) {
					console.log("[ADVISOR] Sending response to workflow:", state.workflowId);
					const respondResponse = await fetch(
						resolveApiUrl(`/api/case/${caseId}/income/advisor/respond`),
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								workflow_id: state.workflowId,
								response: userQuestion,
							}),
						},
					);

					if (respondResponse.ok) {
						setState((prev) => ({
							...prev,
							status: "running",
							pendingQuestion: undefined,
						}));
						// Reconnect to poll stream to get updates
						connectToPollStream(token);
						return;
					}
				}

				// Start new workflow
				// Build question with context if available
				let enrichedQuestion = userQuestion || "";
				if (currentApproach || currentIncome) {
					const context = [];
					if (currentApproach) context.push(`Current approach: ${currentApproach}`);
					if (currentIncome)
						context.push(`Current income: $${currentIncome.toLocaleString()}/month`);
					if (enrichedQuestion) {
						enrichedQuestion = `${context.join(", ")}. ${enrichedQuestion}`;
					}
				}

				const startResponse = await fetch(
					resolveApiUrl(`/api/case/${caseId}/income/advisor/start`),
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							scenario_id: scenarioId,
							question: enrichedQuestion || undefined,
							max_tool_calls: 15,
						}),
					},
				);

				if (!startResponse.ok) {
					const error = await startResponse.json();
					throw new Error(error.detail || "Failed to start workflow");
				}

				const { workflow_id } = await startResponse.json();
				console.log("[ADVISOR] Workflow started:", workflow_id);

				setState((prev) => ({
					...prev,
					status: "running",
					workflowId: workflow_id,
				}));

				// Connect to poll stream for real-time updates
				connectToPollStream(token);
			} catch (error) {
				console.error("[ADVISOR] Failed to start:", error);
				setState((prev) => ({
					...prev,
					status: "error",
					error: error instanceof Error ? error.message : "Failed to start analysis",
				}));
			}
		},
		[caseId, scenarioId, state.status, state.workflowId, connectToPollStream, user],
	);

	// Focus input when modal opens
	useEffect(() => {
		if (isOpen && state.status === "idle") {
			const timer = setTimeout(() => inputRef.current?.focus(), 100);
			return () => clearTimeout(timer);
		}
	}, [isOpen, state.status]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setState((prev) => ({
				status: "idle",
				events: [],
				threadId: prev.threadId,
				contextTokens: prev.contextTokens,
				workflowId: prev.workflowId,
			}));
			setQuestion("");
			statusCheckedRef.current = false;
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		}
	}, [isOpen]);

	// Clear thread/status function
	const clearThread = useCallback(async () => {
		// Always allow clearing - use caseId, not threadId
		try {
			const token = user ? await user.getIdToken() : "";

			// Delete thread (required for clear)
			const deleteRes = await fetch(resolveApiUrl(`/api/case/${caseId}/income/advisor/thread`), {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!deleteRes.ok) {
				const err = await deleteRes.json().catch(() => ({ detail: deleteRes.statusText }));
				throw new Error((err as { detail?: string }).detail || "Failed to clear thread");
			}

			// Cancel workflow only if it might still be running (best-effort; ignore 500 if already completed)
			if (state.workflowId && (state.status === "running" || state.status === "waiting")) {
				try {
					const cancelRes = await fetch(
						resolveApiUrl(
							`/api/case/${caseId}/income/advisor/cancel?workflow_id=${encodeURIComponent(state.workflowId)}`,
						),
						{ method: "POST", headers: { Authorization: `Bearer ${token}` } },
					);
					if (!cancelRes.ok) {
						console.warn(
							"[ADVISOR] Cancel workflow returned",
							cancelRes.status,
							"- workflow may already be finished",
						);
					}
				} catch (cancelErr) {
					console.warn(
						"[ADVISOR] Cancel workflow failed (workflow may already be finished):",
						cancelErr,
					);
				}
			}

			statusCheckedRef.current = false;
			setState((prev) => ({
				...prev,
				status: "idle",
				events: [],
				result: undefined,
				error: undefined,
				pendingQuestion: undefined,
				workflowId: undefined,
			}));
			console.log("[ADVISOR] Thread and workflow cleared");
		} catch (error) {
			console.error("[ADVISOR] Failed to clear thread:", error);
		}
	}, [caseId, state.threadId, state.workflowId, state.status, user]);

	// Handle ask/submit
	const handleAsk = () => {
		if (question.trim() || state.status === "idle" || state.status === "waiting") {
			startAnalysis(question.trim() || undefined);
			setQuestion("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleAsk();
		}
	};

	const handleSelectPrompt = (prompt: string) => {
		setQuestion(prompt);
		startAnalysis(prompt);
	};

	if (!isOpen) return null;

	const isLoading = state.status === "connecting" || state.status === "running";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-purple-100 rounded-lg">
							<Wand2 className="w-5 h-5 text-purple-600" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-slate-800">What if...</h2>
							<p className="text-sm text-slate-400">Explore income scenarios</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{state.threadId && (
							<button
								onClick={clearThread}
								title="Clear conversation"
								className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500"
							>
								<Trash2 className="w-4 h-4" />
							</button>
						)}
						<button
							onClick={onClose}
							className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
						>
							<X className="w-5 h-5 text-slate-500" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{/* Idle State */}
					{state.status === "idle" && <AdvisorIdleState onSelectPrompt={handleSelectPrompt} />}

					{/* Loading State - single stream */}
					{isLoading && (
						<div className="space-y-3">
							{state.proposedScenario && (
								<AdvisorProposedScenario scenario={state.proposedScenario} compact />
							)}
							<AdvisorStream events={state.events} isAnalyzing ref={eventsEndRef} />
						</div>
					)}

					{/* Waiting State - stream then question */}
					{state.status === "waiting" && state.pendingQuestion && (
						<div className="space-y-4">
							<AdvisorStream events={state.events} ref={eventsEndRef} />
							<AdvisorPendingQuestion
								question={state.pendingQuestion}
								onSelectOption={handleSelectPrompt}
							/>
							<p className="text-sm text-slate-500 text-center">
								Type your response below or click an option above
							</p>
						</div>
					)}

					{/* Error State */}
					{state.status === "error" && (
						<div className="bg-red-50 border border-red-200 rounded-lg p-4">
							<div className="flex items-center gap-2 text-red-700">
								<AlertTriangle className="w-5 h-5" />
								<span className="font-medium">Analysis Failed</span>
							</div>
							<p className="mt-2 text-sm text-red-600">{state.error}</p>
							<button
								onClick={() => startAnalysis()}
								className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
							>
								Try Again
							</button>
						</div>
					)}

					{/* Complete State - single stream (events + result as messages) */}
					{state.status === "complete" && (
						<AdvisorStream
							events={state.events}
							result={state.result}
							proposedScenario={state.proposedScenario}
							ref={eventsEndRef}
						/>
					)}
				</div>

				{/* Footer with question input */}
				<div className="px-6 py-4 border-t border-slate-200">
					<div className="flex items-center gap-3">
						<div className="flex-1 relative">
							<MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
							<input
								ref={inputRef}
								type="text"
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder={
									state.status === "idle"
										? "Ask about income optimization..."
										: state.status === "waiting"
											? "Respond to the question above..."
											: "Ask a follow-up question..."
								}
								disabled={isLoading}
								className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
							/>
						</div>
						<button
							onClick={handleAsk}
							disabled={isLoading}
							className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white rounded-lg transition-colors"
						>
							{isLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Send className="w-4 h-4" />
							)}
						</button>
						<button
							onClick={onClose}
							className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
						>
							Close
						</button>
					</div>

					{/* Context usage indicator */}
					{state.threadId && state.contextTokens !== undefined && (
						<div className="mt-2">
							<AdvisorContextBar contextTokens={state.contextTokens} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default IncomeAdvisorModal;
