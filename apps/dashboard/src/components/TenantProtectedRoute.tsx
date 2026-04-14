import type { FormEvent, ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface TenantProtectedRouteProps {
	children: ReactNode;
}

/**
 * Route guard that requires both authentication and tenant (organization) association.
 *
 * Checks the authenticated user's tenant status via `/api/v1/auth/me`.
 * Redirects to `/login` if unauthenticated. If the user has no tenant,
 * shows a screen where they can paste an invite code from their admin;
 * submitting POSTs to `/api/v1/auth/tenant/join` and re-checks on success.
 */
export function TenantProtectedRoute({ children }: TenantProtectedRouteProps) {
	const { user, loading } = useAuth();
	const [hasTenant, setHasTenant] = useState<boolean | null>(null);
	const [checkingTenant, setCheckingTenant] = useState(true);
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);

	async function checkTenant() {
		if (!user) {
			setCheckingTenant(false);
			return;
		}
		try {
			const token = await user.getIdToken();
			const res = await fetch("/api/v1/auth/me", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const data = await res.json();
				setHasTenant(data.has_tenant === true);
			} else {
				setHasTenant(false);
			}
		} catch {
			setHasTenant(false);
		} finally {
			setCheckingTenant(false);
		}
	}

	useEffect(() => {
		if (!loading) {
			checkTenant();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user, loading]);

	async function handleJoin(e: FormEvent) {
		e.preventDefault();
		if (!user || !code.trim()) return;
		setSubmitting(true);
		setJoinError(null);
		try {
			const token = await user.getIdToken();
			const res = await fetch("/api/v1/auth/tenant/join", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ code: code.trim() }),
			});
			if (res.ok) {
				setCode("");
				setCheckingTenant(true);
				await checkTenant();
			} else {
				const data = await res.json().catch(() => ({}));
				setJoinError(data.detail || "Could not redeem code.");
			}
		} catch {
			setJoinError("Network error. Try again.");
		} finally {
			setSubmitting(false);
		}
	}

	if (loading || checkingTenant) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="spinner" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (hasTenant === false) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
				<div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md w-full">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">Join an Organization</h2>
					<p className="text-slate-600 mb-6">
						Enter the invite code your administrator sent you, or ask them to issue one.
					</p>
					<form onSubmit={handleJoin} className="space-y-4">
						<input
							type="text"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="e.g. lux-A7K2-QPMR"
							autoFocus
							spellCheck={false}
							autoCapitalize="off"
							className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
							disabled={submitting}
						/>
						{joinError && (
							<p className="text-sm text-red-600">{joinError}</p>
						)}
						<button
							type="submit"
							disabled={submitting || !code.trim()}
							className="w-full bg-slate-900 text-white py-2 rounded-md disabled:opacity-50 hover:bg-slate-800 transition"
						>
							{submitting ? "Joining…" : "Join"}
						</button>
					</form>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
