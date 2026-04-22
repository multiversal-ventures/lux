interface EmptyStateProps {
	hasNotStarted: boolean;
}

export function EmptyState({ hasNotStarted }: EmptyStateProps) {
	if (!hasNotStarted) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
			<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
				<svg
					className="w-8 h-8 text-slate-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
					/>
				</svg>
			</div>
			<h3 className="text-lg font-medium text-slate-700 mb-2">No Extraction Data</h3>
			<p className="text-sm text-slate-500 max-w-sm mx-auto">
				Upload documents to this case to begin the extraction process. The validation progress will
				appear here.
			</p>
		</div>
	);
}
