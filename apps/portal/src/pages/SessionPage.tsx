import { Navigate } from "react-router-dom";
import { usePortalSession } from "../hooks/usePortalSession";

export function SessionPage() {
	const { session, loading, error, submitIntent } = usePortalSession();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="spinner mx-auto mb-4" />
					<p className="text-slate-600">Loading your loan application...</p>
				</div>
			</div>
		);
	}

	if (error?.code === "expired" || error?.code === "no_token") {
		return <Navigate to="/expired" replace />;
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md text-center">
					<h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
					<p className="text-slate-600">{error.message}</p>
				</div>
			</div>
		);
	}

	if (!session) return null;

	const incompleteItems = session.checklist.filter((i) => i.status !== "verified");
	const verifiedItems = session.checklist.filter((i) => i.status === "verified");

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 px-6 py-4">
				<div className="max-w-2xl mx-auto flex items-center justify-between">
					<h1 className="text-lg font-bold text-slate-900">Loan Application</h1>
					<span className="text-sm text-slate-500">
						{session.entity.name || session.entity.role}
					</span>
				</div>
			</header>

			<main className="max-w-2xl mx-auto p-6 space-y-6">
				{/* Consent section */}
				{!session.consent.doc_sharing && (
					<div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
						<h3 className="font-semibold text-amber-900 mb-2">Permission needed</h3>
						<p className="text-sm text-amber-800 mb-4">
							We need your permission to process documents for your loan application.
						</p>
						<button
							onClick={() =>
								submitIntent([
									{ type: "consent", params: { consent_type: "doc_sharing", granted: true } },
									{ type: "consent", params: { consent_type: "electronic_records", granted: true } },
								])
							}
							className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg text-sm cursor-pointer"
						>
							Grant permission
						</button>
					</div>
				)}

				{/* Incomplete checklist items */}
				{incompleteItems.length > 0 && (
					<section>
						<h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
							Action needed ({incompleteItems.length})
						</h2>
						<div className="space-y-3">
							{incompleteItems.map((item) => (
								<div
									key={item.id}
									className="bg-white border border-slate-200 rounded-xl p-5"
								>
									<div className="flex items-start justify-between">
										<div>
											<h3 className="font-semibold text-slate-900">{item.title}</h3>
											<p className="text-sm text-slate-600 mt-1">{item.detail}</p>
										</div>
										<span
											className={`text-xs font-medium px-2 py-1 rounded-full ${
												item.priority === "high"
													? "bg-red-100 text-red-700"
													: "bg-amber-100 text-amber-700"
											}`}
										>
											{item.priority}
										</span>
									</div>
									{item.action && (
										<p className="text-sm text-blue-600 mt-3">{item.action}</p>
									)}
								</div>
							))}
						</div>
					</section>
				)}

				{/* Verified items */}
				{verifiedItems.length > 0 && (
					<section>
						<h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
							Completed ({verifiedItems.length})
						</h2>
						<div className="space-y-2">
							{verifiedItems.map((item) => (
								<div
									key={item.id}
									className="bg-white border border-green-200 rounded-xl p-4 flex items-center gap-3"
								>
									<span className="text-green-600">&#10003;</span>
									<span className="text-slate-700">{item.title}</span>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Empty state */}
				{session.checklist.length === 0 && (
					<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
						<h2 className="text-xl font-semibold text-slate-900 mb-2">All set!</h2>
						<p className="text-slate-600">
							No action items at this time. We&apos;ll notify you if anything changes.
						</p>
					</div>
				)}

				{/* Case status footer */}
				<div className="text-center text-xs text-slate-400 pt-4">
					Case status: {session.case_state} &middot; Powered by Fenero
				</div>
			</main>
		</div>
	);
}
