import { Navigate } from "react-router-dom";
import { Checklist, ConsentBanner, usePortalSession } from "@fenero-ai/lux-react";

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

	const displayName = session.entity.name || "Borrower";
	const roleLabel = session.entity.role
		? session.entity.role.charAt(0).toUpperCase() + session.entity.role.slice(1)
		: "";

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 px-6 py-4">
				<div className="max-w-2xl mx-auto flex items-center justify-between">
					<h1 className="text-lg font-bold text-slate-900">Your Loan Application</h1>
					{roleLabel && (
						<span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
							{displayName} &middot; {roleLabel}
						</span>
					)}
				</div>
			</header>

			<main className="max-w-2xl mx-auto p-6 space-y-6">
				<div className="bg-white rounded-xl border border-slate-200 p-5">
					<h2 className="text-base font-semibold text-slate-900 mb-1">
						Welcome{session.entity.name ? `, ${session.entity.name}` : ""}
					</h2>
					<p className="text-sm text-slate-600">
						Your lender has shared this secure page with you to review your
						application, complete any required steps, and upload documents.
						This link is private to you and will expire automatically.
					</p>
				</div>

				<ConsentBanner consent={session.consent} onSubmitIntent={submitIntent} />
				<Checklist items={session.checklist} />
				<div className="text-center text-xs text-slate-400 pt-4">
					Powered by Fenero
				</div>
			</main>
		</div>
	);
}
