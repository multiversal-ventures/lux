import { Navigate } from "react-router-dom";
import { Checklist, ConsentBanner, usePortalSession } from "@fenero/lux-react";

/** Read the portal token from the URL search params. */
function usePortalToken(): string | null {
	return new URLSearchParams(window.location.search).get("token");
}

export function SessionPage() {
	const token = usePortalToken();
	const { session, loading, error, submitIntent } = usePortalSession(token);

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
				<ConsentBanner consent={session.consent} onSubmitIntent={submitIntent} />
				<Checklist items={session.checklist} />
				<div className="text-center text-xs text-slate-400 pt-4">
					Case status: {session.case_state} &middot; Powered by Fenero
				</div>
			</main>
		</div>
	);
}
