export function ExpiredPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
					<div className="text-3xl mb-3">&#128274;</div>
					<h2 className="text-xl font-semibold text-slate-900 mb-2">This link is no longer active</h2>
					<p className="text-slate-600 mb-2">
						For your security, portal links expire after 48 hours
						or once they&apos;ve been used.
					</p>
					<p className="text-slate-600 mb-6">
						Reach out to your loan officer and they&apos;ll send you a fresh link.
					</p>
					<p className="text-xs text-slate-400">Powered by Fenero</p>
				</div>
			</div>
		</div>
	);
}
