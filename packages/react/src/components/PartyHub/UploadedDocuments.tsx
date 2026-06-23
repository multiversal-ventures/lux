/** Shared case documents the borrower(s) have uploaded. */
export function UploadedDocuments({ files }: { files: string[] }) {
	if (files.length === 0) {
		return <p className="text-sm text-slate-400">No documents uploaded yet.</p>;
	}
	return (
		<ul className="space-y-1">
			{files.map((f, i) => (
				<li key={i} className="flex items-center gap-2 text-sm text-slate-700">
					<span className="text-green-600" aria-hidden>✓</span>
					{f}
				</li>
			))}
		</ul>
	);
}
