import type { Tier4ReviewState } from "../../types";

interface ExtractionHeaderProps {
	reviewState: Tier4ReviewState;
	isComplete: boolean;
	hasNotStarted: boolean;
	hasIssues: boolean;
	message: string;
}

export function ExtractionHeader({
	reviewState,
	isComplete,
	hasNotStarted,
	hasIssues,
	message,
}: ExtractionHeaderProps) {
	return (
		<div className="flex items-center gap-4 mb-6">
			{!isComplete && !hasNotStarted ? (
				<div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
					<div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
				</div>
			) : hasIssues ? (
				<div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
					<svg
						className="w-6 h-6 text-amber-600"
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
			) : isComplete ? (
				<div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
					<svg
						className="w-6 h-6 text-green-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
					</svg>
				</div>
			) : (
				<div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
					<svg
						className="w-6 h-6 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
			)}
			<div>
				<h1 className="text-2xl font-semibold text-slate-800">
					{isComplete
						? "Extraction Complete"
						: hasNotStarted
							? "Extraction"
							: "Extraction in Progress"}
				</h1>
				<p className="text-sm text-slate-500">
					{isComplete
						? `Found ${reviewState.issuesFound} item${reviewState.issuesFound !== 1 ? "s" : ""} to verify`
						: hasNotStarted
							? "Upload documents to begin extraction"
							: message}
				</p>
			</div>
			{isComplete && reviewState.durationMs > 0 && (
				<div className="ml-auto px-3 py-1 bg-slate-100 rounded-lg">
					<span className="text-sm text-slate-600">
						Completed in {(reviewState.durationMs / 1000).toFixed(1)}s
					</span>
				</div>
			)}
		</div>
	);
}
