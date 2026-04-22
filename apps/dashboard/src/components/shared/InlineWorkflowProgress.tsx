import { AlertCircle, FileText, Loader2, RefreshCw, X } from "lucide-react";

type Phase = "extracting" | "error" | "completed";

interface InlineWorkflowProgressProps {
	/** Current phase of the workflow */
	phase: Phase;
	/** Label to show (e.g., file name, workflow description) */
	label: string;
	/** Progress message to display */
	progressMessage?: string;
	/** Progress percent (0-100) */
	progressPercent?: number;
	/** Error message when phase is 'error' */
	errorMessage?: string;
	/** Called when user clicks cancel */
	onCancel?: () => void;
	/** Is cancel operation in progress */
	isCanceling?: boolean;
	/** Called when user clicks retry (only shown in error state) */
	onRetry?: () => void;
}

export function InlineWorkflowProgress({
	phase,
	label,
	progressMessage,
	progressPercent,
	errorMessage,
	onCancel,
	isCanceling = false,
	onRetry,
}: InlineWorkflowProgressProps) {
	// Error state
	if (phase === "error") {
		return (
			<div className="bg-white rounded-xl border border-red-200 p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-4 h-4 text-red-500" />
						<span className="text-sm font-medium text-red-700">Failed</span>
					</div>
					{onRetry && (
						<button
							onClick={onRetry}
							className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
						>
							<RefreshCw className="w-3.5 h-3.5" />
							Try Again
						</button>
					)}
				</div>

				{errorMessage && (
					<div className="rounded-md bg-red-50 border border-red-200 p-3 mb-3">
						<p className="text-xs text-red-700">{errorMessage}</p>
					</div>
				)}

				<div className="space-y-2">
					<div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
						<FileText className="w-5 h-5 text-red-400" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium text-slate-800 truncate">{label}</p>
							<p className="text-[10px] text-red-600">Failed</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Extracting/in-progress state
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Loader2 className="w-4 h-4 animate-spin text-amber-600" />
					<span className="text-sm font-medium text-amber-700">
						{progressMessage || "Processing..."}
					</span>
				</div>
				{onCancel && (
					<button
						onClick={onCancel}
						disabled={isCanceling}
						className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
						title="Cancel"
					>
						<X className="w-3.5 h-3.5" />
						{isCanceling ? "Canceling..." : "Cancel"}
					</button>
				)}
			</div>

			{progressPercent !== undefined && (
				<div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-4">
					<div
						className="h-full bg-amber-500 rounded-full transition-all duration-300"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			)}

			<div className="space-y-2">
				<div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
					<FileText className="w-5 h-5 text-amber-500 animate-pulse" />
					<div className="min-w-0 flex-1">
						<p className="text-xs font-medium text-slate-800 truncate">{label}</p>
						<p className="text-[10px] text-slate-500">Processing...</p>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Multiple file variant - shows multiple file names
 */
interface InlineWorkflowProgressMultiProps extends Omit<InlineWorkflowProgressProps, "label"> {
	/** Multiple labels/file names to show */
	labels: string[];
}

export function InlineWorkflowProgressMulti({
	phase,
	labels,
	progressMessage,
	progressPercent,
	errorMessage,
	onCancel,
	isCanceling = false,
	onRetry,
}: InlineWorkflowProgressMultiProps) {
	// Error state
	if (phase === "error") {
		return (
			<div className="bg-white rounded-xl border border-red-200 p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-4 h-4 text-red-500" />
						<span className="text-sm font-medium text-red-700">Failed</span>
					</div>
					{onRetry && (
						<button
							onClick={onRetry}
							className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
						>
							<RefreshCw className="w-3.5 h-3.5" />
							Try Again
						</button>
					)}
				</div>

				{errorMessage && (
					<div className="rounded-md bg-red-50 border border-red-200 p-3 mb-3">
						<p className="text-xs text-red-700">{errorMessage}</p>
					</div>
				)}

				<div className="space-y-2">
					{labels.map((label, idx) => (
						<div key={idx} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
							<FileText className="w-5 h-5 text-red-400" />
							<div className="min-w-0 flex-1">
								<p className="text-xs font-medium text-slate-800 truncate">{label}</p>
								<p className="text-[10px] text-red-600">Failed</p>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	// Extracting/in-progress state
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Loader2 className="w-4 h-4 animate-spin text-amber-600" />
					<span className="text-sm font-medium text-amber-700">
						{progressMessage || "Processing..."}
					</span>
				</div>
				{onCancel && (
					<button
						onClick={onCancel}
						disabled={isCanceling}
						className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
						title="Cancel"
					>
						<X className="w-3.5 h-3.5" />
						{isCanceling ? "Canceling..." : "Cancel"}
					</button>
				)}
			</div>

			{progressPercent !== undefined && (
				<div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-4">
					<div
						className="h-full bg-amber-500 rounded-full transition-all duration-300"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			)}

			<div className="space-y-2">
				{labels.map((label, idx) => (
					<div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
						<FileText className="w-5 h-5 text-amber-500 animate-pulse" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium text-slate-800 truncate">{label}</p>
							<p className="text-[10px] text-slate-500">Processing...</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
