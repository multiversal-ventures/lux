import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import {
	type WorkflowInfo,
	type WorkflowStatusResponse,
	cancelWorkflows,
} from "../../hooks/useApi";
import { caseKeys, useWorkflowStatus } from "../../hooks/useCaseQueries";

// =============================================================================
// WORKFLOW CONTEXT - Shared state for case workflows
// =============================================================================

interface WorkflowContextValue {
	caseId: string | null;
	status: WorkflowStatusResponse | null;
	loading: boolean;
	hasRunning: boolean;
	runningWorkflows: WorkflowInfo[];
	refresh: () => Promise<void>;
	cancelAll: () => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

interface WorkflowProviderProps {
	caseId: string;
	children: ReactNode;
	/** @deprecated - Polling removed, relies on SSE invalidation */
	pollInterval?: number;
}

/**
 * Provider that tracks workflow status for a case.
 * Wrap your case view with this to enable WorkflowAwareButton.
 *
 * No longer polls - uses React Query with SSE invalidation.
 */
export function WorkflowProvider({ caseId, children }: WorkflowProviderProps) {
	const queryClient = useQueryClient();

	// Use React Query hook - shares cache with other components
	const { data: status, isLoading: loading } = useWorkflowStatus(caseId);

	const refresh = useCallback(async () => {
		if (!caseId) return;
		await queryClient.invalidateQueries({ queryKey: caseKeys.workflows(caseId) });
	}, [caseId, queryClient]);

	const cancelAll = useCallback(async () => {
		if (!caseId) return;
		try {
			await cancelWorkflows(caseId);
			await refresh();
		} catch (err) {
			console.error("Failed to cancel workflows:", err);
		}
	}, [caseId, refresh]);

	const runningWorkflows = useMemo(
		() => status?.workflows.filter((w) => w.status === "running") ?? [],
		[status],
	);

	return (
		<WorkflowContext.Provider
			value={{
				caseId,
				status: status ?? null,
				loading,
				hasRunning: status?.has_running ?? false,
				runningWorkflows,
				refresh,
				cancelAll,
			}}
		>
			{children}
		</WorkflowContext.Provider>
	);
}

export function useWorkflowContext(): WorkflowContextValue {
	const context = useContext(WorkflowContext);
	if (context === null) {
		throw new Error("useWorkflowContext must be used within a WorkflowProvider");
	}
	return context;
}
// WORKFLOW CONFLICT DIALOG
// =============================================================================

interface WorkflowConflictDialogProps {
	open: boolean;
	runningWorkflows: WorkflowInfo[];
	onCancel: () => void;
	onWait: () => void;
	onCancelAndRun: () => void;
	cancelling: boolean;
}

function WorkflowConflictDialog({
	open,
	runningWorkflows,
	onCancel,
	onWait,
	onCancelAndRun,
	cancelling,
}: WorkflowConflictDialogProps) {
	if (!open) return null;

	const workflowNames = runningWorkflows.map((w) => {
		const names: Record<string, string> = {
			extraction: "Document Extraction",
			income: "Income Verification",
			credit: "Credit Verification",
		};
		return names[w.workflow_type] || w.workflow_type;
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

			{/* Dialog */}
			<div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in">
				{/* Header */}
				<div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
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
						<div>
							<h3 className="text-lg font-semibold text-slate-800">Process Running</h3>
							<p className="text-sm text-slate-600">Another workflow is in progress</p>
						</div>
					</div>
				</div>

				{/* Content */}
				<div className="px-6 py-4">
					<p className="text-sm text-slate-600 mb-4">
						The following {runningWorkflows.length === 1 ? "process is" : "processes are"} currently
						running:
					</p>

					<div className="space-y-2 mb-4">
						{runningWorkflows.map((w) => (
							<div
								key={w.workflow_id}
								className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
							>
								<div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
								<span className="text-sm font-medium text-blue-800">
									{workflowNames[runningWorkflows.indexOf(w)]}
								</span>
								{w.started_at && (
									<span className="text-xs text-blue-600 ml-auto">
										{formatTimeAgo(w.started_at)}
									</span>
								)}
							</div>
						))}
					</div>

					<p className="text-sm text-slate-500">
						Starting a new process may affect results. What would you like to do?
					</p>
				</div>

				{/* Actions */}
				<div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
					<button
						onClick={onWait}
						className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
					>
						Wait for completion
					</button>
					<button
						onClick={onCancelAndRun}
						disabled={cancelling}
						className="flex-1 px-4 py-2.5 bg-amber-500 rounded-lg text-sm font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{cancelling ? (
							<>
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								Cancelling...
							</>
						) : (
							"Cancel & Run New"
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// WORKFLOW AWARE BUTTON
// =============================================================================

interface WorkflowAwareButtonProps {
	/** Button content */
	children: ReactNode;
	/** Called when safe to proceed (no conflicts or user chose to proceed) */
	onClick: () => void | Promise<void>;
	/** Additional class names */
	className?: string;
	/** Disable the button */
	disabled?: boolean;
	/** Workflow types to check for conflicts (default: all) */
	conflictsWith?: ("extraction" | "income" | "credit")[];
	/** Show running indicator on button */
	showRunningIndicator?: boolean;
}

/**
 * A button that checks for running workflows before executing.
 * Shows a dialog if workflows are running, giving user options to wait or cancel.
 */
export function WorkflowAwareButton({
	children,
	onClick,
	className = "",
	disabled = false,
	conflictsWith,
	showRunningIndicator = true,
}: WorkflowAwareButtonProps) {
	const { hasRunning, runningWorkflows, cancelAll, refresh } = useWorkflowContext();
	const [showDialog, setShowDialog] = useState(false);
	const [cancelling, setCancelling] = useState(false);

	// Filter to only conflicting workflow types
	const conflictingWorkflows = conflictsWith
		? runningWorkflows.filter((w) =>
				conflictsWith.includes(w.workflow_type as "extraction" | "income" | "credit"),
			)
		: runningWorkflows;

	const hasConflict = conflictingWorkflows.length > 0;

	const handleClick = async () => {
		if (hasConflict) {
			setShowDialog(true);
		} else {
			await onClick();
		}
	};

	const handleWait = () => {
		setShowDialog(false);
		// User chose to wait - just close dialog
	};

	const handleCancelAndRun = async () => {
		setCancelling(true);
		try {
			await cancelAll();
			await refresh();
			setShowDialog(false);
			// Give a moment for cancellation to propagate
			setTimeout(() => {
				onClick();
			}, 500);
		} finally {
			setCancelling(false);
		}
	};

	return (
		<>
			<button onClick={handleClick} disabled={disabled} className={`relative ${className}`}>
				{children}
				{/* Running indicator */}
				{showRunningIndicator && hasRunning && (
					<span className="absolute -top-1 -right-1 flex h-3 w-3">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
					</span>
				)}
			</button>

			<WorkflowConflictDialog
				open={showDialog}
				runningWorkflows={conflictingWorkflows}
				onCancel={() => setShowDialog(false)}
				onWait={handleWait}
				onCancelAndRun={handleCancelAndRun}
				cancelling={cancelling}
			/>
		</>
	);
}

// =============================================================================
// WORKFLOW STATUS BADGE
// =============================================================================

/**
 * Small badge showing running workflow count.
 */
export function WorkflowStatusBadge() {
	const { hasRunning, runningWorkflows } = useWorkflowContext();

	if (!hasRunning) return null;

	return (
		<div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full">
			<div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
			<span className="text-xs font-medium text-blue-700">{runningWorkflows.length} running</span>
		</div>
	);
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);

	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	return `${Math.floor(diffMin / 60)}h ago`;
}
