import { apiFetch, getCurrentUserProfile } from "@fenero/lux-core";
import { useAuth, useSession } from "@fenero/lux-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isDevUiOnlyBypass } from "../lib/devUiOnly";

interface TenantProtectedRouteProps {
	children: ReactNode;
}

/**
 * Route guard: Firebase session (`useAuth`) + organization via `GET /api/v1/auth/me`.
 * Hydrates `VeritasSession` tenant fields (consumed by `useAuth`).
 */
export function TenantProtectedRoute({ children }: TenantProtectedRouteProps) {
	const bypass = isDevUiOnlyBypass();
	const session = useSession();
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
				const data = await getCurrentUserProfile();
				if (data.has_tenant === true) {
					localStorage.removeItem("bypass_tenant_check");
					setHasTenant(true);
					if (data.tenant_id && data.tenant_name) {
						session.setTenant(data.tenant_id, data.tenant_name);
					} else {
						try {
							const tenantData = await apiFetch<{
								tenant_id?: string;
								tenant_name?: string;
							}>("/tenants/me");
							if (tenantData.tenant_id || tenantData.tenant_name) {
								session.setTenant(tenantData.tenant_id ?? null, tenantData.tenant_name ?? null);
							}
						} catch {
							/* ignore */
						}
					}
				} else if (localStorage.getItem("bypass_tenant_check")) {
					setHasTenant(true);
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
	}, [user, loading, bypass, session]);

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
		localStorage.removeItem("bypass_tenant_check");
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
