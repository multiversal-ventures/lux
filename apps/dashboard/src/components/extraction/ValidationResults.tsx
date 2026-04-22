import type { Tier4Issue, Tier4ReviewState } from "../../types";

interface ValidationResultsProps {
	reviewState: Tier4ReviewState;
	isComplete: boolean;
	hasIssues: boolean;
}

export function ValidationResults({ reviewState, isComplete, hasIssues }: ValidationResultsProps) {
	if (!hasIssues && !isComplete) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
			<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
				Validation Results
			</h2>

			{/* Issue Summary */}
			<div className="flex items-center gap-6 mb-4">
				{reviewState.errors > 0 && (
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-red-500" />
						<span className="text-sm font-medium text-red-700">
							{reviewState.errors} error{reviewState.errors !== 1 ? "s" : ""}
						</span>
					</div>
				)}
				{reviewState.warnings > 0 && (
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-amber-500" />
						<span className="text-sm font-medium text-amber-700">
							{reviewState.warnings} warning{reviewState.warnings !== 1 ? "s" : ""}
						</span>
					</div>
				)}
				{reviewState.issuesFound === 0 && isComplete && (
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-green-500" />
						<span className="text-sm font-medium text-green-700">No issues found</span>
					</div>
				)}
			</div>

			{/* Issue List */}
			{reviewState.crossDocumentIssues.length > 0 && (
				<div className="space-y-3">
					{reviewState.crossDocumentIssues.map((issue, idx) => (
						<IssueCard key={idx} issue={issue} />
					))}
				</div>
			)}
		</div>
	);
}

interface IssueCardProps {
	issue: Tier4Issue;
}

function IssueCard({ issue }: IssueCardProps) {
	const severityStyles = {
		error: "bg-red-50 border-red-200",
		warning: "bg-amber-50 border-amber-200",
		info: "bg-blue-50 border-blue-200",
	};

	const severityTextStyles = {
		error: "text-red-800",
		warning: "text-amber-800",
		info: "text-blue-800",
	};

	const severityIcons = {
		error: (
			<svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
		warning: (
			<svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
		),
		info: (
			<svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
	};

	return (
		<div className={`p-4 rounded-lg border ${severityStyles[issue.severity]}`}>
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 mt-0.5">{severityIcons[issue.severity]}</div>
				<div className="flex-1 min-w-0">
					<p className={`font-medium ${severityTextStyles[issue.severity]}`}>{issue.message}</p>
					{issue.documentsInvolved.length > 0 && (
						<p className="text-sm text-slate-500 mt-1">
							Documents: {issue.documentsInvolved.join(", ")}
						</p>
					)}
					{(issue.expectedValue || issue.actualValue) && (
						<div className="flex gap-4 mt-2 text-sm">
							{issue.expectedValue && (
								<span className="text-slate-500">
									Expected:{" "}
									<span className="font-medium text-slate-700">{issue.expectedValue}</span>
								</span>
							)}
							{issue.actualValue && (
								<span className="text-slate-500">
									Actual: <span className="font-medium text-slate-700">{issue.actualValue}</span>
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
