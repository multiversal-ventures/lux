import { XCircle } from "lucide-react";

interface WarningsProps {
	/** Blocking issues (e.g. missing documents) - shown in rose/red block */
	blockingIssues?: string[];
	/** Non-blocking warnings - shown in amber block */
	warnings?: string[];
}

/**
 * Warnings - Reusable block for Review Required (blocking) and Warnings (amber).
 * Matches PartiesTab styling.
 */
export function Warnings({ blockingIssues = [], warnings = [] }: WarningsProps) {
	return (
		<>
			{blockingIssues.length > 0 && (
				<div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
					<div className="flex items-start gap-3">
						<div className="shrink-0 mt-0.5">
							<XCircle className="w-5 h-5 text-rose-600" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-rose-800">Review Required</h3>
							<p className="text-sm text-rose-700 mt-0.5">
								Income verification is blocked. Upload missing documents to proceed.
							</p>
							<ul className="mt-2 space-y-1">
								{blockingIssues.map((issue, i) => (
									<li key={i} className="flex items-center gap-2 text-sm text-rose-700">
										<span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
										{issue}
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			)}

			{warnings.length > 0 && (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
					<div className="flex items-start gap-3">
						<div className="shrink-0 mt-0.5">
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
							<h3 className="text-sm font-semibold text-amber-800">Warnings</h3>
							<ul className="mt-1 space-y-1">
								{warnings.map((warning, i) => (
									<li key={i} className="flex items-center gap-2 text-sm text-amber-700">
										<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
										{warning}
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
