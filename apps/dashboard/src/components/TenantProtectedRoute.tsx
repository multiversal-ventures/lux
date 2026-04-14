import type { FormEvent, ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { useAuth } from "../hooks/useAuth";

interface TenantProtectedRouteProps {
	children: ReactNode;
}

interface TenantJoinScreenProps {
	user: User;
	onJoined: () => void;
}

function TenantJoinScreen({ user, onJoined }: TenantJoinScreenProps) {
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);

	async function handleJoin(e: FormEvent) {
		e.preventDefault();
		if (!code.trim()) return;
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
				onJoined();
			} else {
				const data: { detail?: string } = await res.json().catch(() => ({}));
				setJoinError(data.detail ?? "Could not redeem code.");
			}
		} catch {
			setJoinError("Network error. Try again.");
		} finally {
			setSubmitting(false);
		}
	}

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

/**
 * Route guard that requires both authentication and tenant (organization) association.
 *
 * Checks the authenticated user's tenant status via `/api/v1/auth/me`.
 * Redirects to `/login` if unauthenticated. If the user has no tenant,
 * renders TenantJoinScreen where they can paste an invite code from their admin.
 */
export function TenantProtectedRoute({ children }: TenantProtectedRouteProps) {
	const { user, loading } = useAuth();
	const [hasTenant, setHasTenant] = useState<boolean | null>(null);
	const [checkingTenant, setCheckingTenant] = useState(true);
	const [tenantCheckError, setTenantCheckError] = useState<string | null>(null);

	const checkTenant = useCallback(async () => {
		if (!user) {
			setCheckingTenant(false);
			return;
		}
		setTenantCheckError(null);
		try {
			const token = await user.getIdToken();
			const res = await fetch("/api/v1/auth/me", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const data: { has_tenant: boolean } = await res.json();
				setHasTenant(data.has_tenant === true);
			} else {
				setTenantCheckError("Could not verify organization status. Refresh to retry.");
			}
		} catch {
			setTenantCheckError("Network error. Could not verify organization status. Refresh to retry.");
		} finally {
			setCheckingTenant(false);
		}
	}, [user]);

	useEffect(() => {
		if (!loading) {
			checkTenant();
		}
	}, [user, loading, checkTenant]);

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

	if (tenantCheckError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
				<div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md w-full text-center">
					<p className="text-red-600 mb-4">{tenantCheckError}</p>
					<button
						type="button"
						onClick={() => { setCheckingTenant(true); checkTenant(); }}
						className="text-sm text-slate-600 hover:text-slate-900 underline cursor-pointer"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (hasTenant === false) {
		return <TenantJoinScreen user={user} onJoined={checkTenant} />;
	}

	return <>{children}</>;
}
