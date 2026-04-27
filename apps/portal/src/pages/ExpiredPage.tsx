export function ExpiredPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">Link expired</h2>
					<p className="text-slate-600 mb-6">
						This link has expired or has already been used. Please contact your loan officer for a new link.
					</p>
					<p className="text-xs text-slate-400">Powered by Fenero</p>
				</div>
			</div>
		</div>
	);
}
