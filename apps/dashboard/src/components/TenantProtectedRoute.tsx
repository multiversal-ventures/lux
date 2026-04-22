import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { resolveApiUrl } from "../lib/api";
import { isDevUiOnlyBypass } from "../lib/devUiOnly";

interface TenantProtectedRouteProps {
	children: ReactNode;
}

/**
 * Route guard that requires both authentication and tenant (organization) association.
 *
 * Checks the authenticated user's tenant status via `/api/v1/auth/me`.
 * Redirects to `/login` if unauthenticated, or shows a blocking message
 * if the user has no associated organization.
 */
export function TenantProtectedRoute({ children }: TenantProtectedRouteProps) {
	const bypass = isDevUiOnlyBypass();
	const { user, loading } = useAuth();
	const [hasTenant, setHasTenant] = useState<boolean | null>(() => (bypass ? true : null));
	const [checkingTenant, setCheckingTenant] = useState(() => !bypass);

	useEffect(() => {
		if (bypass) {
			return;
		}
		async function checkTenant() {
			if (!user) {
				setCheckingTenant(false);
				return;
			}
			try {
				const token = await user.getIdToken();
				const res = await fetch(resolveApiUrl("/api/v1/auth/me"), {
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

		if (!loading) {
			checkTenant();
		}
	}, [user, loading, bypass]);

	if (bypass) {
		return <>{children}</>;
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
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization</h2>
					<p className="text-slate-600">
						Your account is not associated with an organization. Contact your administrator.
					</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
