import type { CaseStatus, FileArtifact } from "../../types";

interface EarlyExtractionViewProps {
	status: CaseStatus;
	files?: FileArtifact[];
	caseId?: string;
	showWorkingIndicator?: boolean;
}

export function EarlyExtractionView({
	status,
	showWorkingIndicator = true,
}: EarlyExtractionViewProps) {
	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-4xl mx-auto">
				{/* Early Stage Header */}
				<div className="flex items-center gap-4 mb-6">
					{showWorkingIndicator ? (
						<div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
							<div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
						</div>
					) : (
						<div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
							<svg
								className="w-6 h-6 text-green-600"
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
					<div>
						<h1 className="text-2xl font-semibold text-slate-800">
							{status.activity ||
								(showWorkingIndicator
									? "Processing documents..."
									: "Document processing has been completed")}
						</h1>
					</div>
				</div>

				{/* Status Message */}
				{status.message && (
					<div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
						<div className="flex items-start gap-3">
							<div className="flex-shrink-0 mt-0.5">
								<svg
									className="w-5 h-5 text-blue-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<div className="flex-1">
								<p className="text-slate-700 mt-1">{status.message}</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
