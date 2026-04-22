import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { resolveApiUrl } from "../lib/api";
import { isDevUiOnlyBypass } from "../lib/devUiOnly";
import { useAppDispatch } from "../store";
import { setTenantId, setTenantName } from "../store/appSlice";

interface TenantProtectedRouteProps {
	children: ReactNode;
}

/**
 * Route guard: Firebase session (`useAuth`) + organization via `GET /api/v1/auth/me`.
 * Hydrates Redux `tenantId` / `tenantName` from the same response (single path vs legacy `ProtectedRoute`).
 * Honors `localStorage.bypass_tenant_check` when the API false-negatives on `has_tenant` (see CompleteRegistrationPage).
 */
export function TenantProtectedRoute({ children }: TenantProtectedRouteProps) {
	const bypass = isDevUiOnlyBypass();
	const dispatch = useAppDispatch();
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
					const data = (await res.json()) as {
						has_tenant?: boolean;
						tenant_id?: string;
						tenant_name?: string;
					};
					if (data.has_tenant === true) {
						localStorage.removeItem("bypass_tenant_check");
						setHasTenant(true);
						if (data.tenant_id && data.tenant_name) {
							dispatch(setTenantId(data.tenant_id));
							dispatch(setTenantName(data.tenant_name));
						} else {
							try {
								const tenantResponse = await fetch(resolveApiUrl("/api/v1/tenants/me"), {
									headers: { Authorization: `Bearer ${token}` },
								});
								if (tenantResponse.ok) {
									const tenantData = (await tenantResponse.json()) as {
										tenant_id?: string;
										tenant_name?: string;
									};
									if (tenantData.tenant_id) {
										dispatch(setTenantId(tenantData.tenant_id));
									}
									if (tenantData.tenant_name) {
										dispatch(setTenantName(tenantData.tenant_name));
									}
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
	}, [user, loading, bypass, dispatch]);

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
